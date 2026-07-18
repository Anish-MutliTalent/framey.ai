from datetime import date
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user, require_roles
from database import get_db

router = APIRouter(prefix="/attendance", tags=["attendance"])

MARK_ROLES = ("class_teacher", "coordinator", "principal", "tech_admin")


def _assert_class_teacher(user: models.User, section_id: int, db: Session):
    """Class teacher can only mark their own section; admins can mark any."""
    user_roles = {r.role for r in user.roles}
    if user_roles.intersection({"coordinator", "principal", "tech_admin"}):
        return
    section = db.query(models.Section).filter(
        models.Section.id == section_id,
        models.Section.class_teacher_id == user.id,
    ).first()
    if not section:
        raise HTTPException(403, "You are not the class teacher of this section")


# ── Mark / update day attendance for a whole section ─────────────────────────

@router.post("/day", response_model=List[schemas.AttendanceOut])
def mark_day_attendance(
    payload: schemas.AttendanceDayBulk,
    current_user: models.User = Depends(require_roles(*MARK_ROLES)),
    db: Session = Depends(get_db),
):
    _assert_class_teacher(current_user, payload.section_id, db)
    results = []
    for rec in payload.records:
        student_id = rec["student_id"]
        status = rec.get("status", "absent")
        remarks = rec.get("remarks")

        existing = db.query(models.Attendance).filter(
            models.Attendance.student_id == student_id,
            models.Attendance.date == payload.date,
        ).first()
        if existing:
            existing.status = status
            existing.remarks = remarks
            existing.marked_by = current_user.id
            db.flush()
            results.append(existing)
        else:
            att = models.Attendance(
                student_id=student_id,
                section_id=payload.section_id,
                date=payload.date,
                status=status,
                remarks=remarks,
                marked_by=current_user.id,
            )
            db.add(att)
            db.flush()
            results.append(att)
    db.commit()
    for r in results:
        db.refresh(r)
    return results


# ── Edit a single record (with optional remark) ───────────────────────────────

@router.patch("/{attendance_id}", response_model=schemas.AttendanceOut)
def edit_attendance(
    attendance_id: int,
    payload: schemas.AttendanceEdit,
    current_user: models.User = Depends(require_roles(*MARK_ROLES)),
    db: Session = Depends(get_db),
):
    att = db.query(models.Attendance).filter(models.Attendance.id == attendance_id).first()
    if not att:
        raise HTTPException(404, "Record not found")
    _assert_class_teacher(current_user, att.section_id, db)
    att.status = payload.status
    att.remarks = payload.remarks
    att.marked_by = current_user.id
    db.commit()
    db.refresh(att)
    return att


# ── Get attendance roster for a section on a date ─────────────────────────────

@router.get("/section/{section_id}")
def get_section_attendance(
    section_id: int,
    date_str: str,
    current_user: models.User = Depends(require_roles(*MARK_ROLES)),
    db: Session = Depends(get_db),
):
    _assert_class_teacher(current_user, section_id, db)
    att_date = date.fromisoformat(date_str)
    students = (
        db.query(models.Student)
        .filter(models.Student.section_id == section_id)
        .order_by(models.Student.roll_number)
        .all()
    )
    result = []
    for student in students:
        att = db.query(models.Attendance).filter(
            models.Attendance.student_id == student.id,
            models.Attendance.date == att_date,
        ).first()
        result.append({
            "student_id": student.id,
            "student_name": student.user.name,
            "roll_number": student.roll_number,
            "avatar_url": student.user.avatar_url,
            "attendance_id": att.id if att else None,
            "status": att.status if att else "unmarked",
            "remarks": att.remarks if att else None,
        })
    return result


# ── Monthly summary for a student (used in student view) ─────────────────────

@router.get("/student/{student_id}/monthly")
def student_monthly(
    student_id: int,
    year: int,
    month: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_roles = {r.role for r in current_user.roles}
    # Students can only view their own
    if "student" in user_roles and not user_roles.intersection({"teacher", "class_teacher", "coordinator", "principal", "tech_admin"}):
        own = db.query(models.Student).filter(models.Student.user_id == current_user.id).first()
        if not own or own.id != student_id:
            raise HTTPException(403, "Access denied")

    from sqlalchemy import extract
    records = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.student_id == student_id,
            extract("year", models.Attendance.date) == year,
            extract("month", models.Attendance.date) == month,
        )
        .order_by(models.Attendance.date)
        .all()
    )
    return [
        {"date": str(r.date), "status": r.status, "remarks": r.remarks}
        for r in records
    ]
