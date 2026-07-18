from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user, require_roles
from database import get_db

router = APIRouter(prefix="/teachers", tags=["teachers"])


@router.get("/dashboard")
def teacher_dashboard(
    current_user: models.User = Depends(require_roles("teacher", "class_teacher")),
    db: Session = Depends(get_db),
):
    from datetime import date
    today = date.today()
    day_of_week = today.weekday()

    # Classes today
    today_classes = (
        db.query(models.TimetableEntry)
        .join(models.TimeSlot)
        .filter(
            models.TimetableEntry.teacher_id == current_user.id,
            models.TimeSlot.day_of_week == day_of_week,
        )
        .order_by(models.TimeSlot.start_time)
        .all()
    )

    # Pending submissions to grade
    my_assignments = (
        db.query(models.AssignmentPost)
        .join(models.ClassroomPost)
        .join(models.TeacherSubjectSection, models.ClassroomPost.author_id == current_user.id)
        .filter(models.ClassroomPost.author_id == current_user.id)
        .all()
    )
    assignment_ids = [a.id for a in my_assignments]
    pending_grade = (
        db.query(models.Submission)
        .filter(
            models.Submission.assignment_id.in_(assignment_ids),
            models.Submission.marks_obtained == None,
        )
        .count()
    )

    # Recent activity in my sections
    my_sections = list({
        t.section_id for t in
        db.query(models.TimetableEntry).filter(
            models.TimetableEntry.teacher_id == current_user.id
        ).all()
    })

    recent_posts = (
        db.query(models.ClassroomPost)
        .filter(models.ClassroomPost.section_id.in_(my_sections))
        .order_by(models.ClassroomPost.created_at.desc())
        .limit(5)
        .all()
    )

    return {
        "today_classes": [
            {
                "id": c.id,
                "subject": c.subject.name,
                "subject_color": c.subject.color,
                "section": f"{c.section.class_.name} {c.section.name}",
                "section_id": c.section_id,
                "room": c.room.name if c.room else None,
                "start_time": str(c.time_slot.start_time),
                "end_time": str(c.time_slot.end_time),
                "period": c.time_slot.period_number,
            }
            for c in today_classes
        ],
        "pending_corrections": pending_grade,
        "recent_activity": [
            {
                "id": p.id,
                "type": p.post_type,
                "title": p.title,
                "section_id": p.section_id,
                "created_at": p.created_at.isoformat(),
            }
            for p in recent_posts
        ],
    }


@router.get("/my-sections")
def get_my_sections(
    current_user: models.User = Depends(require_roles("teacher", "class_teacher")),
    db: Session = Depends(get_db),
):
    tss = (
        db.query(models.TeacherSubjectSection)
        .filter(models.TeacherSubjectSection.teacher_id == current_user.id)
        .all()
    )
    sections: dict = {}
    for t in tss:
        sid = t.section_id
        if sid not in sections:
            sections[sid] = {
                "section_id": sid,
                "section_name": f"{t.section.class_.name} {t.section.name}",
                "class_name": t.section.class_.name,
                "subjects": [],
            }
        sections[sid]["subjects"].append({
            "id": t.subject.id,
            "name": t.subject.name,
            "color": t.subject.color,
        })
    return list(sections.values())


@router.get("/my-class-section")
def get_my_class_section(
    current_user: models.User = Depends(require_roles("teacher", "class_teacher", "coordinator", "principal", "tech_admin")),
    db: Session = Depends(get_db),
):
    """Returns the section where the current user is assigned as class teacher, or null."""
    section = db.query(models.Section).filter(
        models.Section.class_teacher_id == current_user.id
    ).first()
    if not section:
        return None
    return {
        "section_id": section.id,
        "section_name": f"{section.class_.name} {section.name}",
        "class_name": section.class_.name,
        "section_letter": section.name,
    }


@router.get("/student/{student_id}/overview")
def get_student_overview(
    student_id: int,
    _: models.User = Depends(require_roles("teacher", "class_teacher", "coordinator", "principal", "tech_admin")),
    db: Session = Depends(get_db),
):
    """Teacher view of a specific student's diary, progress, and projects."""
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")

    diary = (
        db.query(models.DiaryEntry)
        .filter(models.DiaryEntry.student_id == student_id)
        .order_by(models.DiaryEntry.due_date.desc())
        .limit(10)
        .all()
    )
    progress = (
        db.query(models.ProgressLog)
        .filter(models.ProgressLog.user_id == student.user_id)
        .order_by(models.ProgressLog.created_at.desc())
        .limit(10)
        .all()
    )
    projects = (
        db.query(models.Project)
        .filter(models.Project.user_id == student.user_id)
        .order_by(models.Project.updated_at.desc())
        .limit(10)
        .all()
    )

    return {
        "diary": [
            {
                "id": e.id,
                "title": e.title,
                "description": e.description,
                "due_date": e.due_date.isoformat() if e.due_date else None,
                "subject": {"name": e.subject.name, "color": e.subject.color} if e.subject else None,
                "is_completed": e.is_completed,
            }
            for e in diary
        ],
        "progress": [
            {
                "id": l.id,
                "activity": l.activity,
                "subject": l.subject,
                "duration_minutes": l.duration_minutes,
                "mastery_score": l.mastery_score,
                "created_at": l.created_at.isoformat(),
            }
            for l in progress
        ],
        "projects": [
            {
                "id": p.id,
                "title": p.title,
                "subject": p.subject,
                "status": p.status,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            }
            for p in projects
        ],
    }


# ── Diary Notes (Communication Log) — teacher writes, student reads ───────────

class DiaryNoteCreate(BaseModel):
    section_id: Optional[int] = None     # null = write to a specific student
    student_id: Optional[int] = None     # null = write to whole section
    content: str
    date: Optional[date] = None          # defaults to today


@router.post("/diary-notes")
def create_diary_note(
    payload: DiaryNoteCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Teacher writes a communication note to a student or whole section."""
    note = models.DiaryNote(
        student_id=payload.student_id,
        section_id=payload.section_id,
        author_id=current_user.id,
        author_role="teacher",
        content=payload.content,
        date=payload.date or date.today(),
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return {
        "id": note.id,
        "author": note.author.name,
        "author_role": note.author_role,
        "content": note.content,
        "date": note.date.isoformat(),
    }


@router.get("/diary-notes/section/{section_id}")
def list_section_diary_notes(
    section_id: int,
    _: models.User = Depends(require_roles("teacher", "class_teacher", "coordinator", "principal", "tech_admin")),
    db: Session = Depends(get_db),
):
    notes = (
        db.query(models.DiaryNote)
        .filter(models.DiaryNote.section_id == section_id)
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
            "student_id": n.student_id,
        }
        for n in notes
    ]


@router.get("/staff", response_model=List[schemas.UserOut])
def list_all_teachers(
    _: models.User = Depends(require_roles("coordinator", "principal", "tech_admin")),
    db: Session = Depends(get_db),
):
    teacher_user_ids = (
        db.query(models.UserRole.user_id)
        .filter(models.UserRole.role.in_(["teacher", "class_teacher", "coordinator", "principal"]))
        .distinct()
        .all()
    )
    ids = [row[0] for row in teacher_user_ids]
    return db.query(models.User).filter(models.User.id.in_(ids)).all()
