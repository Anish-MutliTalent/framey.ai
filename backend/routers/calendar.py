from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user, require_roles
from database import get_db

router = APIRouter(prefix="/calendar", tags=["calendar"])

MANAGE_ROLES = ("coordinator", "principal", "tech_admin")


@router.get("/events", response_model=List[schemas.EventOut])
def list_events(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_roles = {r.role for r in current_user.roles}
    school = db.query(models.School).first()
    if not school:
        return []

    q = db.query(models.Event).filter(models.Event.school_id == school.id)

    if "student" in user_roles and "teacher" not in user_roles:
        # Students don't see staff-only events
        q = q.filter(models.Event.scope != "teacher_only")

    return q.order_by(models.Event.start_date).all()


@router.post("/events", response_model=schemas.EventOut)
def create_event(
    payload: schemas.EventCreate,
    current_user: models.User = Depends(require_roles(*MANAGE_ROLES)),
    db: Session = Depends(get_db),
):
    school = db.query(models.School).first()
    if not school:
        raise HTTPException(404, "School not configured")
    event = models.Event(
        school_id=school.id,
        created_by=current_user.id,
        **payload.model_dump(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.put("/events/{event_id}", response_model=schemas.EventOut)
def update_event(
    event_id: int,
    payload: schemas.EventCreate,
    current_user: models.User = Depends(require_roles(*MANAGE_ROLES)),
    db: Session = Depends(get_db),
):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")
    for k, v in payload.model_dump().items():
        setattr(event, k, v)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/events/{event_id}", status_code=204)
def delete_event(
    event_id: int,
    current_user: models.User = Depends(require_roles(*MANAGE_ROLES)),
    db: Session = Depends(get_db),
):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")
    db.delete(event)
    db.commit()
