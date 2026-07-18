"""
Google Classroom-style classroom API.

A "classroom" is implicit: (section_id, subject_id). Each (section, subject) pair that a
student is enrolled in (or that a teacher is assigned to via TeacherSubjectSection)
becomes its own classroom page with its own stream, classwork, and people list.
"""
import mimetypes
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

import models
from auth import get_current_user, get_file_user
from database import get_db

router = APIRouter(prefix="/classroom", tags=["classroom"])

# ── Storage for attachments ────────────────────────────────────────────────────
UPLOAD_ROOT = Path(__file__).parent.parent / "uploads" / "classroom"
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

ALLOWED_TYPES = {
    ".pdf": "pdf", ".doc": "docx", ".docx": "docx",
    ".ppt": "pptx", ".pptx": "pptx",
    ".png": "image", ".jpg": "image", ".jpeg": "image", ".gif": "image",
    ".txt": "text", ".md": "text",
    ".zip": "other", ".csv": "other",
}

MAX_UPLOAD_MB = 50


# ── Access helpers ─────────────────────────────────────────────────────────────
def _is_class_member(user: models.User, section_id: int, subject_id: int, db: Session) -> bool:
    """True if user belongs to this (section, subject) classroom."""
    user_roles = {r.role for r in user.roles}
    if user_roles.intersection({"coordinator", "principal", "tech_admin"}):
        return True
    if "student" in user_roles and not user_roles.intersection({"teacher", "class_teacher"}):
        student = db.query(models.Student).filter(models.Student.user_id == user.id).first()
        if not student or student.section_id != section_id:
            return False
        # Confirm this subject is taught in the student's section
        return db.query(models.TeacherSubjectSection).filter(
            models.TeacherSubjectSection.section_id == section_id,
            models.TeacherSubjectSection.subject_id == subject_id,
        ).first() is not None
    # Teacher / class teacher — must be assigned to (section, subject) OR be class teacher
    if user_roles.intersection({"class_teacher"}):
        sec = db.query(models.Section).filter(
            models.Section.id == section_id,
            models.Section.class_teacher_id == user.id,
        ).first()
        if sec:
            return True
    return db.query(models.TeacherSubjectSection).filter(
        models.TeacherSubjectSection.teacher_id == user.id,
        models.TeacherSubjectSection.section_id == section_id,
        models.TeacherSubjectSection.subject_id == subject_id,
    ).first() is not None


def _assert_classroom_access(user: models.User, section_id: int, subject_id: int, db: Session):
    if not _is_class_member(user, section_id, subject_id, db):
        raise HTTPException(403, "You are not a member of this classroom")


# ── Custom (named) classroom access ───────────────────────────────────────────
def _is_custom_class_member(user: models.User, classroom_id: int, db: Session) -> bool:
    user_roles = {r.role for r in user.roles}
    if user_roles.intersection({"coordinator", "principal", "tech_admin"}):
        return True
    cc = db.query(models.CustomClassroom).filter(models.CustomClassroom.id == classroom_id).first()
    if not cc:
        return False
    if cc.teacher_id == user.id:
        return True
    if "student" in user_roles:
        student = db.query(models.Student).filter(models.Student.user_id == user.id).first()
        if student:
            return db.query(models.CustomClassroomStudent).filter(
                models.CustomClassroomStudent.classroom_id == classroom_id,
                models.CustomClassroomStudent.student_id == student.id,
            ).first() is not None
    return False


def _assert_custom_classroom_access(user: models.User, classroom_id: int, db: Session):
    if not _is_custom_class_member(user, classroom_id, db):
        raise HTTPException(403, "You are not a member of this classroom")


def _assert_post_access(user: models.User, post: models.ClassroomPost, db: Session):
    """Unified access check for any post — section/subject OR custom classroom."""
    if post.custom_classroom_id:
        _assert_custom_classroom_access(user, post.custom_classroom_id, db)
    else:
        _assert_classroom_access(user, post.section_id, post.subject_id, db)


# ── File storage paths (work for both section/subject and custom classrooms) ──
def _post_files_dir(post: models.ClassroomPost) -> Path:
    if post.custom_classroom_id:
        return UPLOAD_ROOT / "custom" / str(post.custom_classroom_id) / str(post.id)
    section = post.section_id if post.section_id is not None else "x"
    subject = post.subject_id if post.subject_id is not None else "x"
    return UPLOAD_ROOT / str(section) / str(subject) / str(post.id)


def _submission_files_dir(sub: models.Submission, post: models.ClassroomPost) -> Path:
    if post.custom_classroom_id:
        return UPLOAD_ROOT / "custom" / str(post.custom_classroom_id) / "submissions" / str(sub.id)
    section = post.section_id if post.section_id is not None else "x"
    subject = post.subject_id if post.subject_id is not None else "x"
    return UPLOAD_ROOT / str(section) / str(subject) / "submissions" / str(sub.id)


def _published_clause():
    """SQL filter: post is published (not a draft, and scheduled time has passed)."""
    from datetime import datetime
    return and_(
        models.ClassroomPost.is_draft == False,  # noqa: E712
        or_(models.ClassroomPost.scheduled_at == None,  # noqa: E711
            models.ClassroomPost.scheduled_at <= datetime.utcnow()),
    )


def _user_primary_role(user: models.User) -> str | None:
    """Pick a single display role for a user (User has `roles`, not `role`)."""
    if not user or not user.roles:
        return None
    priority = ["tech_admin", "principal", "coordinator", "class_teacher", "teacher", "student"]
    roles = {r.role for r in user.roles}
    return next((r for r in priority if r in roles), user.roles[0].role)


def _fmt_user(u: models.User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "avatar_url": u.avatar_url,
        "role": _user_primary_role(u),
    }


def _fmt_post(p: models.ClassroomPost) -> dict:
    return {
        "id": p.id,
        "section_id": p.section_id,
        "subject_id": p.subject_id,
        "custom_classroom_id": p.custom_classroom_id,
        "subject_name": p.subject.name if p.subject else None,
        "subject_color": p.subject.color if p.subject else None,
        "author": _fmt_user(p.author) if p.author else None,
        "post_type": p.post_type,
        "title": p.title,
        "content": p.content,
        "topic": p.topic,
        "is_draft": p.is_draft,
        "scheduled_at": p.scheduled_at,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
        "comments": [
            {
                "id": c.id,
                "author": _fmt_user(c.author) if c.author else None,
                "author_role": _user_primary_role(c.author),
                "content": c.content,
                "created_at": c.created_at,
            }
            for c in p.comments
        ],
        "files": [_fmt_file(f) for f in p.files],
        "assignment": {
            "id": p.assignment.id,
            "subject": p.assignment.subject,
            "due_date": p.assignment.due_date,
            "max_marks": p.assignment.max_marks,
            "is_homework": p.assignment.is_homework,
        } if p.assignment else None,
    }


def _fmt_file(f: models.ClassroomPostFile) -> dict:
    return {
        "id": f.id,
        "original_name": f.original_name,
        "file_type": f.file_type,
        "size_bytes": f.size_bytes,
        "mime_type": f.mime_type,
        "uploaded_by": f.uploader.name if f.uploader else None,
        "created_at": f.created_at,
    }


def _fmt_submission(s: models.Submission, db: Session) -> dict:
    project = None
    if s.project_id and s.project:
        project = {
            "id": s.project.id,
            "title": s.project.title,
            "files": _project_files_list(s.project.id, db),
        }
    return {
        "id": s.id,
        "student": {"id": s.student.id, "name": s.student.user.name} if s.student else None,
        "content": s.content,
        "submitted_at": s.submitted_at,
        "marks_obtained": s.marks_obtained,
        "feedback": s.feedback,
        "marked_done": s.marked_done,
        "project": project,
        "files": [
            {
                "id": f.id,
                "original_name": f.original_name,
                "mime_type": f.mime_type,
                "size_bytes": f.size_bytes,
                "uploaded_at": f.uploaded_at,
            }
            for f in s.files
        ],
    }


def _fmt_project_file(f: models.ProjectFile) -> dict:
    return {
        "id": f.id,
        "original_name": f.original_name,
        "file_type": f.file_type,
        "mime_type": f.mime_type,
        "size_bytes": f.size_bytes,
        "is_submitted": f.is_submitted,
    }


def _project_files_list(project_id: int, db: Session) -> list:
    files = db.query(models.ProjectFile).filter(
        models.ProjectFile.project_id == project_id
    ).order_by(models.ProjectFile.created_at).all()
    return [_fmt_project_file(f) for f in files]


# ── Classes list (homepage) ────────────────────────────────────────────────────
@router.get("/classes")
def list_my_classes(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all classrooms (section, subject pairs) the current user belongs to."""
    user_roles = {r.role for r in current_user.roles}

    # Build the set of (section_id, subject_id) pairs this user has access to
    pairs: list[tuple[int, int]] = []

    if user_roles.intersection({"coordinator", "principal", "tech_admin"}):
        # Admins see all assigned classroom pairs in the school
        all_tss = db.query(models.TeacherSubjectSection).all()
        for t in all_tss:
            pairs.append((t.section_id, t.subject_id))
    elif "student" in user_roles and not user_roles.intersection({"teacher", "class_teacher"}):
        student = db.query(models.Student).filter(models.Student.user_id == current_user.id).first()
        if student:
            tss = db.query(models.TeacherSubjectSection).filter(
                models.TeacherSubjectSection.section_id == student.section_id,
            ).all()
            for t in tss:
                pairs.append((t.section_id, t.subject_id))
        else:
            return []
    else:
        # Teacher / class teacher
        if user_roles.intersection({"class_teacher"}):
            secs = db.query(models.Section).filter(
                models.Section.class_teacher_id == current_user.id
            ).all()
            for s in secs:
                tss = db.query(models.TeacherSubjectSection).filter(
                    models.TeacherSubjectSection.section_id == s.id,
                ).all()
                for t in tss:
                    pairs.append((t.section_id, t.subject_id))
        tss = db.query(models.TeacherSubjectSection).filter(
            models.TeacherSubjectSection.teacher_id == current_user.id,
        ).all()
        for t in tss:
            pairs.append((t.section_id, t.subject_id))

    # Deduplicate
    pairs = list(set(pairs))

    classes = []
    for sec_id, sub_id in pairs:
        sec = db.query(models.Section).filter(models.Section.id == sec_id).first()
        sub = db.query(models.Subject).filter(models.Subject.id == sub_id).first()
        if not sec or not sub:
            continue

        # Last post in this classroom (any post_type)
        latest = db.query(models.ClassroomPost).filter(
            models.ClassroomPost.section_id == sec_id,
            models.ClassroomPost.subject_id == sub_id,
        ).order_by(models.ClassroomPost.created_at.desc()).first()

        tss = db.query(models.TeacherSubjectSection).filter(
            models.TeacherSubjectSection.section_id == sec_id,
            models.TeacherSubjectSection.subject_id == sub_id,
            models.TeacherSubjectSection.teacher_id == current_user.id,
        ).first() if user_roles.intersection({"teacher", "class_teacher"}) else None

        class_teacher_name = sec.class_teacher.name if sec.class_teacher else None
        teacher_name = tss.teacher.name if tss else class_teacher_name or "Faculty"

        # Section label = short, e.g. "9A"
        class_name = sec.class_.name if sec.class_ else ""
        section_label = f"{class_name.replace('Grade ', '').replace('Class ', '')}{sec.name}"

        classes.append({
            "section_id": sec_id,
            "section_name": f"{class_name} {sec.name}",
            "section_label": section_label,
            "subject_id": sub_id,
            "subject_name": sub.name,
            "subject_color": sub.color,
            "subject_code": sub.code,
            "class_teacher_name": class_teacher_name,
            "teacher_name": teacher_name,
            "last_post_title": latest.title if latest else None,
            "last_post_at": latest.created_at if latest else None,
        })

    # Sort by most-recent activity
    classes.sort(key=lambda c: c.get("last_post_at") or 0, reverse=True)
    return classes


# ── Posts in a single classroom ────────────────────────────────────────────────
@router.get("/sections/{section_id}/subjects/{subject_id}/posts")
def list_posts(
    section_id: int,
    subject_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_classroom_access(current_user, section_id, subject_id, db)
    posts = (
        db.query(models.ClassroomPost)
        .filter(
            models.ClassroomPost.section_id == section_id,
            models.ClassroomPost.subject_id == subject_id,
            _published_clause(),
        )
        .order_by(models.ClassroomPost.created_at.desc())
        .all()
    )
    return [_fmt_post(p) for p in posts]


@router.get("/posts/{post_id}")
def get_post(
    post_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch a single post (any classroom) — used by the post detail page."""
    post = db.query(models.ClassroomPost).filter(models.ClassroomPost.id == post_id).first()
    if not post:
        raise HTTPException(404, "Post not found")
    _assert_post_access(current_user, post, db)
    return _fmt_post(post)


@router.post("/sections/{section_id}/subjects/{subject_id}/posts")
async def create_post(
    section_id: int,
    subject_id: int,
    post_type: str = Form(...),
    title: str = Form(default=""),
    content: str = Form(default=""),
    topic: str = Form(default=""),
    due_date: str = Form(default=""),               # ISO datetime or empty
    max_marks: int = Form(default=100),
    is_draft: str = Form(default="false"),          # "true" | "false"
    scheduled_at: str = Form(default=""),           # ISO datetime or empty
    files: list[UploadFile] = File(default=[]),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a post (announcement / assignment / material) with optional file attachments.
    Any classroom member may post an announcement; only teachers may post assignments/materials."""
    user_roles = {r.role for r in current_user.roles}
    is_teacher = bool(user_roles.intersection({"teacher", "class_teacher", "coordinator", "principal", "tech_admin"}))
    if not is_teacher and post_type != "announcement":
        raise HTTPException(403, "Only teachers can post assignments and materials")
    if is_draft == "true" and not is_teacher:
        raise HTTPException(403, "Only teachers can save drafts")
    _assert_classroom_access(current_user, section_id, subject_id, db)

    from datetime import datetime as dt
    parsed_due = None
    if due_date:
        try:
            parsed_due = dt.fromisoformat(due_date)
        except ValueError:
            raise HTTPException(400, "Invalid due_date format")
    parsed_scheduled = None
    if scheduled_at:
        try:
            parsed_scheduled = dt.fromisoformat(scheduled_at)
        except ValueError:
            raise HTTPException(400, "Invalid scheduled_at format")

    post = models.ClassroomPost(
        section_id=section_id,
        subject_id=subject_id,
        author_id=current_user.id,
        post_type=post_type,
        title=title or None,
        content=content or None,
        topic=topic or None,
        is_draft=(is_draft == "true"),
        scheduled_at=parsed_scheduled,
    )
    db.add(post)
    db.flush()

    # If assignment type, create AssignmentPost linked
    if post_type == "assignment":
        db.add(models.AssignmentPost(
            post_id=post.id,
            subject_id=subject_id,
            due_date=parsed_due,
            max_marks=max_marks,
            is_homework=False,
        ))
    # Materials also can have a due_date for "reading by" type; ignored here
    elif post_type == "material":
        # use subject_id and a dummy due_date? skip — materials use only files
        pass

    # Save attachments
    for upload in files or []:
        if upload.filename is None or not upload.filename:
            continue
        suffix = Path(upload.filename).suffix.lower()
        file_type = ALLOWED_TYPES.get(suffix, "other")
        blob = await upload.read()
        stored_name = f"{uuid.uuid4().hex}{suffix}"
        dest_dir = _post_files_dir(post)
        dest_dir.mkdir(parents=True, exist_ok=True)
        (dest_dir / stored_name).write_bytes(blob)
        mime = mimetypes.guess_type(upload.filename)[0] or "application/octet-stream"
        db.add(models.ClassroomPostFile(
            post_id=post.id,
            uploaded_by=current_user.id,
            original_name=upload.filename,
            stored_name=stored_name,
            mime_type=mime,
            file_type=file_type,
            size_bytes=len(blob),
        ))

    db.commit()
    db.refresh(post)
    return _fmt_post(post)


@router.delete("/posts/{post_id}", status_code=204)
def delete_post(
    post_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(models.ClassroomPost).filter(models.ClassroomPost.id == post_id).first()
    if not post:
        raise HTTPException(404, "Post not found")
    user_roles = {r.role for r in current_user.roles}
    if post.author_id != current_user.id and not user_roles.intersection({"coordinator", "principal", "tech_admin"}):
        raise HTTPException(403, "Not authorized")
    db.delete(post)
    db.commit()


@router.patch("/posts/{post_id}")
async def update_post(
    post_id: int,
    title: str = Form(default=None),
    content: str = Form(default=None),
    topic: str = Form(default=None),
    due_date: str = Form(default=None),
    max_marks: Optional[int] = Form(default=None),
    is_draft: Optional[str] = Form(default=None),
    scheduled_at: str = Form(default=None),
    files: list[UploadFile] = File(default=[]),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Edit an existing assignment/material/announcement post.
    Only the author (or an admin) may edit. Fields sent as None are left untouched;
    fields sent as empty strings are cleared. New files are appended."""
    post = db.query(models.ClassroomPost).filter(models.ClassroomPost.id == post_id).first()
    if not post:
        raise HTTPException(404, "Post not found")
    user_roles = {r.role for r in current_user.roles}
    if post.author_id != current_user.id and not user_roles.intersection({"coordinator", "principal", "tech_admin"}):
        raise HTTPException(403, "Not authorized")

    from datetime import datetime as dt
    if title is not None:
        post.title = title or None
    if content is not None:
        post.content = content or None
    if topic is not None:
        post.topic = topic or None
    if is_draft is not None:
        post.is_draft = (is_draft == "true")
    if scheduled_at is not None:
        try:
            post.scheduled_at = dt.fromisoformat(scheduled_at) if scheduled_at else None
        except ValueError:
            raise HTTPException(400, "Invalid scheduled_at format")
    if post.assignment:
        if due_date is not None:
            try:
                post.assignment.due_date = dt.fromisoformat(due_date) if due_date else None
            except ValueError:
                raise HTTPException(400, "Invalid due_date format")
        if max_marks is not None:
            post.assignment.max_marks = max_marks

    # Append any newly attached files
    for upload in files or []:
        if upload.filename is None or not upload.filename:
            continue
        suffix = Path(upload.filename).suffix.lower()
        file_type = ALLOWED_TYPES.get(suffix, "other")
        blob = await upload.read()
        stored_name = f"{uuid.uuid4().hex}{suffix}"
        dest_dir = _post_files_dir(post)
        dest_dir.mkdir(parents=True, exist_ok=True)
        (dest_dir / stored_name).write_bytes(blob)
        mime = mimetypes.guess_type(upload.filename)[0] or "application/octet-stream"
        db.add(models.ClassroomPostFile(
            post_id=post.id,
            uploaded_by=current_user.id,
            original_name=upload.filename,
            stored_name=stored_name,
            mime_type=mime,
            file_type=file_type,
            size_bytes=len(blob),
        ))

    db.commit()
    db.refresh(post)
    return _fmt_post(post)


# ── Comments / replies on a post ──────────────────────────────────────────────
@router.get("/posts/{post_id}/comments")
def list_comments(
    post_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(models.ClassroomPost).filter(models.ClassroomPost.id == post_id).first()
    if not post:
        raise HTTPException(404, "Post not found")
    _assert_post_access(current_user, post, db)
    return [
        {
            "id": c.id,
            "author": _fmt_user(c.author) if c.author else None,
            "author_role": _user_primary_role(c.author),
            "content": c.content,
            "created_at": c.created_at,
        }
        for c in sorted(post.comments, key=lambda c: c.created_at)
    ]


class CommentCreatePayload(BaseModel):
    content: str


@router.post("/posts/{post_id}/comments")
def add_comment(
    post_id: int,
    payload: CommentCreatePayload,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(models.ClassroomPost).filter(models.ClassroomPost.id == post_id).first()
    if not post:
        raise HTTPException(404, "Post not found")
    _assert_post_access(current_user, post, db)
    comment = models.Comment(
        post_id=post_id,
        author_id=current_user.id,
        content=payload.content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return {
        "id": comment.id,
        "author": _fmt_user(comment.author) if comment.author else None,
        "author_role": _user_primary_role(comment.author),
        "content": comment.content,
        "created_at": comment.created_at,
    }


@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment(
    comment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(404, "Comment not found")
    user_roles = {r.role for r in current_user.roles}
    if comment.author_id != current_user.id and not user_roles.intersection({"coordinator", "principal", "tech_admin"}):
        raise HTTPException(403, "Not authorized")
    db.delete(comment)
    db.commit()


# ── Private comments (student ↔ teacher on a post) ───────────────────────────
def _fmt_private_comment(pc: models.PrivateComment) -> dict:
    return {
        "id": pc.id,
        "author": _fmt_user(pc.author) if pc.author else None,
        "student": {"id": pc.student.id, "name": pc.student.user.name} if pc.student else None,
        "content": pc.content,
        "created_at": pc.created_at,
    }


@router.get("/posts/{post_id}/private-comments")
def list_private_comments(
    post_id: int,
    student_id: Optional[int] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(models.ClassroomPost).filter(models.ClassroomPost.id == post_id).first()
    if not post:
        raise HTTPException(404, "Post not found")
    _assert_post_access(current_user, post, db)
    user_roles = {r.role for r in current_user.roles}
    q = db.query(models.PrivateComment).filter(models.PrivateComment.post_id == post_id)
    is_student = "student" in user_roles and not user_roles.intersection({"teacher", "class_teacher", "coordinator", "principal", "tech_admin"})
    if is_student:
        student = db.query(models.Student).filter(models.Student.user_id == current_user.id).first()
        if not student:
            return []
        q = q.filter(models.PrivateComment.student_id == student.id)
    elif student_id is not None:
        # Teacher viewing a specific student's private thread
        q = q.filter(models.PrivateComment.student_id == student_id)
    return [_fmt_private_comment(c) for c in q.order_by(models.PrivateComment.created_at).all()]


class PrivateCommentCreate(BaseModel):
    content: str
    student_id: Optional[int] = None   # required when a teacher replies


@router.post("/posts/{post_id}/private-comments")
def add_private_comment(
    post_id: int,
    payload: PrivateCommentCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(models.ClassroomPost).filter(models.ClassroomPost.id == post_id).first()
    if not post:
        raise HTTPException(404, "Post not found")
    _assert_post_access(current_user, post, db)
    user_roles = {r.role for r in current_user.roles}
    if "student" in user_roles and not user_roles.intersection({"teacher", "class_teacher", "coordinator", "principal", "tech_admin"}):
        student = db.query(models.Student).filter(models.Student.user_id == current_user.id).first()
        if not student:
            raise HTTPException(404, "Student profile not found")
        sid = student.id
    else:
        if not payload.student_id:
            raise HTTPException(400, "student_id is required for teacher replies")
        sid = payload.student_id
    pc = models.PrivateComment(
        post_id=post_id,
        student_id=sid,
        author_id=current_user.id,
        content=payload.content,
    )
    db.add(pc)
    db.commit()
    db.refresh(pc)
    return _fmt_private_comment(pc)


# ── Attach files to an existing post ───────────────────────────────────────────
@router.post("/posts/{post_id}/files")
async def add_post_file(
    post_id: int,
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(models.ClassroomPost).filter(models.ClassroomPost.id == post_id).first()
    if not post:
        raise HTTPException(404, "Post not found")
    user_roles = {r.role for r in current_user.roles}
    if post.author_id != current_user.id and not user_roles.intersection({"coordinator", "principal", "tech_admin"}):
        raise HTTPException(403, "Not authorized")

    suffix = Path(file.filename or "file").suffix.lower()
    blob = await file.read()
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    dest_dir = _post_files_dir(post)
    dest_dir.mkdir(parents=True, exist_ok=True)
    (dest_dir / stored_name).write_bytes(blob)
    mime = mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    cf = models.ClassroomPostFile(
        post_id=post.id,
        uploaded_by=current_user.id,
        original_name=file.filename or stored_name,
        stored_name=stored_name,
        file_type=ALLOWED_TYPES.get(suffix, "other"),
        mime_type=mime,
        size_bytes=len(blob),
    )
    db.add(cf)
    db.commit()
    db.refresh(cf)
    return _fmt_file(cf)


# ── File serving (browser-direct open with ?token=) ──────────────────────────
@router.get("/files/{file_id}/raw")
def serve_post_file(
    file_id: int,
    _: models.User = Depends(get_file_user),
    db: Session = Depends(get_db),
):
    cf = db.query(models.ClassroomPostFile).filter(models.ClassroomPostFile.id == file_id).first()
    if not cf:
        raise HTTPException(404, "File not found")
    path = _post_files_dir(cf.post) / cf.stored_name
    if not path.exists():
        raise HTTPException(404, "File not on disk")
    return FileResponse(str(path), media_type=cf.mime_type or "application/octet-stream",
                        filename=cf.original_name)


# ── Classwork tab (assignments + materials grouped by topic) ──────────────────
@router.get("/sections/{section_id}/subjects/{subject_id}/classwork")
def list_classwork(
    section_id: int,
    subject_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_classroom_access(current_user, section_id, subject_id, db)
    user_roles = {r.role for r in current_user.roles}
    is_teacher = bool(user_roles.intersection({"teacher", "class_teacher", "coordinator", "principal", "tech_admin"}))
    q = db.query(models.ClassroomPost).filter(
        models.ClassroomPost.section_id == section_id,
        models.ClassroomPost.subject_id == subject_id,
        models.ClassroomPost.post_type.in_(["assignment", "material"]),
    )
    if not is_teacher:
        q = q.filter(_published_clause())
    posts = q.order_by(models.ClassroomPost.created_at.desc()).all()

    # Group by topic
    topics: dict = {}
    for p in posts:
        key = p.topic or "General"
        topics.setdefault(key, []).append({
            "id": p.id,
            "type": p.post_type,
            "title": p.title,
            "content": p.content,
            "topic": p.topic,
            "is_draft": p.is_draft,
            "scheduled_at": p.scheduled_at.isoformat() if p.scheduled_at else None,
            "created_at": p.created_at.isoformat(),
            "due_date": p.assignment.due_date.isoformat() if p.assignment and p.assignment.due_date else None,
            "max_marks": p.assignment.max_marks if p.assignment else None,
            "files": [_fmt_file(f) for f in p.files],
        })
    return [{"topic": k, "items": v} for k, v in topics.items()]


# ── People tab ────────────────────────────────────────────────────────────────
@router.get("/sections/{section_id}/subjects/{subject_id}/people")
def list_people(
    section_id: int,
    subject_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_classroom_access(current_user, section_id, subject_id, db)

    section = db.query(models.Section).filter(models.Section.id == section_id).first()
    teachers = db.query(models.TeacherSubjectSection).filter(
        models.TeacherSubjectSection.section_id == section_id,
        models.TeacherSubjectSection.subject_id == subject_id,
    ).all()
    students = db.query(models.Student).filter(models.Student.section_id == section_id).all()
    return {
        "class_teacher": {
            "id": section.class_teacher.id,
            "name": section.class_teacher.name,
            "email": section.class_teacher.email,
            "avatar_url": section.class_teacher.avatar_url,
        } if section and section.class_teacher else None,
        "teachers": [
            {"id": t.teacher.id, "name": t.teacher.name, "email": t.teacher.email, "avatar_url": t.teacher.avatar_url}
            for t in teachers
        ],
        "students": [
            {"id": s.id, "name": s.user.name, "roll_number": s.roll_number, "avatar_url": s.user.avatar_url}
            for s in students
        ],
    }


# ── Submissions (assignment file submissions) ────────────────────────────────
@router.post("/assignments/{assignment_id}/submit")
async def submit_assignment(
    assignment_id: int,
    file: Optional[UploadFile] = File(default=None),
    content: str = Form(default=""),
    project_id: Optional[int] = Form(default=None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Student submits work to an assignment. Either file, text content, or both."""
    user_roles = {r.role for r in current_user.roles}
    if "student" not in user_roles:
        raise HTTPException(403, "Only students can submit assignments")

    student = db.query(models.Student).filter(models.Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(404, "Student profile not found")

    ap = db.query(models.AssignmentPost).filter(models.AssignmentPost.id == assignment_id).first()
    if not ap:
        raise HTTPException(404, "Assignment not found")

    # Verify student belongs to this classroom (section/subject OR custom)
    _assert_post_access(current_user, ap.post, db)

    # Find or create submission (unique on assignment, student)
    sub = db.query(models.Submission).filter(
        models.Submission.assignment_id == assignment_id,
        models.Submission.student_id == student.id,
    ).first()
    if sub:
        sub.content = content or sub.content
        if project_id is not None:
            sub.project_id = project_id
    else:
        sub = models.Submission(
            assignment_id=assignment_id,
            student_id=student.id,
            content=content or None,
            project_id=project_id,
        )
        db.add(sub)
        db.flush()

    # Attach uploaded file (replace existing if any)
    if file and file.filename:
        suffix = Path(file.filename).suffix.lower()
        blob = await file.read()
        stored_name = f"{uuid.uuid4().hex}{suffix}"
        dest_dir = _submission_files_dir(sub, ap.post)
        dest_dir.mkdir(parents=True, exist_ok=True)
        (dest_dir / stored_name).write_bytes(blob)
        mime = mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
        db.add(models.SubmissionFile(
            submission_id=sub.id,
            original_name=file.filename,
            stored_name=stored_name,
            mime_type=mime,
            size_bytes=len(blob),
        ))

    db.commit()
    db.refresh(sub)
    return _fmt_submission(sub, db)


@router.get("/assignments/{assignment_id}/submissions")
def list_submissions(
    assignment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_roles = {r.role for r in current_user.roles}
    if not user_roles.intersection({"teacher", "class_teacher", "coordinator", "principal", "tech_admin"}):
        raise HTTPException(403, "Only teachers can view submissions")

    subs = db.query(models.Submission).filter(
        models.Submission.assignment_id == assignment_id
    ).all()
    return [_fmt_submission(s, db) for s in subs]


def _submission_status(sub, due_date) -> str:
    """Compute a display status for a student's submission."""
    if sub and ((sub.content and sub.content.strip()) or (sub.files and len(sub.files) > 0) or sub.project_id):
        return "turned_in"
    if sub and sub.marked_done:
        return "marked_done"
    if due_date and due_date < datetime.utcnow():
        return "missing"
    return "due"


def _roster_for_post(post: models.ClassroomPost, db: Session) -> list:
    """Return the list of student records for a post's classroom."""
    if post.custom_classroom_id:
        rows = db.query(models.CustomClassroomStudent).filter(
            models.CustomClassroomStudent.classroom_id == post.custom_classroom_id
        ).all()
        return [r.student for r in rows]
    if post.section_id:
        return db.query(models.Student).filter(models.Student.section_id == post.section_id).all()
    return []


@router.get("/assignments/{assignment_id}/student-work")
def get_student_work(
    assignment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Teacher view: all students in the classroom with their submission status."""
    user_roles = {r.role for r in current_user.roles}
    if not user_roles.intersection({"teacher", "class_teacher", "coordinator", "principal", "tech_admin"}):
        raise HTTPException(403, "Only teachers can view student work")
    ap = db.query(models.AssignmentPost).filter(models.AssignmentPost.id == assignment_id).first()
    if not ap:
        raise HTTPException(404, "Assignment not found")
    _assert_post_access(current_user, ap.post, db)

    roster = _roster_for_post(ap.post, db)
    subs = {s.student_id: s for s in db.query(models.Submission).filter(
        models.Submission.assignment_id == assignment_id).all()}
    due = ap.due_date
    out = []
    for st in roster:
        sub = subs.get(st.id)
        out.append({
            "student": {
                "id": st.id,
                "name": st.user.name,
                "roll_number": st.roll_number,
                "avatar_url": st.user.avatar_url,
            },
            "status": _submission_status(sub, due),
            "submission": _fmt_submission(sub, db) if sub else None,
        })
    # Sort: turned_in / marked_done first, then due, then missing — by name within
    status_order = {"turned_in": 0, "marked_done": 1, "due": 2, "missing": 3}
    out.sort(key=lambda r: (status_order.get(r["status"], 9), r["student"]["name"]))
    return out


@router.get("/assignments/{assignment_id}/student/{student_id}")
def get_student_submission(
    assignment_id: int,
    student_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Teacher view: a single student's submission + status (for the document viewer)."""
    user_roles = {r.role for r in current_user.roles}
    if not user_roles.intersection({"teacher", "class_teacher", "coordinator", "principal", "tech_admin"}):
        raise HTTPException(403, "Only teachers can view student work")
    ap = db.query(models.AssignmentPost).filter(models.AssignmentPost.id == assignment_id).first()
    if not ap:
        raise HTTPException(404, "Assignment not found")
    _assert_post_access(current_user, ap.post, db)
    st = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not st:
        raise HTTPException(404, "Student not found")
    sub = db.query(models.Submission).filter(
        models.Submission.assignment_id == assignment_id,
        models.Submission.student_id == student_id,
    ).first()
    return {
        "student": {
            "id": st.id,
            "name": st.user.name,
            "roll_number": st.roll_number,
            "avatar_url": st.user.avatar_url,
        },
        "status": _submission_status(sub, ap.due_date),
        "submission": _fmt_submission(sub, db) if sub else None,
    }


@router.get("/assignments/{assignment_id}/my-submission")
def get_my_submission(
    assignment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """A student fetches their own submission (if any) for an assignment."""
    student = db.query(models.Student).filter(models.Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(404, "Student profile not found")
    sub = db.query(models.Submission).filter(
        models.Submission.assignment_id == assignment_id,
        models.Submission.student_id == student.id,
    ).first()
    if not sub:
        return None
    return _fmt_submission(sub, db)


@router.post("/assignments/{assignment_id}/mark-done")
def mark_assignment_done(
    assignment_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Student toggles 'marked done' on an assignment (no work attached)."""
    user_roles = {r.role for r in current_user.roles}
    if "student" not in user_roles:
        raise HTTPException(403, "Only students can mark done")
    student = db.query(models.Student).filter(models.Student.user_id == current_user.id).first()
    if not student:
        raise HTTPException(404, "Student profile not found")
    ap = db.query(models.AssignmentPost).filter(models.AssignmentPost.id == assignment_id).first()
    if not ap:
        raise HTTPException(404, "Assignment not found")
    _assert_post_access(current_user, ap.post, db)
    sub = db.query(models.Submission).filter(
        models.Submission.assignment_id == assignment_id,
        models.Submission.student_id == student.id,
    ).first()
    if not sub:
        sub = models.Submission(
            assignment_id=assignment_id,
            student_id=student.id,
            marked_done=True,
        )
        db.add(sub)
    else:
        sub.marked_done = not sub.marked_done
    db.commit()
    db.refresh(sub)
    return _fmt_submission(sub, db)


class GradePayload(BaseModel):
    marks_obtained: float
    feedback: Optional[str] = None


@router.patch("/submissions/{submission_id}/grade")
def grade_submission(
    submission_id: int,
    payload: GradePayload,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_roles = {r.role for r in current_user.roles}
    if not user_roles.intersection({"teacher", "class_teacher", "coordinator", "principal"}):
        raise HTTPException(403, "Not allowed")

    sub = db.query(models.Submission).filter(models.Submission.id == submission_id).first()
    if not sub:
        raise HTTPException(404, "Submission not found")
    sub.marks_obtained = payload.marks_obtained
    sub.feedback = payload.feedback
    db.commit()
    db.refresh(sub)
    return _fmt_submission(sub, db)


@router.get("/submission-files/{file_id}/raw")
def serve_submission_file(
    file_id: int,
    _: models.User = Depends(get_file_user),
    db: Session = Depends(get_db),
):
    sf = db.query(models.SubmissionFile).filter(models.SubmissionFile.id == file_id).first()
    if not sf:
        raise HTTPException(404, "File not found")
    sub = sf.submission
    if not sub or not sub.assignment or not sub.assignment.post:
        raise HTTPException(404, "File not available")
    ap_post = sub.assignment.post
    path = _submission_files_dir(sub, ap_post) / sf.stored_name
    if not path.exists():
        raise HTTPException(404, "File not on disk")
    return FileResponse(str(path), media_type=sf.mime_type or "application/octet-stream",
                        filename=sf.original_name)


# ═══════════════════════════════════════════════════════════════════════════════
#  CUSTOM (NAMED) CLASSROOMS
# ═══════════════════════════════════════════════════════════════════════════════

def _fmt_custom_classroom(cc: models.CustomClassroom, db: Session, include_last_post: bool = True) -> dict:
    latest = None
    if include_last_post:
        latest = db.query(models.ClassroomPost).filter(
            models.ClassroomPost.custom_classroom_id == cc.id,
        ).order_by(models.ClassroomPost.created_at.desc()).first()
    student_count = db.query(models.CustomClassroomStudent).filter(
        models.CustomClassroomStudent.classroom_id == cc.id,
    ).count()
    return {
        "id": cc.id,
        "name": cc.name,
        "description": cc.description,
        "color": cc.color or "#4F46E5",
        "teacher_id": cc.teacher_id,
        "teacher_name": cc.teacher.name if cc.teacher_id else None,
        "academic_year_id": cc.academic_year_id,
        "student_count": student_count,
        "last_post_title": latest.title if latest else None,
        "last_post_at": latest.created_at if latest else None,
    }


@router.get("/custom-classrooms")
def list_custom_classrooms(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List custom classrooms the user can see (admin: all; teacher: own; student: enrolled)."""
    user_roles = {r.role for r in current_user.roles}
    out: list[dict] = []
    if user_roles.intersection({"coordinator", "principal", "tech_admin"}):
        ccs = db.query(models.CustomClassroom).order_by(models.CustomClassroom.created_at.desc()).all()
    elif user_roles.intersection({"teacher", "class_teacher"}):
        ccs = db.query(models.CustomClassroom).filter(
            models.CustomClassroom.teacher_id == current_user.id,
        ).order_by(models.CustomClassroom.created_at.desc()).all()
    else:
        # Student — enrolled via roster
        student = db.query(models.Student).filter(models.Student.user_id == current_user.id).first()
        if not student:
            return []
        rows = db.query(models.CustomClassroomStudent).filter(
            models.CustomClassroomStudent.student_id == student.id,
        ).all()
        ccs = [r.classroom for r in rows]
        # sort by created_at desc
        ccs.sort(key=lambda c: c.created_at or 0, reverse=True)

    for cc in ccs:
        out.append(_fmt_custom_classroom(cc, db))
    # Sort by most-recent activity
    out.sort(key=lambda c: c.get("last_post_at") or 0, reverse=True)
    return out


class CustomClassroomCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#4F46E5"
    teacher_id: int
    academic_year_id: Optional[int] = None
    student_ids: List[int] = []


class CustomClassroomUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    teacher_id: Optional[int] = None
    student_ids: Optional[List[int]] = None


@router.post("/custom-classrooms")
def create_custom_classroom(
    payload: CustomClassroomCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_roles = {r.role for r in current_user.roles}
    if not user_roles.intersection({"coordinator", "principal", "tech_admin"}):
        raise HTTPException(403, "Only admins can create custom classrooms")
    if not payload.name.strip():
        raise HTTPException(400, "Name is required")

    # Resolve academic year (payload → current → any)
    year_id = payload.academic_year_id
    if not year_id:
        cur = db.query(models.AcademicYear).filter(models.AcademicYear.is_current == True).first()
        year_id = cur.id if cur else None

    cc = models.CustomClassroom(
        name=payload.name.strip(),
        description=payload.description,
        color=payload.color or "#4F46E5",
        teacher_id=payload.teacher_id,
        academic_year_id=year_id,
    )
    db.add(cc)
    db.flush()

    for sid in payload.student_ids or []:
        db.add(models.CustomClassroomStudent(classroom_id=cc.id, student_id=sid))

    db.commit()
    db.refresh(cc)
    return _fmt_custom_classroom(cc, db, include_last_post=False)


@router.get("/custom-classrooms/{classroom_id}")
def get_custom_classroom(
    classroom_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cc = db.query(models.CustomClassroom).filter(models.CustomClassroom.id == classroom_id).first()
    if not cc:
        raise HTTPException(404, "Classroom not found")
    _assert_custom_classroom_access(current_user, classroom_id, db)
    students = db.query(models.CustomClassroomStudent).filter(
        models.CustomClassroomStudent.classroom_id == classroom_id,
    ).all()
    return {
        **_fmt_custom_classroom(cc, db, include_last_post=False),
        "students": [
            {"id": s.student.id, "name": s.student.user.name, "roll_number": s.student.roll_number,
             "avatar_url": s.student.user.avatar_url}
            for s in students
        ],
    }


@router.patch("/custom-classrooms/{classroom_id}")
def update_custom_classroom(
    classroom_id: int,
    payload: CustomClassroomUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_roles = {r.role for r in current_user.roles}
    if not user_roles.intersection({"coordinator", "principal", "tech_admin"}):
        raise HTTPException(403, "Only admins can edit custom classrooms")
    cc = db.query(models.CustomClassroom).filter(models.CustomClassroom.id == classroom_id).first()
    if not cc:
        raise HTTPException(404, "Classroom not found")
    if payload.name is not None:
        if not payload.name.strip():
            raise HTTPException(400, "Name cannot be empty")
        cc.name = payload.name.strip()
    if payload.description is not None:
        cc.description = payload.description
    if payload.color is not None:
        cc.color = payload.color
    if payload.teacher_id is not None:
        cc.teacher_id = payload.teacher_id
    if payload.student_ids is not None:
        # Replace roster
        db.query(models.CustomClassroomStudent).filter(
            models.CustomClassroomStudent.classroom_id == classroom_id,
        ).delete()
        for sid in payload.student_ids:
            db.add(models.CustomClassroomStudent(classroom_id=classroom_id, student_id=sid))
    db.commit()
    db.refresh(cc)
    return _fmt_custom_classroom(cc, db, include_last_post=False)


@router.delete("/custom-classrooms/{classroom_id}", status_code=204)
def delete_custom_classroom(
    classroom_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_roles = {r.role for r in current_user.roles}
    if not user_roles.intersection({"coordinator", "principal", "tech_admin"}):
        raise HTTPException(403, "Only admins can delete custom classrooms")
    cc = db.query(models.CustomClassroom).filter(models.CustomClassroom.id == classroom_id).first()
    if not cc:
        raise HTTPException(404, "Classroom not found")
    db.delete(cc)
    db.commit()


# ── Posts inside a custom classroom ───────────────────────────────────────────
@router.get("/custom-classrooms/{classroom_id}/posts")
def list_custom_posts(
    classroom_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_custom_classroom_access(current_user, classroom_id, db)
    posts = db.query(models.ClassroomPost).filter(
        models.ClassroomPost.custom_classroom_id == classroom_id,
        _published_clause(),
    ).order_by(models.ClassroomPost.created_at.desc()).all()
    return [_fmt_post(p) for p in posts]


@router.post("/custom-classrooms/{classroom_id}/posts")
async def create_custom_post(
    classroom_id: int,
    post_type: str = Form(...),
    title: str = Form(default=""),
    content: str = Form(default=""),
    topic: str = Form(default=""),
    due_date: str = Form(default=""),
    max_marks: int = Form(default=100),
    is_draft: str = Form(default="false"),
    scheduled_at: str = Form(default=""),
    files: list[UploadFile] = File(default=[]),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cc = db.query(models.CustomClassroom).filter(models.CustomClassroom.id == classroom_id).first()
    if not cc:
        raise HTTPException(404, "Classroom not found")
    user_roles = {r.role for r in current_user.roles}
    is_teacher = bool(user_roles.intersection({"coordinator", "principal", "tech_admin"})) or cc.teacher_id == current_user.id
    # Any member may post an announcement; only teachers may post assignments/materials
    if not is_teacher and post_type != "announcement":
        raise HTTPException(403, "Only teachers can post assignments and materials")
    if is_draft == "true" and not is_teacher:
        raise HTTPException(403, "Only teachers can save drafts")
    _assert_custom_classroom_access(current_user, classroom_id, db)

    from datetime import datetime as dt
    parsed_due = None
    if due_date:
        try:
            parsed_due = dt.fromisoformat(due_date)
        except ValueError:
            raise HTTPException(400, "Invalid due_date format")
    parsed_scheduled = None
    if scheduled_at:
        try:
            parsed_scheduled = dt.fromisoformat(scheduled_at)
        except ValueError:
            raise HTTPException(400, "Invalid scheduled_at format")

    post = models.ClassroomPost(
        custom_classroom_id=classroom_id,
        author_id=current_user.id,
        post_type=post_type,
        title=title or None,
        content=content or None,
        topic=topic or None,
        is_draft=(is_draft == "true"),
        scheduled_at=parsed_scheduled,
    )
    db.add(post)
    db.flush()

    if post_type == "assignment":
        db.add(models.AssignmentPost(
            post_id=post.id,
            subject_id=None,
            due_date=parsed_due,
            max_marks=max_marks,
            is_homework=False,
        ))

    for upload in files or []:
        if upload.filename is None or not upload.filename:
            continue
        suffix = Path(upload.filename).suffix.lower()
        file_type = ALLOWED_TYPES.get(suffix, "other")
        blob = await upload.read()
        stored_name = f"{uuid.uuid4().hex}{suffix}"
        dest_dir = _post_files_dir(post)
        dest_dir.mkdir(parents=True, exist_ok=True)
        (dest_dir / stored_name).write_bytes(blob)
        mime = mimetypes.guess_type(upload.filename)[0] or "application/octet-stream"
        db.add(models.ClassroomPostFile(
            post_id=post.id,
            uploaded_by=current_user.id,
            original_name=upload.filename,
            stored_name=stored_name,
            mime_type=mime,
            file_type=file_type,
            size_bytes=len(blob),
        ))

    db.commit()
    db.refresh(post)
    return _fmt_post(post)


@router.get("/custom-classrooms/{classroom_id}/classwork")
def list_custom_classwork(
    classroom_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_custom_classroom_access(current_user, classroom_id, db)
    user_roles = {r.role for r in current_user.roles}
    is_teacher = bool(user_roles.intersection({"coordinator", "principal", "tech_admin"}))
    q = db.query(models.ClassroomPost).filter(
        models.ClassroomPost.custom_classroom_id == classroom_id,
        models.ClassroomPost.post_type.in_(["assignment", "material"]),
    )
    if not is_teacher:
        q = q.filter(_published_clause())
    posts = q.order_by(models.ClassroomPost.created_at.desc()).all()

    topics: dict = {}
    for p in posts:
        key = p.topic or "General"
        topics.setdefault(key, []).append({
            "id": p.id,
            "type": p.post_type,
            "title": p.title,
            "content": p.content,
            "topic": p.topic,
            "is_draft": p.is_draft,
            "scheduled_at": p.scheduled_at.isoformat() if p.scheduled_at else None,
            "created_at": p.created_at.isoformat(),
            "due_date": p.assignment.due_date.isoformat() if p.assignment and p.assignment.due_date else None,
            "max_marks": p.assignment.max_marks if p.assignment else None,
            "files": [_fmt_file(f) for f in p.files],
        })
    return [{"topic": k, "items": v} for k, v in topics.items()]


@router.get("/custom-classrooms/{classroom_id}/people")
def list_custom_people(
    classroom_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_custom_classroom_access(current_user, classroom_id, db)
    cc = db.query(models.CustomClassroom).filter(models.CustomClassroom.id == classroom_id).first()
    rows = db.query(models.CustomClassroomStudent).filter(
        models.CustomClassroomStudent.classroom_id == classroom_id,
    ).all()
    return {
        "teacher": {
            "id": cc.teacher.id,
            "name": cc.teacher.name,
            "email": cc.teacher.email,
            "avatar_url": cc.teacher.avatar_url,
        } if cc.teacher_id and cc.teacher else None,
        "students": [
            {"id": r.student.id, "name": r.student.user.name,
             "roll_number": r.student.roll_number, "avatar_url": r.student.user.avatar_url}
            for r in rows
        ],
    }
