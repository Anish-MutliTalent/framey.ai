from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user, require_roles
from database import get_db
from services.grading import compute_grade, compute_overall_percentage, compute_subject_percentage

router = APIRouter(prefix="/reports", tags=["reports"])


# ── Gradebook (teacher enters marks) ─────────────────────────────────────────

@router.post("/marks/bulk")
def enter_marks_bulk(
    payload: schemas.MarkBulk,
    current_user: models.User = Depends(require_roles("teacher", "class_teacher", "coordinator", "principal", "tech_admin")),
    db: Session = Depends(get_db),
):
    created = 0
    updated = 0
    for rec in payload.records:
        existing = db.query(models.Mark).filter(
            models.Mark.student_id == rec["student_id"],
            models.Mark.subject_id == payload.subject_id,
            models.Mark.term_id == payload.term_id,
            models.Mark.assessment_name == payload.assessment_name,
        ).first()
        if existing:
            existing.marks_obtained = rec["marks_obtained"]
            existing.max_marks = payload.max_marks
            updated += 1
        else:
            mark = models.Mark(
                student_id=rec["student_id"],
                subject_id=payload.subject_id,
                term_id=payload.term_id,
                assessment_name=payload.assessment_name,
                marks_obtained=rec["marks_obtained"],
                max_marks=payload.max_marks,
                entered_by=current_user.id,
            )
            db.add(mark)
            created += 1
    db.commit()
    return {"created": created, "updated": updated}


@router.get("/marks/section/{section_id}")
def get_section_marks(
    section_id: int,
    term_id: int,
    subject_id: Optional[int] = None,
    current_user: models.User = Depends(require_roles("teacher", "class_teacher", "coordinator", "principal", "tech_admin")),
    db: Session = Depends(get_db),
):
    students = db.query(models.Student).filter(models.Student.section_id == section_id).all()
    result = []
    for student in students:
        q = db.query(models.Mark).filter(
            models.Mark.student_id == student.id,
            models.Mark.term_id == term_id,
        )
        if subject_id:
            q = q.filter(models.Mark.subject_id == subject_id)
        marks = q.all()
        result.append(
            {
                "student_id": student.id,
                "student_name": student.user.name,
                "roll_number": student.roll_number,
                "marks": [
                    {
                        "subject": m.subject.name,
                        "assessment": m.assessment_name,
                        "obtained": m.marks_obtained,
                        "max": m.max_marks,
                    }
                    for m in marks
                ],
            }
        )
    return result


# ── Remarks ───────────────────────────────────────────────────────────────────

@router.post("/remarks", response_model=schemas.RemarkOut)
def add_remark(
    payload: schemas.RemarkCreate,
    current_user: models.User = Depends(require_roles("teacher", "class_teacher", "coordinator", "principal")),
    db: Session = Depends(get_db),
):
    report = db.query(models.Report).filter(
        models.Report.student_id == payload.student_id,
        models.Report.term_id == payload.term_id,
    ).first()
    if not report:
        # Auto-generate report shell
        report = models.Report(
            student_id=payload.student_id,
            term_id=payload.term_id,
        )
        db.add(report)
        db.flush()

    remark = models.Remark(
        report_id=report.id,
        teacher_id=current_user.id,
        subject_id=payload.subject_id,
        content=payload.content,
    )
    db.add(remark)
    db.commit()
    db.refresh(remark)
    return remark


# ── Report generation ─────────────────────────────────────────────────────────

@router.post("/generate/{section_id}/{term_id}")
def generate_reports(
    section_id: int,
    term_id: int,
    current_user: models.User = Depends(require_roles("coordinator", "principal", "tech_admin")),
    db: Session = Depends(get_db),
):
    school = db.query(models.School).first()
    grading_system = school.grading_system if school else "percentage"

    students = db.query(models.Student).filter(models.Student.section_id == section_id).all()
    student_percentages = []

    for student in students:
        marks = db.query(models.Mark).filter(
            models.Mark.student_id == student.id,
            models.Mark.term_id == term_id,
        ).all()

        # Group by subject
        subject_map: dict = {}
        for m in marks:
            if m.subject_id not in subject_map:
                subject_map[m.subject_id] = []
            subject_map[m.subject_id].append(
                {"marks_obtained": m.marks_obtained, "max_marks": m.max_marks}
            )

        subject_pcts = [compute_subject_percentage(v) for v in subject_map.values()]
        overall_pct = compute_overall_percentage(subject_pcts)
        student_percentages.append((student.id, overall_pct))

    # Rank students
        report = db.query(models.Report).filter(
            models.Report.student_id == student.id,
            models.Report.term_id == term_id,
        ).first()
        if not report:
            report = models.Report(student_id=student.id, term_id=term_id)
            db.add(report)
        report.overall_percentage = overall_pct
        report.overall_grade = compute_grade(overall_pct, grading_system)
        db.flush()

    # Compute ranks by overall percentage (desc)
    sorted_students = sorted(student_percentages, key=lambda x: x[1], reverse=True)
    for rank, (student_id, _) in enumerate(sorted_students, start=1):
        report = db.query(models.Report).filter(
            models.Report.student_id == student_id,
            models.Report.term_id == term_id,
        ).first()
        if report:
            report.rank = rank

    db.commit()
    return {"message": f"Reports generated for {len(students)} students"}


@router.get("/student/{student_id}/{term_id}")
def get_student_report(
    student_id: int,
    term_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_roles = {r.role for r in current_user.roles}

    # Students can only view their own
    if "student" in user_roles and "teacher" not in user_roles:
        own = db.query(models.Student).filter(models.Student.user_id == current_user.id).first()
        if not own or own.id != student_id:
            raise HTTPException(403, "Access denied")

    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")

    marks = db.query(models.Mark).filter(
        models.Mark.student_id == student_id,
        models.Mark.term_id == term_id,
    ).all()

    report = db.query(models.Report).filter(
        models.Report.student_id == student_id,
        models.Report.term_id == term_id,
    ).first()

    remarks = []
    if report:
        remarks = db.query(models.Remark).filter(models.Remark.report_id == report.id).all()

    return {
        "student": {
            "id": student.id,
            "name": student.user.name,
            "roll_number": student.roll_number,
            "admission_number": student.admission_number,
        },
        "overall_grade": report.overall_grade if report else None,
        "overall_percentage": report.overall_percentage if report else None,
        "rank": report.rank if report else None,
        "marks": [
            {
                "subject": m.subject.name,
                "color": m.subject.color,
                "assessment": m.assessment_name,
                "obtained": m.marks_obtained,
                "max": m.max_marks,
                "percentage": round(m.marks_obtained / m.max_marks * 100, 1) if m.max_marks else 0,
            }
            for m in marks
        ],
        "remarks": [
            {
                "teacher": r.teacher.name,
                "subject": r.subject.name if r.subject else "General",
                "content": r.content,
            }
            for r in remarks
        ],
    }


@router.get("/school-overview")
def school_overview(
    term_id: int,
    current_user: models.User = Depends(require_roles("coordinator", "principal", "tech_admin")),
    db: Session = Depends(get_db),
):
    reports = db.query(models.Report).filter(models.Report.term_id == term_id).all()
    if not reports:
        return {"average_percentage": 0, "sections": []}

    total_pct = [r.overall_percentage for r in reports if r.overall_percentage is not None]
    avg = round(sum(total_pct) / len(total_pct), 2) if total_pct else 0

    return {
        "average_percentage": avg,
        "total_students": len(reports),
        "grade_distribution": _grade_distribution(reports),
    }


def _grade_distribution(reports):
    dist: dict = {}
    for r in reports:
        g = r.overall_grade or "N/A"
        dist[g] = dist.get(g, 0) + 1
    return [{"grade": k, "count": v} for k, v in dist.items()]
