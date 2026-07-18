from datetime import date, datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user, require_roles
from database import get_db

router = APIRouter(prefix="/students", tags=["students"])


def _get_student_or_404(user: models.User, db: Session) -> models.Student:
    student = db.query(models.Student).filter(models.Student.user_id == user.id).first()
    if not student:
        raise HTTPException(404, "Student profile not found")
    return student


def _student_assignment_posts(student: models.Student, db: Session):
    """Published classroom assignment posts visible to this student
    (section/subject classrooms + custom classrooms they're a member of)."""
    now = datetime.utcnow()
    q = db.query(models.ClassroomPost).filter(
        models.ClassroomPost.post_type == "assignment",
        models.ClassroomPost.is_draft == False,  # noqa: E712
    )
    # section/subject assignments for the student's section
    posts = [p for p in q.filter(models.ClassroomPost.section_id == student.section_id).all()
             if (p.scheduled_at is None or p.scheduled_at <= now)]
    # custom classroom assignments
    roster = db.query(models.CustomClassroomStudent).filter(
        models.CustomClassroomStudent.student_id == student.id
    ).all()
    custom_ids = {r.classroom_id for r in roster}
    if custom_ids:
        posts += [p for p in q.filter(models.ClassroomPost.custom_classroom_id.in_(custom_ids)).all()
                  if (p.scheduled_at is None or p.scheduled_at <= now)]
    return posts


def _assignment_subject(post: models.ClassroomPost):
    if post.subject:
        return {"id": post.subject.id, "name": post.subject.name, "code": post.subject.code,
                "color": post.subject.color}
    if post.custom_classroom:
        return {"id": -post.custom_classroom.id, "name": post.custom_classroom.name,
                "code": None, "color": post.custom_classroom.color or "#4F46E5"}
    return {"id": 0, "name": "Assignment", "code": None, "color": "#4F46E5"}


def _assignment_as_diary_entry(post: models.ClassroomPost, student: models.Student, db: Session) -> dict:
    """Shape a classroom assignment post like a DiaryEntryOut so the diary can render it."""
    return {
        "id": -post.id,                       # synthetic id to avoid collisions with real DiaryEntry ids
        "title": post.title or "Assignment",
        "description": post.content,
        "due_date": post.assignment.due_date if post.assignment else None,
        "subject": _assignment_subject(post),
        "is_completed": _assignment_turned_in(post, student, db),
        "created_at": post.created_at,
        "post_id": post.id,
    }


def _assignment_turned_in(post: models.ClassroomPost, student: models.Student, db: Session) -> bool:
    if not post.assignment:
        return False
    sub = db.query(models.Submission).filter(
        models.Submission.assignment_id == post.assignment.id,
        models.Submission.student_id == student.id,
    ).first()
    if not sub:
        return False
    if sub.marked_done:
        return True
    if sub.content and sub.content.strip():
        return True
    if sub.files and len(sub.files) > 0:
        return True
    if sub.project_id:
        return True
    return False


# ── Dashboard data ────────────────────────────────────────────────────────────

@router.get("/dashboard")
def student_dashboard(
    current_user: models.User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    student = _get_student_or_404(current_user, db)
    today = date.today()

    # Today's timetable
    day_of_week = today.weekday()
    timetable = (
        db.query(models.TimetableEntry)
        .join(models.TimeSlot)
        .filter(
            models.TimetableEntry.section_id == student.section_id,
            models.TimeSlot.day_of_week == day_of_week,
        )
        .order_by(models.TimeSlot.start_time)
        .all()
    )

    # Upcoming assignments (due in future, not submitted)
    submitted_ids = {s.assignment_id for s in student.submissions}
    upcoming = (
        db.query(models.AssignmentPost)
        .join(models.ClassroomPost)
        .filter(
            models.ClassroomPost.section_id == student.section_id,
            models.AssignmentPost.due_date >= today,
        )
        .order_by(models.AssignmentPost.due_date)
        .limit(5)
        .all()
    )

    # Recent announcements
    announcements = (
        db.query(models.Announcement)
        .filter(
            (models.Announcement.scope == "school_wide")
            | (models.Announcement.section_id == student.section_id)
        )
        .order_by(models.Announcement.created_at.desc())
        .limit(5)
        .all()
    )

    # Attendance summary (day-wise: present=1, half_day=0.5, absent=0)
    attendances = db.query(models.Attendance).filter(
        models.Attendance.student_id == student.id
    ).all()
    total = len(attendances)
    present_days = sum(
        1.0 if a.status == "present" else 0.5 if a.status == "half_day" else 0.0
        for a in attendances
    )
    attendance_pct = round((present_days / total * 100), 1) if total else 0

    return {
        "timetable": [
            {
                "id": t.id,
                "subject": t.subject.name,
                "subject_color": t.subject.color,
                "teacher": t.teacher.name,
                "room": t.room.name if t.room else None,
                "start_time": str(t.time_slot.start_time),
                "end_time": str(t.time_slot.end_time),
                "period": t.time_slot.period_number,
            }
            for t in timetable
        ],
        "upcoming_assignments": [
            {
                "id": a.id,
                "title": a.post.title,
                "subject": a.subject.name if a.subject else None,
                "due_date": a.due_date.isoformat() if a.due_date else None,
                "submitted": a.id in submitted_ids,
            }
            for a in upcoming
        ],
        "announcements": [
            {
                "id": ann.id,
                "title": ann.title,
                "content": ann.content,
                "priority": ann.priority,
                "scope": ann.scope,
                "created_at": ann.created_at.isoformat(),
            }
            for ann in announcements
        ],
        "attendance": {
            "total_classes": total,
            "present": present_days,
            "percentage": attendance_pct,
        },
    }


# ── Profile ───────────────────────────────────────────────────────────────────

@router.get("/me", response_model=schemas.StudentOut)
def get_my_profile(
    current_user: models.User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    return _get_student_or_404(current_user, db)


@router.get("/me/library-profile")
def get_my_library_profile(
    current_user: models.User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    """Default board + grade for the library filter bar.

    `grade` is the student's class level; `board` is inferred from the school's
    grading system (falls back to CBSE) since we don't store board explicitly.
    """
    student = _get_student_or_404(current_user, db)
    grade = student.section.class_.level if student.section and student.section.class_ else 10
    school = student.section.class_.school if student.section and student.section.class_ else None
    grading = (school.grading_system if school else "") or ""
    board = "CBSE" if grading.lower() == "cbse" else "CBSE"
    return {"grade": grade, "board": board}


# ── Attendance ────────────────────────────────────────────────────────────────

@router.get("/attendance")
def get_my_attendance(
    current_user: models.User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    """Returns day-wise attendance records grouped by month."""
    student = _get_student_or_404(current_user, db)
    records = (
        db.query(models.Attendance)
        .filter(models.Attendance.student_id == student.id)
        .order_by(models.Attendance.date)
        .all()
    )

    total = len(records)
    present_days = sum(
        1.0 if r.status == "present" else 0.5 if r.status == "half_day" else 0.0
        for r in records
    )
    percentage = round(present_days / total * 100, 1) if total else 0.0

    return {
        "total": total,
        "present_days": present_days,
        "percentage": percentage,
        "records": [
            {"date": r.date.isoformat(), "status": r.status, "remarks": r.remarks}
            for r in records
        ],
    }


# ── Diary ─────────────────────────────────────────────────────────────────────

@router.get("/diary/by-date")
def get_diary_by_date(
    date_str: str,
    current_user: models.User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    """Returns HomeworkEntry records for the student's section on a given date,
    structured with separate classwork/homework sections and attached files.
    Used by the Calendar View in the student diary."""
    from datetime import date as date_type
    student = _get_student_or_404(current_user, db)
    target_date = date_type.fromisoformat(date_str)

    hw_entries = (
        db.query(models.HomeworkEntry)
        .filter(
            models.HomeworkEntry.section_id == student.section_id,
            models.HomeworkEntry.date == target_date,
        )
        .all()
    )

    result = []
    for entry in hw_entries:
        # Find the corresponding DiaryEntry for this student (for completion toggle)
        diary_entry = db.query(models.DiaryEntry).filter(
            models.DiaryEntry.homework_entry_id == entry.id,
            models.DiaryEntry.student_id == student.id,
        ).first()

        result.append({
            "homework_entry_id": entry.id,
            "diary_entry_id": diary_entry.id if diary_entry else None,
            "is_completed": diary_entry.is_completed if diary_entry else False,
            "subject_name": entry.subject.name,
            "subject_color": entry.subject.color,
            "date": entry.date.isoformat(),
            "classwork_title": entry.classwork_title,
            "classwork_description": entry.classwork_description,
            "homework_title": entry.homework_title,
            "homework_description": entry.homework_description,
            "homework_due_date": entry.homework_due_date.isoformat() if entry.homework_due_date else None,
            "files": [
                {
                    "id": f.id,
                    "original_name": f.original_name,
                    "file_type": f.file_type,
                    "size_bytes": f.size_bytes,
                }
                for f in entry.files
            ],
        })

    # Append classroom assignments created (assigned) on this date
    for post in _student_assignment_posts(student, db):
        if not post.created_at or post.created_at.date() != target_date:
            continue
        subj = _assignment_subject(post)
        result.append({
            "homework_entry_id": -post.id,
            "diary_entry_id": None,
            "post_id": post.id,
            "is_completed": _assignment_turned_in(post, student, db),
            "subject_name": subj["name"],
            "subject_color": subj["color"],
            "date": target_date.isoformat(),
            "classwork_title": None,
            "classwork_description": None,
            "homework_title": post.title or "Assignment",
            "homework_description": post.content,
            "homework_due_date": post.assignment.due_date.isoformat() if post.assignment and post.assignment.due_date else None,
            "files": [],
        })
    return result


@router.get("/diary/dates-with-entries")
def get_dates_with_entries(
    current_user: models.User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    """Returns list of ISO date strings that have homework entries or assignments — for calendar dots."""
    student = _get_student_or_404(current_user, db)
    hw_entries = (
        db.query(models.HomeworkEntry.date)
        .filter(models.HomeworkEntry.section_id == student.section_id)
        .distinct()
        .all()
    )
    dates = {row[0].isoformat() for row in hw_entries}
    for post in _student_assignment_posts(student, db):
        if post.created_at:
            dates.add(post.created_at.date().isoformat())
        if post.assignment and post.assignment.due_date:
            dates.add(post.assignment.due_date.date().isoformat())
    return sorted(dates)


@router.get("/diary", response_model=List[schemas.DiaryEntryOut])
def get_diary(
    current_user: models.User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    student = _get_student_or_404(current_user, db)
    entries = (
        db.query(models.DiaryEntry)
        .filter(models.DiaryEntry.student_id == student.id)
        .order_by(models.DiaryEntry.due_date)
        .all()
    )
    result = list(entries)
    # Append classroom assignments as diary-like entries (clickable to the assignment view)
    for post in _student_assignment_posts(student, db):
        result.append(_assignment_as_diary_entry(post, student, db))
    result.sort(key=lambda e: (e.due_date is None, e.due_date))
    return result


@router.patch("/diary/{entry_id}", response_model=schemas.DiaryEntryOut)
def update_diary_entry(
    entry_id: int,
    payload: schemas.DiaryEntryUpdate,
    current_user: models.User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    student = _get_student_or_404(current_user, db)
    entry = db.query(models.DiaryEntry).filter(
        models.DiaryEntry.id == entry_id,
        models.DiaryEntry.student_id == student.id,
    ).first()
    if not entry:
        raise HTTPException(404, "Diary entry not found")
    entry.is_completed = payload.is_completed
    db.commit()
    db.refresh(entry)
    return entry


# ── Diary Notes (Communication Log) ──────────────────────────────────────────

@router.get("/diary-notes")
def get_diary_notes(
    current_user: models.User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    """Returns all communication-log notes for the student (from teacher, parents, or school)."""
    student = _get_student_or_404(current_user, db)
    notes = (
        db.query(models.DiaryNote)
        .filter(
            (models.DiaryNote.student_id == student.id) |
            (models.DiaryNote.section_id == student.section_id)
        )
        .order_by(models.DiaryNote.date.desc())
        .all()
    )
    return [
        {
            "id": n.id,
            "author": n.author.name,
            "author_role": n.author_role,
            "content": n.content,
            "date": n.date.isoformat(),
        }
        for n in notes
    ]


# ── Marks ─────────────────────────────────────────────────────────────────────

@router.get("/marks")
def get_my_marks(
    current_user: models.User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    student = _get_student_or_404(current_user, db)
    marks = db.query(models.Mark).filter(models.Mark.student_id == student.id).all()

    # Group by term → subject → assessments
    result: dict = {}
    for m in marks:
        term_key = m.term_id
        if term_key not in result:
            result[term_key] = {"term_id": term_key, "term_name": m.term.name, "subjects": {}}
        subj_key = m.subject_id
        if subj_key not in result[term_key]["subjects"]:
            result[term_key]["subjects"][subj_key] = {
                "subject": m.subject.name,
                "color": m.subject.color,
                "assessments": [],
            }
        result[term_key]["subjects"][subj_key]["assessments"].append(
            {
                "name": m.assessment_name,
                "obtained": m.marks_obtained,
                "max": m.max_marks,
                "percentage": round(m.marks_obtained / m.max_marks * 100, 1) if m.max_marks else 0,
            }
        )

    # Compute subject totals
    for term_data in result.values():
        for subj_data in term_data["subjects"].values():
            assessments = subj_data["assessments"]
            total_obt = sum(a["obtained"] for a in assessments)
            total_max = sum(a["max"] for a in assessments)
            subj_data["total_percentage"] = round(total_obt / total_max * 100, 1) if total_max else 0

    return [
        {**term_data, "subjects": list(term_data["subjects"].values())}
        for term_data in result.values()
    ]
