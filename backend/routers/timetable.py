from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user, require_roles
from database import get_db

router = APIRouter(prefix="/timetable", tags=["timetable"])


@router.get("/section/{section_id}", response_model=List[schemas.TimetableEntryOut])
def get_section_timetable(
    section_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.TimetableEntry)
        .filter(models.TimetableEntry.section_id == section_id)
        .join(models.TimeSlot)
        .order_by(models.TimeSlot.day_of_week, models.TimeSlot.start_time)
        .all()
    )


@router.get("/teacher/me")
def get_my_timetable(
    current_user: models.User = Depends(require_roles("teacher", "class_teacher")),
    db: Session = Depends(get_db),
):
    """Returns teacher's own periods with section_name included (e.g. 'Grade 9 A')."""
    entries = (
        db.query(models.TimetableEntry)
        .filter(models.TimetableEntry.teacher_id == current_user.id)
        .join(models.TimeSlot)
        .order_by(models.TimeSlot.day_of_week, models.TimeSlot.start_time)
        .all()
    )
    return [
        {
            "id": e.id,
            "section_id": e.section_id,
            "section_name": f"{e.section.class_.name} {e.section.name}",
            "subject": {
                "id": e.subject.id,
                "name": e.subject.name,
                "code": e.subject.code,
                "color": e.subject.color,
            },
            "time_slot": {
                "id": e.time_slot.id,
                "period_number": e.time_slot.period_number,
                "start_time": str(e.time_slot.start_time),
                "end_time": str(e.time_slot.end_time),
                "day_of_week": e.time_slot.day_of_week,
            },
        }
        for e in entries
    ]


@router.post("/", response_model=schemas.TimetableEntryOut)
def create_timetable_entry(
    payload: schemas.TimetableEntryCreate,
    current_user: models.User = Depends(require_roles("class_teacher", "coordinator", "principal", "tech_admin")),
    db: Session = Depends(get_db),
):
    entry = models.TimetableEntry(**payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/{entry_id}", response_model=schemas.TimetableEntryOut)
def update_timetable_entry(
    entry_id: int,
    payload: schemas.TimetableEntryCreate,
    current_user: models.User = Depends(require_roles("class_teacher", "coordinator", "principal", "tech_admin")),
    db: Session = Depends(get_db),
):
    entry = db.query(models.TimetableEntry).filter(models.TimetableEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(404, "Entry not found")
    for k, v in payload.model_dump().items():
        setattr(entry, k, v)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_timetable_entry(
    entry_id: int,
    current_user: models.User = Depends(require_roles("coordinator", "principal", "tech_admin")),
    db: Session = Depends(get_db),
):
    entry = db.query(models.TimetableEntry).filter(models.TimetableEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(404, "Entry not found")
    db.delete(entry)
    db.commit()


@router.get("/time-slots", response_model=List[schemas.TimeSlotOut])
def list_time_slots(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(models.TimeSlot).all()


@router.post("/time-slots", response_model=schemas.TimeSlotOut)
def create_time_slot(
    payload: schemas.TimeSlotCreate,
    current_user: models.User = Depends(require_roles("tech_admin")),
    db: Session = Depends(get_db),
):
    school = db.query(models.School).first()
    if not school:
        raise HTTPException(404, "School not configured")
    slot = models.TimeSlot(school_id=school.id, **payload.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot
