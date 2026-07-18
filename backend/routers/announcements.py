from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user, require_roles
from database import get_db

router = APIRouter(prefix="/announcements", tags=["announcements"])

BROADCAST_ROLES = ("coordinator", "principal", "tech_admin")
CLASS_BROADCAST_ROLES = ("teacher", "class_teacher", "coordinator", "principal", "tech_admin")


@router.get("/", response_model=List[schemas.AnnouncementOut])
def list_announcements(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_roles = {r.role for r in current_user.roles}
    q = db.query(models.Announcement)

    if "student" in user_roles:
        student = db.query(models.Student).filter(models.Student.user_id == current_user.id).first()
        if student:
            q = q.filter(
                (models.Announcement.scope == "school_wide")
                | (models.Announcement.section_id == student.section_id)
            )
    elif any(role in user_roles for role in ("teacher", "class_teacher")):
        # Teachers see school-wide + their sections' announcements
        tss_section_ids = [
            t.section_id for t in
            db.query(models.TeacherSubjectSection).filter(
                models.TeacherSubjectSection.teacher_id == current_user.id
            ).all()
        ]
        q = q.filter(
            (models.Announcement.scope == "school_wide")
            | (models.Announcement.section_id.in_(tss_section_ids))
        )
    # admins see all

    return q.order_by(models.Announcement.created_at.desc()).limit(50).all()


@router.post("/", response_model=schemas.AnnouncementOut)
def create_announcement(
    payload: schemas.AnnouncementCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_roles = {r.role for r in current_user.roles}

    if payload.scope == "school_wide" and not user_roles.intersection(set(BROADCAST_ROLES)):
        raise HTTPException(403, "Only coordinators/principals can broadcast school-wide")

    if payload.scope == "class_wide" and not user_roles.intersection(set(CLASS_BROADCAST_ROLES)):
        raise HTTPException(403, "Insufficient role for class broadcast")

    ann = models.Announcement(
        author_id=current_user.id,
        title=payload.title,
        content=payload.content,
        scope=payload.scope,
        section_id=payload.section_id,
        priority=payload.priority,
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return ann


@router.delete("/{ann_id}", status_code=204)
def delete_announcement(
    ann_id: int,
    current_user: models.User = Depends(require_roles(*BROADCAST_ROLES)),
    db: Session = Depends(get_db),
):
    ann = db.query(models.Announcement).filter(models.Announcement.id == ann_id).first()
    if not ann:
        raise HTTPException(404, "Announcement not found")
    db.delete(ann)
    db.commit()
