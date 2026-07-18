from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user, log_action, require_roles
from database import get_db

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_ROLES = ("coordinator", "principal", "tech_admin")
TECH_ROLES = ("tech_admin",)


# ── School Config ─────────────────────────────────────────────────────────────

@router.get("/school", response_model=schemas.SchoolOut)
def get_school(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    school = db.query(models.School).first()
    if not school:
        raise HTTPException(404, "School not configured")
    return school


@router.put("/school", response_model=schemas.SchoolOut)
def update_school(
    payload: schemas.SchoolUpdate,
    request: Request,
    current_user: models.User = Depends(require_roles(*TECH_ROLES)),
    db: Session = Depends(get_db),
):
    school = db.query(models.School).first()
    if not school:
        raise HTTPException(404, "School not configured")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(school, k, v)
    db.commit()
    db.refresh(school)
    log_action(db, current_user, "UPDATE_SCHOOL", "school", school.id, request=request)
    return school


# ── Academic Years ────────────────────────────────────────────────────────────

@router.get("/academic-years", response_model=List[schemas.AcademicYearOut])
def list_academic_years(
    current_user: models.User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    school = db.query(models.School).first()
    return db.query(models.AcademicYear).filter(models.AcademicYear.school_id == school.id).all()


@router.post("/academic-years", response_model=schemas.AcademicYearOut)
def create_academic_year(
    payload: schemas.AcademicYearCreate,
    request: Request,
    current_user: models.User = Depends(require_roles(*TECH_ROLES)),
    db: Session = Depends(get_db),
):
    school = db.query(models.School).first()
    if payload.is_current:
        db.query(models.AcademicYear).filter(
            models.AcademicYear.school_id == school.id
        ).update({"is_current": False})
    ay = models.AcademicYear(school_id=school.id, **payload.model_dump())
    db.add(ay)
    db.commit()
    db.refresh(ay)
    log_action(db, current_user, "CREATE_ACADEMIC_YEAR", "academic_year", ay.id, request=request)
    return ay


@router.post("/academic-years/{year_id}/terms", response_model=schemas.TermOut)
def create_term(
    year_id: int,
    payload: schemas.TermCreate,
    request: Request,
    current_user: models.User = Depends(require_roles(*TECH_ROLES)),
    db: Session = Depends(get_db),
):
    term = models.Term(academic_year_id=year_id, **payload.model_dump())
    db.add(term)
    db.commit()
    db.refresh(term)
    log_action(db, current_user, "CREATE_TERM", "term", term.id, request=request)
    return term


# ── Classes & Sections ────────────────────────────────────────────────────────

@router.get("/classes", response_model=List[schemas.ClassOut])
def list_classes(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    school = db.query(models.School).first()
    return (
        db.query(models.Class)
        .filter(models.Class.school_id == school.id)
        .order_by(models.Class.level)
        .all()
    )


@router.post("/classes", response_model=schemas.ClassOut)
def create_class(
    payload: schemas.ClassCreate,
    request: Request,
    current_user: models.User = Depends(require_roles(*TECH_ROLES)),
    db: Session = Depends(get_db),
):
    school = db.query(models.School).first()
    cls = models.Class(school_id=school.id, **payload.model_dump())
    db.add(cls)
    db.commit()
    db.refresh(cls)
    log_action(db, current_user, "CREATE_CLASS", "class", cls.id, request=request)
    return cls


@router.post("/sections", response_model=schemas.SectionOut)
def create_section(
    payload: schemas.SectionCreate,
    request: Request,
    current_user: models.User = Depends(require_roles(*TECH_ROLES)),
    db: Session = Depends(get_db),
):
    section = models.Section(**payload.model_dump())
    db.add(section)
    db.commit()
    db.refresh(section)
    log_action(db, current_user, "CREATE_SECTION", "section", section.id, request=request)
    return section


@router.put("/sections/{section_id}/class-teacher")
def assign_class_teacher(
    section_id: int,
    teacher_id: int,
    request: Request,
    current_user: models.User = Depends(require_roles(*TECH_ROLES)),
    db: Session = Depends(get_db),
):
    section = db.query(models.Section).filter(models.Section.id == section_id).first()
    if not section:
        raise HTTPException(404, "Section not found")
    section.class_teacher_id = teacher_id
    db.commit()
    log_action(db, current_user, "ASSIGN_CLASS_TEACHER", "section", section_id, request=request)
    return {"message": "Class teacher assigned"}


# ── Subjects ──────────────────────────────────────────────────────────────────

@router.get("/subjects", response_model=List[schemas.SubjectOut])
def list_subjects(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    school = db.query(models.School).first()
    return db.query(models.Subject).filter(models.Subject.school_id == school.id).all()


@router.post("/subjects", response_model=schemas.SubjectOut)
def create_subject(
    payload: schemas.SubjectCreate,
    request: Request,
    current_user: models.User = Depends(require_roles(*TECH_ROLES)),
    db: Session = Depends(get_db),
):
    school = db.query(models.School).first()
    subject = models.Subject(school_id=school.id, **payload.model_dump())
    db.add(subject)
    db.commit()
    db.refresh(subject)
    log_action(db, current_user, "CREATE_SUBJECT", "subject", subject.id, request=request)
    return subject


@router.delete("/subjects/{subject_id}", status_code=204)
def delete_subject(
    subject_id: int,
    request: Request,
    current_user: models.User = Depends(require_roles(*TECH_ROLES)),
    db: Session = Depends(get_db),
):
    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(404, "Subject not found")
    db.delete(subject)
    db.commit()
    log_action(db, current_user, "DELETE_SUBJECT", "subject", subject_id, request=request)


# ── Teacher Subject Section assignments ───────────────────────────────────────

@router.post("/assign-teacher", response_model=schemas.TSSOut)
def assign_teacher_to_section(
    payload: schemas.TSSCreate,
    request: Request,
    current_user: models.User = Depends(require_roles(*TECH_ROLES)),
    db: Session = Depends(get_db),
):
    existing = db.query(models.TeacherSubjectSection).filter(
        models.TeacherSubjectSection.teacher_id == payload.teacher_id,
        models.TeacherSubjectSection.subject_id == payload.subject_id,
        models.TeacherSubjectSection.section_id == payload.section_id,
        models.TeacherSubjectSection.academic_year_id == payload.academic_year_id,
    ).first()
    if existing:
        return existing
    tss = models.TeacherSubjectSection(**payload.model_dump())
    db.add(tss)
    db.commit()
    db.refresh(tss)
    log_action(db, current_user, "ASSIGN_TEACHER", "tss", tss.id, request=request)
    return tss


# ── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=List[schemas.UserOut])
def list_users(
    current_user: models.User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    return db.query(models.User).all()


@router.post("/users", response_model=schemas.UserOut)
def create_user(
    payload: schemas.UserCreate,
    request: Request,
    current_user: models.User = Depends(require_roles(*TECH_ROLES)),
    db: Session = Depends(get_db),
):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(400, "User with this email already exists")
    user = models.User(
        google_id=f"pending_{payload.email}",
        email=payload.email,
        name=payload.name,
    )
    db.add(user)
    db.flush()
    for role in payload.roles:
        db.add(models.UserRole(user_id=user.id, role=role))
    db.commit()
    db.refresh(user)
    log_action(db, current_user, "CREATE_USER", "user", user.id, request=request)
    return user


@router.put("/users/{user_id}/roles")
def update_user_roles(
    user_id: int,
    payload: schemas.UserRoleAssign,
    request: Request,
    current_user: models.User = Depends(require_roles(*TECH_ROLES)),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    db.query(models.UserRole).filter(models.UserRole.user_id == user_id).delete()
    for role in payload.roles:
        db.add(models.UserRole(user_id=user_id, role=role))
    db.commit()
    log_action(db, current_user, "UPDATE_USER_ROLES", "user", user_id, request=request)
    return {"message": "Roles updated"}


@router.put("/users/{user_id}/toggle-active")
def toggle_user_active(
    user_id: int,
    request: Request,
    current_user: models.User = Depends(require_roles(*TECH_ROLES)),
    db: Session = Depends(get_db),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    user.is_active = not user.is_active
    db.commit()
    log_action(db, current_user, "TOGGLE_USER_ACTIVE", "user", user_id, request=request)
    return {"is_active": user.is_active}


# ── Students admin ────────────────────────────────────────────────────────────

@router.post("/students", response_model=schemas.StudentOut)
def create_student(
    payload: schemas.StudentCreate,
    request: Request,
    current_user: models.User = Depends(require_roles(*TECH_ROLES)),
    db: Session = Depends(get_db),
):
    existing = db.query(models.Student).filter(models.Student.user_id == payload.user_id).first()
    if existing:
        raise HTTPException(400, "Student profile already exists for this user")
    student = models.Student(**payload.model_dump())
    db.add(student)
    db.flush()
    # Ensure student role
    role_exists = db.query(models.UserRole).filter(
        models.UserRole.user_id == payload.user_id,
        models.UserRole.role == "student",
    ).first()
    if not role_exists:
        db.add(models.UserRole(user_id=payload.user_id, role="student"))
    db.commit()
    db.refresh(student)
    log_action(db, current_user, "CREATE_STUDENT", "student", student.id, request=request)
    return student


@router.get("/students", response_model=List[schemas.StudentOut])
def list_students(
    section_id: Optional[int] = None,
    current_user: models.User = Depends(require_roles(*ADMIN_ROLES, "teacher", "class_teacher")),
    db: Session = Depends(get_db),
):
    q = db.query(models.Student)
    if section_id:
        q = q.filter(models.Student.section_id == section_id)
    return q.all()


# ── Tasks ─────────────────────────────────────────────────────────────────────

@router.get("/tasks", response_model=List[schemas.TaskOut])
def list_tasks(
    current_user: models.User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Task)
        .filter(
            (models.Task.assigned_by == current_user.id)
            | (models.Task.assigned_to == current_user.id)
        )
        .order_by(models.Task.created_at.desc())
        .all()
    )


@router.post("/tasks", response_model=schemas.TaskOut)
def create_task(
    payload: schemas.TaskCreate,
    current_user: models.User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    task = models.Task(
        assigned_by=current_user.id,
        **payload.model_dump(),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/tasks/{task_id}", response_model=schemas.TaskOut)
def update_task_status(
    task_id: int,
    payload: schemas.TaskUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    if task.assigned_to != current_user.id and task.assigned_by != current_user.id:
        raise HTTPException(403, "Not authorized")
    task.status = payload.status
    db.commit()
    db.refresh(task)
    return task


# ── Audit log ─────────────────────────────────────────────────────────────────

@router.get("/audit", response_model=List[schemas.AuditLogOut])
def list_audit(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(require_roles(*TECH_ROLES)),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.AuditLog)
        .order_by(models.AuditLog.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# ── Rooms ─────────────────────────────────────────────────────────────────────

@router.get("/rooms", response_model=List[schemas.RoomOut])
def list_rooms(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    school = db.query(models.School).first()
    return db.query(models.Room).filter(models.Room.school_id == school.id).all()


@router.post("/rooms", response_model=schemas.RoomOut)
def create_room(
    payload: schemas.RoomCreate,
    current_user: models.User = Depends(require_roles(*TECH_ROLES)),
    db: Session = Depends(get_db),
):
    school = db.query(models.School).first()
    room = models.Room(school_id=school.id, **payload.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


# ════════════════════════════════════════════════════════
#  CLASSROOMS  (section × subject pairs with teacher assignment)
# ════════════════════════════════════════════════════════

def _fmt_classroom(tss: models.TeacherSubjectSection, section: models.Section, subject: models.Subject, academic_year_id: int) -> dict:
    """Shape a TSS row + its section/subject into the ClassroomAdminOut shape."""
    return {
        "id": tss.id,
        "section_id": section.id,
        "section_name": f"{section.class_.name} {section.name}" if section.class_ else section.name,
        "class_name": section.class_.name if section.class_ else "",
        "subject_id": subject.id,
        "subject_name": subject.name,
        "subject_color": subject.color,
        "academic_year_id": academic_year_id,
        "teacher_id": tss.teacher_id,
        "teacher_name": tss.teacher.name if tss.teacher_id else None,
    }


@router.get("/classrooms")
def list_classrooms(
    current_user: models.User = Depends(require_roles(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """List all (section × subject) classrooms. Includes both assigned (TSS rows) and
    potential classrooms (sections × subjects where no TSS row yet exists)."""
    # All sections × subjects (full cartesian) with current teacher / unassigned
    sections = db.query(models.Section).all()
    subjects = db.query(models.Subject).all()
    tss_all = db.query(models.TeacherSubjectSection).all()

    # Index existing TSS by (section, subject)
    by_pair: dict[tuple[int, int], models.TeacherSubjectSection] = {}
    for t in tss_all:
        by_pair[(t.section_id, t.subject_id)] = t

    current_year = db.query(models.AcademicYear).filter(models.AcademicYear.is_current == True).first()
    year_id = current_year.id if current_year else (tss_all[0].academic_year_id if tss_all else 0)

    out = []
    for sec in sections:
        for subj in subjects:
            tss = by_pair.get((sec.id, subj.id))
            if tss:
                out.append(_fmt_classroom(tss, sec, subj, tss.academic_year_id))
            else:
                # Show as unassigned potential classroom if any subject taught in section OR all should be shown
                out.append({
                    "id": 0,
                    "section_id": sec.id,
                    "section_name": f"{sec.class_.name} {sec.name}" if sec.class_ else sec.name,
                    "class_name": sec.class_.name if sec.class_ else "",
                    "subject_id": subj.id,
                    "subject_name": subj.name,
                    "subject_color": subj.color,
                    "academic_year_id": year_id,
                    "teacher_id": None,
                    "teacher_name": None,
                })

    # Sort: by class, then subject
    out.sort(key=lambda c: (c["section_name"], c["subject_name"]))
    return out


@router.post("/classrooms")
def create_classroom(
    payload: schemas.ClassroomCreate,
    request: Request,
    current_user: models.User = Depends(require_roles(*TECH_ROLES)),
    db: Session = Depends(get_db),
):
    """Create a classroom — i.e. assign a teacher to (section, subject) for an academic year."""
    section = db.query(models.Section).filter(models.Section.id == payload.section_id).first()
    subject = db.query(models.Subject).filter(models.Subject.id == payload.subject_id).first()
    if not section or not subject:
        from fastapi import HTTPException
        raise HTTPException(404, "Section or subject not found")

    # Verify teacher is a real User with a teacher-like role
    teacher = None
    if payload.teacher_id:
        teacher = db.query(models.User).filter(models.User.id == payload.teacher_id).first()
        if not teacher:
            from fastapi import HTTPException
            raise HTTPException(404, "Teacher not found")
        teacher_roles = {r.role for r in teacher.roles}
        if not teacher_roles.intersection({"teacher", "class_teacher"}):
            from fastapi import HTTPException
            raise HTTPException(400, "User is not a teacher")

    # Idempotent: if a TSS already exists for this exact triple, return it
    existing = db.query(models.TeacherSubjectSection).filter(
        models.TeacherSubjectSection.section_id == payload.section_id,
        models.TeacherSubjectSection.subject_id == payload.subject_id,
        models.TeacherSubjectSection.academic_year_id == payload.academic_year_id,
    ).first()
    if existing:
        # If a teacher_id was provided and differs, update it
        if payload.teacher_id and existing.teacher_id != payload.teacher_id:
            existing.teacher_id = payload.teacher_id
            db.commit()
            db.refresh(existing)
            log_action(db, current_user, "REASSIGN_CLASSROOM_TEACHER", "tss", existing.id, request=request)
        return _fmt_classroom(existing, section, subject, payload.academic_year_id)

    if not payload.teacher_id:
        from fastapi import HTTPException
        raise HTTPException(400, "Cannot create a classroom without a teacher — assign one in the form")

    tss = models.TeacherSubjectSection(
        teacher_id=payload.teacher_id,
        subject_id=payload.subject_id,
        section_id=payload.section_id,
        academic_year_id=payload.academic_year_id,
    )
    db.add(tss)
    db.commit()
    db.refresh(tss)
    log_action(db, current_user, "CREATE_CLASSROOM", "tss", tss.id, request=request)
    return _fmt_classroom(tss, section, subject, payload.academic_year_id)


@router.patch("/classrooms/{tss_id}")
def update_classroom(
    tss_id: int,
    payload: schemas.ClassroomUpdate,
    request: Request,
    current_user: models.User = Depends(require_roles(*TECH_ROLES)),
    db: Session = Depends(get_db),
):
    """Update the teacher assigned to a classroom (or unassign with teacher_id=null)."""
    from fastapi import HTTPException
    tss = db.query(models.TeacherSubjectSection).filter(models.TeacherSubjectSection.id == tss_id).first()
    if not tss:
        raise HTTPException(404, "Classroom not found")
    if payload.teacher_id is not None:
        if payload.teacher_id == 0:
            tss.teacher_id = None
        else:
            teacher = db.query(models.User).filter(models.User.id == payload.teacher_id).first()
            if not teacher:
                raise HTTPException(404, "Teacher not found")
            tss.teacher_id = payload.teacher_id
    db.commit()
    db.refresh(tss)
    section = db.query(models.Section).filter(models.Section.id == tss.section_id).first()
    subject = db.query(models.Subject).filter(models.Subject.id == tss.subject_id).first()
    log_action(db, current_user, "UPDATE_CLASSROOM", "tss", tss.id, request=request)
    return _fmt_classroom(tss, section, subject, tss.academic_year_id)


@router.delete("/classrooms/{tss_id}", status_code=204)
def delete_classroom(
    tss_id: int,
    request: Request,
    current_user: models.User = Depends(require_roles(*TECH_ROLES)),
    db: Session = Depends(get_db),
):
    """Remove a teacher-subject-section assignment (deletes a classroom)."""
    from fastapi import HTTPException
    tss = db.query(models.TeacherSubjectSection).filter(models.TeacherSubjectSection.id == tss_id).first()
    if not tss:
        raise HTTPException(404, "Classroom not found")
    db.delete(tss)
    db.commit()
    log_action(db, current_user, "DELETE_CLASSROOM", "tss", tss_id, request=request)
