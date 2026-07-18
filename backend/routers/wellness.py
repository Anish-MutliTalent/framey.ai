"""
Wellness: private counselor chat channel, infirmary visit log, mood check-ins,
and a private wellness journal. Separate from the general messaging/collaboration channels.
"""
import mimetypes
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import or_, desc
from sqlalchemy.orm import Session

import models
from auth import get_current_user, get_file_user
from database import get_db

router = APIRouter(tags=["wellness"])

COUNSELOR_ROLES = {"counselor"}
NURSE_ROLES = {"nurse"}
ADMIN_ROLES = {"coordinator", "principal", "tech_admin"}

CERT_UPLOAD_ROOT = Path(__file__).parent.parent / "uploads" / "wellness" / "certs"
CERT_UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
CERT_ALLOWED = {".pdf": "pdf", ".png": "image", ".jpg": "image", ".jpeg": "image", ".gif": "image"}


def _user_roles(u: models.User) -> set:
    return {r.role for r in u.roles}


def _is_counselor(u: models.User) -> bool:
    return bool(_user_roles(u) & COUNSELOR_ROLES)


def _is_nurse(u: models.User) -> bool:
    return bool(_user_roles(u) & NURSE_ROLES)


def _is_admin(u: models.User) -> bool:
    return bool(_user_roles(u) & ADMIN_ROLES)


def _fmt_user(u: models.User) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email, "avatar_url": u.avatar_url,
            "role": next(iter(_user_roles(u)), None)}


# ════════════════════════════════════════════════════
#  COUNSELOR CHANNEL
# ════════════════════════════════════════════════════

@router.get("/counseling/counselors")
def list_counselors(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all school counselors (students pick one to chat with)."""
    users = db.query(models.User).filter(models.User.is_active == True).all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "avatar_url": u.avatar_url,
            "specialty": "School Counselor",
        }
        for u in users if _is_counselor(u)
    ]


def _fmt_cm(m: models.CounselorMessage, current_id: int) -> dict:
    return {
        "id": m.id,
        "sender_id": m.sender_id,
        "mine": m.sender_id == current_id,
        "content": m.content,
        "created_at": m.created_at.isoformat(),
    }


@router.get("/counseling/conversations")
def list_counseling_conversations(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Counselor: list of students who've chatted. Student: their counselors."""
    msgs = db.query(models.CounselorMessage).filter(or_(
        models.CounselorMessage.student_user_id == current_user.id,
        models.CounselorMessage.counselor_id == current_user.id,
    )).order_by(models.CounselorMessage.created_at.desc()).all()

    seen: dict = {}
    for m in msgs:
        if _is_counselor(current_user):
            partner_id = m.student_user_id
            partner = m.student
        else:
            partner_id = m.counselor_id
            partner = m.counselor
        if partner_id not in seen:
            unread = db.query(models.CounselorMessage).filter(
                models.CounselorMessage.student_user_id == m.student_user_id,
                models.CounselorMessage.counselor_id == m.counselor_id,
                models.CounselorMessage.sender_id != current_user.id,
            ).count()
            if _is_counselor(current_user):
                unread = db.query(models.CounselorMessage).filter(
                    models.CounselorMessage.counselor_id == current_user.id,
                    models.CounselorMessage.student_user_id == partner_id,
                    models.CounselorMessage.read_by_counselor == False,
                ).count()
            else:
                unread = db.query(models.CounselorMessage).filter(
                    models.CounselorMessage.student_user_id == current_user.id,
                    models.CounselorMessage.counselor_id == partner_id,
                    models.CounselorMessage.read_by_student == False,
                ).count()
            seen[partner_id] = {
                "partner": _fmt_user(partner),
                "last_message": {"content": m.content, "created_at": m.created_at.isoformat(), "sender_id": m.sender_id},
                "unread": unread,
            }
    return list(seen.values())


@router.get("/counseling/messages/{partner_id}")
def get_counseling_messages(
    partner_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the private thread between the current user and the partner (student or counselor)."""
    if _is_counselor(current_user):
        student_id, counselor_id = partner_id, current_user.id
    else:
        student_id, counselor_id = current_user.id, partner_id

    msgs = db.query(models.CounselorMessage).filter(
        models.CounselorMessage.student_user_id == student_id,
        models.CounselorMessage.counselor_id == counselor_id,
    ).order_by(models.CounselorMessage.created_at.asc()).all()

    # mark read
    for m in msgs:
        if m.sender_id != current_user.id:
            if _is_counselor(current_user):
                m.read_by_counselor = True
            else:
                m.read_by_student = True
    db.commit()
    return [_fmt_cm(m, current_user.id) for m in msgs]


class CounselingMessageCreate(BaseModel):
    content: str
    counselor_id: Optional[int] = None    # required when a student sends
    student_user_id: Optional[int] = None  # required when a counselor sends


@router.post("/counseling/messages")
def send_counseling_message(
    payload: CounselingMessageCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.content.strip():
        raise HTTPException(400, "Message cannot be empty")
    if _is_counselor(current_user):
        if not payload.student_user_id:
            raise HTTPException(400, "student_user_id is required")
        student_id = payload.student_user_id
        counselor_id = current_user.id
    else:
        if not payload.counselor_id:
            raise HTTPException(400, "counselor_id is required")
        target = db.query(models.User).filter(models.User.id == payload.counselor_id).first()
        if not target or not _is_counselor(target):
            raise HTTPException(400, "Recipient must be a counselor")
        counselor_id = payload.counselor_id
        student_id = current_user.id
    msg = models.CounselorMessage(
        student_user_id=student_id,
        counselor_id=counselor_id,
        sender_id=current_user.id,
        content=payload.content.strip(),
        read_by_counselor=_is_counselor(current_user),
        read_by_student=not _is_counselor(current_user),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return _fmt_cm(msg, current_user.id)


# ════════════════════════════════════════════════════
#  INFIRMARY VISITS
# ════════════════════════════════════════════════════

class VisitCreate(BaseModel):
    student_id: int
    reason: str
    symptoms: Optional[str] = None
    treatment: Optional[str] = None
    notes: Optional[str] = None
    sent_home: bool = False
    follow_up: bool = False


def _fmt_visit(v: models.InfirmaryVisit) -> dict:
    return {
        "id": v.id,
        "student_id": v.student_id,
        "student_name": v.student.user.name if v.student and v.student.user else None,
        "roll_number": v.student.roll_number if v.student else None,
        "nurse_name": v.nurse.name if v.nurse else None,
        "visited_at": v.visited_at.isoformat() if v.visited_at else None,
        "reason": v.reason,
        "symptoms": v.symptoms,
        "treatment": v.treatment,
        "notes": v.notes,
        "sent_home": v.sent_home,
        "follow_up": v.follow_up,
    }


@router.post("/nurse/visits")
def create_visit(
    payload: VisitCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not (_is_nurse(current_user) or _is_admin(current_user)):
        raise HTTPException(403, "Only nurses can log infirmary visits")
    student = db.query(models.Student).filter(models.Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")
    v = models.InfirmaryVisit(
        student_id=payload.student_id,
        nurse_id=current_user.id,
        reason=payload.reason,
        symptoms=payload.symptoms,
        treatment=payload.treatment,
        notes=payload.notes,
        sent_home=payload.sent_home,
        follow_up=payload.follow_up,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return _fmt_visit(v)


@router.get("/nurse/students")
def nurse_list_students(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List students for the visit-logging form."""
    if not (_is_nurse(current_user) or _is_admin(current_user)):
        raise HTTPException(403, "Only nurses can list students")
    students = db.query(models.Student).all()
    out = []
    for s in students:
        sec_name = s.section.class_.name + ' ' + s.section.name if s.section and s.section.class_ else (s.section.name if s.section else '')
        out.append({
            "id": s.id,
            "name": s.user.name if s.user else None,
            "roll_number": s.roll_number,
            "section": sec_name,
        })
    out.sort(key=lambda x: x["name"] or "")
    return out


@router.get("/nurse/visits")
def list_visits(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not (_is_nurse(current_user) or _is_admin(current_user)):
        raise HTTPException(403, "Only nurses can view all visits")
    visits = db.query(models.InfirmaryVisit).order_by(desc(models.InfirmaryVisit.visited_at)).limit(200).all()
    return [_fmt_visit(v) for v in visits]


@router.get("/wellness/infirmary-visits")
def list_my_visits(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """A student sees their own infirmary visit history."""
    student = db.query(models.Student).filter(models.Student.user_id == current_user.id).first()
    if not student:
        return []
    visits = db.query(models.InfirmaryVisit).filter(
        models.InfirmaryVisit.student_id == student.id
    ).order_by(desc(models.InfirmaryVisit.visited_at)).all()
    return [_fmt_visit(v) for v in visits]


# ════════════════════════════════════════════════════
#  MOOD CHECK-INS
# ════════════════════════════════════════════════════

class MoodCreate(BaseModel):
    mood: int          # 1–5
    note: Optional[str] = None


@router.post("/wellness/mood")
def create_mood(payload: MoodCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.mood < 1 or payload.mood > 5:
        raise HTTPException(400, "mood must be between 1 and 5")
    m = models.MoodCheckin(user_id=current_user.id, mood=payload.mood, note=payload.note)
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"id": m.id, "mood": m.mood, "note": m.note, "created_at": m.created_at.isoformat()}


@router.get("/wellness/mood")
def list_mood(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(models.MoodCheckin).filter(
        models.MoodCheckin.user_id == current_user.id
    ).order_by(desc(models.MoodCheckin.created_at)).limit(60).all()
    return [
        {"id": r.id, "mood": r.mood, "note": r.note, "created_at": r.created_at.isoformat()}
        for r in rows
    ]


# ════════════════════════════════════════════════════
#  WELLNESS JOURNAL
# ════════════════════════════════════════════════════

class JournalCreate(BaseModel):
    title: str = ""
    content: str = ""


@router.get("/wellness/journal")
def list_journal(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(models.WellnessJournal).filter(
        models.WellnessJournal.user_id == current_user.id
    ).order_by(desc(models.WellnessJournal.updated_at)).all()
    return [
        {"id": r.id, "title": r.title, "content": r.content,
         "created_at": r.created_at.isoformat(), "updated_at": r.updated_at.isoformat()}
        for r in rows
    ]


@router.post("/wellness/journal")
def create_journal(payload: JournalCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    j = models.WellnessJournal(user_id=current_user.id, title=payload.title, content=payload.content)
    db.add(j)
    db.commit()
    db.refresh(j)
    return {"id": j.id, "title": j.title, "content": j.content, "created_at": j.created_at.isoformat()}


@router.delete("/wellness/journal/{journal_id}", status_code=204)
def delete_journal(journal_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    j = db.query(models.WellnessJournal).filter(models.WellnessJournal.id == journal_id).first()
    if not j:
        raise HTTPException(404, "Not found")
    if j.user_id != current_user.id:
        raise HTTPException(403, "Not authorized")
    db.delete(j)
    db.commit()


# ════════════════════════════════════════════════════
#  MEDICAL CONDITIONS  (visible to nurses + teachers)
# ════════════════════════════════════════════════════

def _student_profile(user: models.User, db: Session):
    return db.query(models.Student).filter(models.Student.user_id == user.id).first()


def _visible_student_ids(user: models.User, db: Session) -> set:
    """Student ids the current user is allowed to see wellness data for."""
    roles = _user_roles(user)
    if roles & ADMIN_ROLES or roles & NURSE_ROLES:
        return {s.id for s in db.query(models.Student).all()}
    if roles & {"teacher", "class_teacher"}:
        ids = set()
        # students in sections the teacher teaches
        tss = db.query(models.TeacherSubjectSection).filter(
            models.TeacherSubjectSection.teacher_id == user.id).all()
        for t in tss:
            ids.update(s.id for s in db.query(models.Student).filter(models.Student.section_id == t.section_id).all())
        # students in sections where they're class teacher
        secs = db.query(models.Section).filter(models.Section.class_teacher_id == user.id).all()
        for sec in secs:
            ids.update(s.id for s in db.query(models.Student).filter(models.Student.section_id == sec.id).all())
        return ids
    # student — only themselves
    st = _student_profile(user, db)
    return {st.id} if st else set()


def _fmt_condition(c: models.MedicalCondition) -> dict:
    return {
        "id": c.id,
        "student_id": c.student_id,
        "student_name": c.student.user.name if c.student and c.student.user else None,
        "roll_number": c.student.roll_number if c.student else None,
        "section": (f"{c.student.section.class_.name} {c.student.section.name}"
                    if c.student and c.student.section and c.student.section.class_
                    else (c.student.section.name if c.student and c.student.section else None)),
        "condition": c.condition,
        "notes": c.notes,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


class ConditionCreate(BaseModel):
    condition: str
    notes: Optional[str] = None


@router.get("/wellness/conditions")
def list_conditions(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    visible = _visible_student_ids(current_user, db)
    if not visible:
        return []
    rows = db.query(models.MedicalCondition).filter(
        models.MedicalCondition.student_id.in_(visible)
    ).order_by(desc(models.MedicalCondition.created_at)).all()
    return [_fmt_condition(c) for c in rows]


@router.post("/wellness/conditions")
def create_condition(payload: ConditionCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not payload.condition.strip():
        raise HTTPException(400, "Condition is required")
    st = _student_profile(current_user, db)
    if not st:
        raise HTTPException(403, "Only students can list medical conditions")
    c = models.MedicalCondition(student_id=st.id, condition=payload.condition.strip(), notes=payload.notes)
    db.add(c)
    db.commit()
    db.refresh(c)
    return _fmt_condition(c)


@router.delete("/wellness/conditions/{condition_id}", status_code=204)
def delete_condition(condition_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = db.query(models.MedicalCondition).filter(models.MedicalCondition.id == condition_id).first()
    if not c:
        raise HTTPException(404, "Not found")
    st = _student_profile(current_user, db)
    if (st and c.student_id != st.id) and not (_user_roles(current_user) & (ADMIN_ROLES | NURSE_ROLES)):
        raise HTTPException(403, "Not authorized")
    db.delete(c)
    db.commit()


# ════════════════════════════════════════════════════
#  MEDICAL CERTIFICATES  (student uploads, class teacher approves)
# ════════════════════════════════════════════════════

def _fmt_cert(c: models.MedicalCertificate) -> dict:
    return {
        "id": c.id,
        "student_id": c.student_id,
        "student_name": c.student.user.name if c.student and c.student.user else None,
        "roll_number": c.student.roll_number if c.student else None,
        "section": (f"{c.student.section.class_.name} {c.student.section.name}"
                    if c.student and c.student.section and c.student.section.class_
                    else (c.student.section.name if c.student and c.student.section else None)),
        "original_name": c.original_name,
        "mime_type": c.mime_type,
        "file_type": c.file_type,
        "start_date": c.start_date.isoformat() if c.start_date else None,
        "end_date": c.end_date.isoformat() if c.end_date else None,
        "status": c.status,
        "reviewed_by": c.reviewed_by,
        "reviewer_name": c.reviewer.name if c.reviewer else None,
        "reviewed_at": c.reviewed_at.isoformat() if c.reviewed_at else None,
        "teacher_comment": c.teacher_comment,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.post("/wellness/certificates")
async def upload_certificate(
    file: UploadFile = File(...),
    start_date: str = Form(...),
    end_date: str = Form(default=""),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    st = _student_profile(current_user, db)
    if not st:
        raise HTTPException(403, "Only students can upload medical certificates")
    try:
        s = date.fromisoformat(start_date)
        e = date.fromisoformat(end_date) if end_date else s
    except ValueError:
        raise HTTPException(400, "Invalid date format")
    if e < s:
        raise HTTPException(400, "End date cannot be before start date")

    suffix = Path(file.filename or "file").suffix.lower()
    if suffix not in CERT_ALLOWED:
        raise HTTPException(400, "Only PDF or image files are allowed")
    blob = await file.read()
    stored_name = f"{uuid.uuid4().hex}{suffix}"
    dest = CERT_UPLOAD_ROOT / stored_name
    dest.write_bytes(blob)
    mime = mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"

    cert = models.MedicalCertificate(
        student_id=st.id,
        stored_name=stored_name,
        original_name=file.filename or stored_name,
        mime_type=mime,
        file_type=CERT_ALLOWED[suffix],
        start_date=s,
        end_date=e,
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)
    return _fmt_cert(cert)


@router.get("/wellness/certificates")
def list_certificates(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    visible = _visible_student_ids(current_user, db)
    if not visible:
        return []
    rows = db.query(models.MedicalCertificate).filter(
        models.MedicalCertificate.student_id.in_(visible)
    ).order_by(desc(models.MedicalCertificate.created_at)).all()
    return [_fmt_cert(c) for c in rows]


@router.get("/wellness/certificates/{cert_id}/raw")
def serve_certificate(
    cert_id: int,
    _: models.User = Depends(get_file_user),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cert = db.query(models.MedicalCertificate).filter(models.MedicalCertificate.id == cert_id).first()
    if not cert:
        raise HTTPException(404, "Not found")
    visible = _visible_student_ids(current_user, db)
    if cert.student_id not in visible:
        raise HTTPException(403, "Not authorized")
    path = CERT_UPLOAD_ROOT / cert.stored_name
    if not path.exists():
        raise HTTPException(404, "File not on disk")
    return FileResponse(str(path), media_type=cert.mime_type or "application/octet-stream",
                        filename=cert.original_name)


class ReviewPayload(BaseModel):
    status: str            # approved | declined
    teacher_comment: Optional[str] = None


@router.patch("/wellness/certificates/{cert_id}/review")
def review_certificate(
    cert_id: int,
    payload: ReviewPayload,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    roles = _user_roles(current_user)
    if not (roles & {"teacher", "class_teacher"} or roles & ADMIN_ROLES):
        raise HTTPException(403, "Only teachers can review certificates")
    if payload.status not in ("approved", "declined"):
        raise HTTPException(400, "status must be approved or declined")
    cert = db.query(models.MedicalCertificate).filter(models.MedicalCertificate.id == cert_id).first()
    if not cert:
        raise HTTPException(404, "Not found")
    visible = _visible_student_ids(current_user, db)
    if cert.student_id not in visible:
        raise HTTPException(403, "Not authorized to review this certificate")
    cert.status = payload.status
    cert.reviewed_by = current_user.id
    cert.reviewed_at = datetime.utcnow()
    cert.teacher_comment = payload.teacher_comment
    db.commit()
    db.refresh(cert)
    return _fmt_cert(cert)
