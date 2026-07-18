"""
Student personal tools: Notes, Progress, Projects, AI Tutor chat, Library.
"""
import os
import re
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from auth import get_current_user, get_file_user, require_roles
from database import get_db

router = APIRouter(tags=["student-tools"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_user(db: Session, current_user: models.User) -> models.User:
    return current_user


# ════════════════════════════════════════════════════
#  NOTES
# ════════════════════════════════════════════════════

class NoteCreate(BaseModel):
    title: str = "Untitled Note"
    content: str = ""

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    canvas_data: Optional[str] = None

class NoteOut(BaseModel):
    id: int
    title: str
    content: str
    canvas_data: Optional[str]
    created_at: str
    updated_at: str
    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_safe(cls, note: models.Note) -> "NoteOut":
        return cls(
            id=note.id,
            title=note.title or "",
            content=note.content or "",
            canvas_data=note.canvas_data,
            created_at=note.created_at.isoformat() if note.created_at else "",
            updated_at=note.updated_at.isoformat() if note.updated_at else "",
        )


@router.get("/notes")
def list_notes(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    notes = db.query(models.Note).filter(models.Note.user_id == current_user.id).order_by(models.Note.updated_at.desc()).all()
    return [NoteOut.from_orm_safe(n) for n in notes]


@router.post("/notes")
def create_note(payload: NoteCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = models.Note(user_id=current_user.id, title=payload.title, content=payload.content)
    db.add(note)
    db.commit()
    db.refresh(note)
    return NoteOut.from_orm_safe(note)


@router.put("/notes/{note_id}")
def update_note(note_id: int, payload: NoteUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(models.Note).filter(models.Note.id == note_id, models.Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(404, "Note not found")
    if payload.title is not None:
        note.title = payload.title
    if payload.content is not None:
        note.content = payload.content
    if payload.canvas_data is not None:
        note.canvas_data = payload.canvas_data
    db.commit()
    db.refresh(note)
    return NoteOut.from_orm_safe(note)


@router.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(models.Note).filter(models.Note.id == note_id, models.Note.user_id == current_user.id).first()
    if not note:
        raise HTTPException(404, "Note not found")
    db.delete(note)
    db.commit()


# ════════════════════════════════════════════════════
#  PROGRESS LOGS
# ════════════════════════════════════════════════════

class ProgressCreate(BaseModel):
    activity: str
    subject: str = ""
    duration_minutes: int = 30
    mastery_score: Optional[int] = None


@router.get("/progress")
def list_progress(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    logs = db.query(models.ProgressLog).filter(models.ProgressLog.user_id == current_user.id).order_by(models.ProgressLog.created_at.desc()).all()
    return [
        {
            "id": l.id,
            "activity": l.activity,
            "subject": l.subject,
            "duration_minutes": l.duration_minutes,
            "mastery_score": l.mastery_score,
            "created_at": l.created_at.isoformat(),
        }
        for l in logs
    ]


@router.post("/progress")
def log_progress(payload: ProgressCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    log = models.ProgressLog(
        user_id=current_user.id,
        activity=payload.activity,
        subject=payload.subject,
        duration_minutes=payload.duration_minutes,
        mastery_score=payload.mastery_score,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return {
        "id": log.id,
        "activity": log.activity,
        "subject": log.subject,
        "duration_minutes": log.duration_minutes,
        "mastery_score": log.mastery_score,
        "created_at": log.created_at.isoformat(),
    }


# ════════════════════════════════════════════════════
#  PROJECTS
# ════════════════════════════════════════════════════

class ProjectCreate(BaseModel):
    title: str
    description: str = ""
    subject: str = ""


class ProjectBrainstorm(BaseModel):
    prompt: str


@router.get("/projects")
def list_projects(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    projects = db.query(models.Project).filter(models.Project.user_id == current_user.id).order_by(models.Project.updated_at.desc()).all()
    return [
        {
            "id": p.id,
            "title": p.title,
            "description": p.description,
            "subject": p.subject,
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        }
        for p in projects
    ]


@router.post("/projects")
def create_project(payload: ProjectCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = models.Project(user_id=current_user.id, **payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return {
        "id": project.id,
        "title": project.title,
        "description": project.description,
        "subject": project.subject,
        "status": project.status,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "updated_at": project.updated_at.isoformat() if project.updated_at else None,
    }


@router.put("/projects/{project_id}")
def update_project_status(project_id: int, status: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id, models.Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    project.status = status
    db.commit()
    return {"status": project.status}


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id, models.Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    db.delete(project)
    db.commit()


@router.post("/projects/{project_id}/brainstorm")
def brainstorm(project_id: int, payload: ProjectBrainstorm, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id, models.Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    import anthropic
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))
    context = f"Project: {project.title}\nSubject: {project.subject}\nDescription: {project.description}"
    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=800,
            messages=[{
                "role": "user",
                "content": f"{context}\n\nStudent request: {payload.prompt}"
            }],
        )
        return {"response": message.content[0].text}
    except Exception as e:
        raise HTTPException(500, f"AI error: {e}")


# ════════════════════════════════════════════════════
#  AI TUTOR  (Socratic chat — Claude)
# ════════════════════════════════════════════════════

class ChatMessage(BaseModel):
    role: str   # "user" | "model"
    content: str

class AIChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


@router.post("/ai/chat")
def ai_chat(payload: AIChatRequest, current_user: models.User = Depends(get_current_user)):
    import anthropic
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY", ""))

    system = (
        "You are a Socratic AI tutor for school students. "
        "Never give direct answers — guide the student to discover the answer themselves "
        "through leading questions, hints, and encouragement. "
        "Be warm, patient, and age-appropriate. Keep responses concise (2-4 sentences or a short question)."
    )

    messages = [
        {"role": "user" if m.role == "user" else "assistant", "content": m.content}
        for m in payload.history
    ]
    messages.append({"role": "user", "content": payload.message})

    try:
        resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            system=system,
            messages=messages,
        )
        return {"response": resp.content[0].text}
    except Exception as e:
        raise HTTPException(500, f"AI error: {e}")



# ════════════════════════════════════════════════════
#  LIBRARY  (filesystem-backed: backend/library_assets/)
# ════════════════════════════════════════════════════
#  Drop content into a folder tree and it shows up in the library:
#
#    library_assets/<Board>/<Class N>/<Subject>/<Chapter>/<file>
#
#  e.g. library_assets/CBSE/Class 10/Mathematics/Real Numbers/overview.pdf
#
#  The scanner indexes every file and tags it with board/grade/subject/chapter
#  taken from its folder path, so the frontend filter bar just works. Any file
#  type is supported; the viewer renders PDFs/HTML in an iframe, videos in a
#  <video> tag, images in an <img>, and offers a download for everything else.

LIBRARY_DIR = Path(__file__).parent.parent / "library_assets"

# extension -> (resource type, mime type)
_LIBRARY_EXT = {
    "pdf":  ("pdf",      "application/pdf"),
    "html": ("article",  "text/html; charset=utf-8"),
    "htm":  ("article",  "text/html; charset=utf-8"),
    "txt":  ("article",  "text/plain; charset=utf-8"),
    "md":   ("article",  "text/plain; charset=utf-8"),
    "mp4":  ("video",    "video/mp4"),
    "webm": ("video",    "video/webm"),
    "mov":  ("video",    "video/quicktime"),
    "m4v":  ("video",    "video/mp4"),
    "png":  ("image",    "image/png"),
    "jpg":  ("image",    "image/jpeg"),
    "jpeg": ("image",    "image/jpeg"),
    "gif":  ("image",    "image/gif"),
    "webp": ("image",    "image/webp"),
    "svg":  ("image",    "image/svg+xml"),
    "doc":  ("document", "application/msword"),
    "docx": ("document", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    "ppt":  ("document", "application/vnd.ms-powerpoint"),
    "pptx": ("document", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
    "xls":  ("document", "application/vnd.ms-excel"),
    "xlsx": ("document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "epub": ("ebook",    "application/epub+zip"),
    "mp3":  ("audio",    "audio/mpeg"),
    "wav":  ("audio",    "audio/wav"),
}


def _grade_from_folder(name: str) -> int:
    """'Class 10' / 'Class_10' / 'Grade 10' / '10' -> 10. No digits -> 0."""
    m = re.search(r"\d+", name)
    return int(m.group()) if m else 0


def _scan_library() -> list[dict]:
    if not LIBRARY_DIR.exists():
        return []
    resources: list[dict] = []
    for path in sorted(LIBRARY_DIR.rglob("*")):
        if not path.is_file():
            continue
        if path.name.startswith(".") or path.name.upper() == "README.MD":
            continue
        rel = path.relative_to(LIBRARY_DIR)
        parts = rel.parts  # (board, grade, subject, chapter, filename, ...)
        ext = path.suffix.lower().lstrip(".")
        kind, mime = _LIBRARY_EXT.get(ext, ("file", "application/octet-stream"))
        board = parts[0] if len(parts) >= 2 else "Unsorted"
        grade = _grade_from_folder(parts[1]) if len(parts) >= 3 else 0
        subject = parts[2] if len(parts) >= 4 else "General"
        chapter = parts[3] if len(parts) >= 5 else "General"
        title = path.stem
        resources.append({
            "id": str(rel).replace("\\", "/"),
            "title": title,
            "board": board,
            "grade": grade,
            "subject": subject,
            "chapter": chapter,
            "type": kind,
            "ext": ext,
            "mime": mime,
            "path": str(rel).replace("\\", "/"),
            "size": path.stat().st_size,
        })
    return resources


@router.get("/library")
def get_library(current_user: models.User = Depends(get_current_user)):
    """Return every file under library_assets/ tagged by its folder path."""
    return _scan_library()


@router.get("/library/asset")
def library_asset(
    p: str = Query(..., description="Relative path of the asset under library_assets/"),
    current_user: models.User = Depends(get_file_user),
):
    """Serve a library file for in-app viewing. Auth accepts a Bearer header OR
    a `?token=` query param, since the iframe/video src can't set headers.
    """
    # Resolve and guard against path traversal outside library_assets/.
    base = LIBRARY_DIR.resolve()
    target = (base / p).resolve()
    try:
        target.relative_to(base)
    except ValueError:
        raise HTTPException(403, "Path is outside the library.")
    if not target.is_file():
        raise HTTPException(404, "This resource hasn't been added to the library yet.")
    ext = target.suffix.lower().lstrip(".")
    _, mime = _LIBRARY_EXT.get(ext, ("file", "application/octet-stream"))
    # `inline` so PDFs/HTML render in the iframe instead of downloading.
    return FileResponse(
        str(target),
        media_type=mime,
        headers={"Content-Disposition": f'inline; filename="{target.name}"'},
    )
