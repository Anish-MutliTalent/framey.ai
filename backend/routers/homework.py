"""
Teacher homework/classwork entry system.
A single HomeworkEntry covers one (section, subject, date) — it holds both
classwork notes and homework tasks. Saving one always auto-creates/updates
DiaryEntry records for every student in the section.
"""
import mimetypes
import uuid
from datetime import date as date_type, datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from auth import get_file_user, require_roles
from database import get_db

router = APIRouter(prefix="/homework", tags=["homework"])

MARK_ROLES = ("teacher", "class_teacher", "coordinator", "principal", "tech_admin")


# ── Schemas ───────────────────────────────────────────────────────────────────

class HomeworkUpsert(BaseModel):
    section_id: int
    subject_id: int
    date: date_type
    classwork_title: Optional[str] = None
    classwork_description: Optional[str] = None
    homework_title: Optional[str] = None
    homework_description: Optional[str] = None
    homework_due_date: Optional[datetime] = None


def _fmt(e: models.HomeworkEntry) -> dict:
    return {
        "id": e.id,
        "teacher_id": e.teacher_id,
        "section_id": e.section_id,
        "subject_id": e.subject_id,
        "subject_name": e.subject.name,
        "subject_color": e.subject.color,
        "section_name": f"{e.section.class_.name} {e.section.name}",
        "date": e.date.isoformat(),
        "classwork_title": e.classwork_title,
        "classwork_description": e.classwork_description,
        "homework_title": e.homework_title,
        "homework_description": e.homework_description,
        "homework_due_date": e.homework_due_date.isoformat() if e.homework_due_date else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


def _sync_diary_entries(entry: models.HomeworkEntry, db: Session):
    """Create or update DiaryEntry records for all students in the section."""
    students = db.query(models.Student).filter(
        models.Student.section_id == entry.section_id
    ).all()

    for student in students:
        existing = db.query(models.DiaryEntry).filter(
            models.DiaryEntry.homework_entry_id == entry.id,
            models.DiaryEntry.student_id == student.id,
        ).first()

        # Build title and description from whichever fields are filled
        parts = []
        if entry.classwork_title:
            parts.append(f"Classwork: {entry.classwork_title}")
        if entry.homework_title:
            parts.append(f"Homework: {entry.homework_title}")
        title = " | ".join(parts) if parts else "Entry"

        desc_parts = []
        if entry.classwork_description:
            desc_parts.append(f"[Classwork] {entry.classwork_description}")
        if entry.homework_description:
            desc_parts.append(f"[Homework] {entry.homework_description}")
        description = "\n".join(desc_parts) if desc_parts else None

        if existing:
            existing.title = title
            existing.description = description
            existing.due_date = entry.homework_due_date
            existing.subject_id = entry.subject_id
        else:
            db.add(models.DiaryEntry(
                student_id=student.id,
                homework_entry_id=entry.id,
                title=title,
                description=description,
                due_date=entry.homework_due_date,
                subject_id=entry.subject_id,
            ))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/entry")
def upsert_entry(
    payload: HomeworkUpsert,
    current_user: models.User = Depends(require_roles(*MARK_ROLES)),
    db: Session = Depends(get_db),
):
    """Create or update a homework/classwork entry. Merges into existing record for same section+subject+date."""
    existing = db.query(models.HomeworkEntry).filter(
        models.HomeworkEntry.section_id == payload.section_id,
        models.HomeworkEntry.subject_id == payload.subject_id,
        models.HomeworkEntry.date == payload.date,
    ).first()

    if existing:
        # Merge — only overwrite fields that are explicitly provided (non-None)
        if payload.classwork_title is not None:
            existing.classwork_title = payload.classwork_title
        if payload.classwork_description is not None:
            existing.classwork_description = payload.classwork_description
        if payload.homework_title is not None:
            existing.homework_title = payload.homework_title
        if payload.homework_description is not None:
            existing.homework_description = payload.homework_description
        if payload.homework_due_date is not None:
            existing.homework_due_date = payload.homework_due_date
        entry = existing
    else:
        entry = models.HomeworkEntry(
            teacher_id=current_user.id,
            section_id=payload.section_id,
            subject_id=payload.subject_id,
            date=payload.date,
            classwork_title=payload.classwork_title,
            classwork_description=payload.classwork_description,
            homework_title=payload.homework_title,
            homework_description=payload.homework_description,
            homework_due_date=payload.homework_due_date,
        )
        db.add(entry)

    db.flush()
    _sync_diary_entries(entry, db)
    db.commit()
    db.refresh(entry)
    return _fmt(entry)


@router.get("/section/{section_id}")
def get_section_entries(
    section_id: int,
    _: models.User = Depends(require_roles(*MARK_ROLES)),
    db: Session = Depends(get_db),
):
    """Return all homework entries for a section, newest first."""
    entries = (
        db.query(models.HomeworkEntry)
        .filter(models.HomeworkEntry.section_id == section_id)
        .order_by(models.HomeworkEntry.date.desc())
        .all()
    )
    return [_fmt(e) for e in entries]


@router.get("/section/{section_id}/date/{date_str}")
def get_entry_for_date(
    section_id: int,
    date_str: str,
    subject_id: Optional[int] = None,
    _: models.User = Depends(require_roles(*MARK_ROLES)),
    db: Session = Depends(get_db),
):
    """Return entry for a specific section+date (optionally filtered by subject)."""
    q = db.query(models.HomeworkEntry).filter(
        models.HomeworkEntry.section_id == section_id,
        models.HomeworkEntry.date == date_type.fromisoformat(date_str),
    )
    if subject_id:
        q = q.filter(models.HomeworkEntry.subject_id == subject_id)
    entries = q.all()
    return [_fmt(e) for e in entries]


@router.delete("/entry/{entry_id}", status_code=204)
def delete_entry(
    entry_id: int,
    current_user: models.User = Depends(require_roles(*MARK_ROLES)),
    db: Session = Depends(get_db),
):
    entry = db.query(models.HomeworkEntry).filter(models.HomeworkEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(404, "Entry not found")
    if entry.teacher_id != current_user.id:
        user_roles = {r.role for r in current_user.roles}
        if not user_roles.intersection({"coordinator", "principal", "tech_admin"}):
            raise HTTPException(403, "Not authorized")
    db.delete(entry)
    db.commit()


# ════════════════════════════════════════════════════
#  FILE ATTACHMENTS  (teacher attaches PDFs / docs)
# ════════════════════════════════════════════════════

HW_UPLOAD_ROOT = Path(__file__).parent.parent / "uploads" / "homework"
HW_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

ALLOWED_HW_TYPES = {
    ".pdf": "pdf", ".docx": "docx", ".doc": "docx",
    ".pptx": "pptx", ".ppt": "pptx",
    ".png": "image", ".jpg": "image", ".jpeg": "image",
    ".txt": "text", ".md": "text",
}


@router.post("/entry/{entry_id}/files")
async def upload_homework_file(
    entry_id: int,
    file: UploadFile = File(...),
    current_user: models.User = Depends(require_roles(*MARK_ROLES)),
    db: Session = Depends(get_db),
):
    entry = db.query(models.HomeworkEntry).filter(models.HomeworkEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(404, "Entry not found")

    suffix = Path(file.filename or "file").suffix.lower()
    file_type = ALLOWED_HW_TYPES.get(suffix, "other")
    content = await file.read()
    stored_name = f"{uuid.uuid4().hex}{suffix}"

    dest_dir = HW_UPLOAD_ROOT / str(entry_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    (dest_dir / stored_name).write_bytes(content)

    hw_file = models.HomeworkFile(
        homework_entry_id=entry_id,
        uploaded_by=current_user.id,
        original_name=file.filename or stored_name,
        stored_name=stored_name,
        file_type=file_type,
        size_bytes=len(content),
    )
    db.add(hw_file)
    db.commit()
    db.refresh(hw_file)
    return {
        "id": hw_file.id,
        "original_name": hw_file.original_name,
        "file_type": hw_file.file_type,
        "size_bytes": hw_file.size_bytes,
    }


@router.get("/files/{file_id}/raw")
def serve_homework_file(
    file_id: int,
    _: models.User = Depends(get_file_user),   # accepts ?token= so browsers can open directly
    db: Session = Depends(get_db),
):
    hw_file = db.query(models.HomeworkFile).filter(models.HomeworkFile.id == file_id).first()
    if not hw_file:
        raise HTTPException(404, "File not found")
    path = HW_UPLOAD_ROOT / str(hw_file.homework_entry_id) / hw_file.stored_name
    if not path.exists():
        raise HTTPException(404, "File not on disk")
    mime = mimetypes.guess_type(hw_file.original_name)[0] or "application/octet-stream"
    return FileResponse(str(path), media_type=mime, filename=hw_file.original_name)


@router.delete("/files/{file_id}", status_code=204)
def delete_homework_file(
    file_id: int,
    _: models.User = Depends(require_roles(*MARK_ROLES)),
    db: Session = Depends(get_db),
):
    hw_file = db.query(models.HomeworkFile).filter(models.HomeworkFile.id == file_id).first()
    if not hw_file:
        raise HTTPException(404, "File not found")
    path = HW_UPLOAD_ROOT / str(hw_file.homework_entry_id) / hw_file.stored_name
    if path.exists():
        path.unlink()
    db.delete(hw_file)
    db.commit()
