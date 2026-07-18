import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import Base, engine, get_db
import models
import schemas
from auth import (
    create_access_token, decode_token,
    get_current_user, verify_google_token,
)
from routers import students, teachers, admin, classroom, attendance, timetable, reports, announcements, calendar
from routers import student_tools, messaging, homework, project_workspace, wellness

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Academia ERP", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth routes ───────────────────────────────────────────────────────────────

@app.post("/api/auth/google", response_model=schemas.TokenResponse)
def google_login(payload: schemas.GoogleAuthRequest, db: Session = Depends(get_db)):
    info = verify_google_token(payload.id_token)
    google_id = info["sub"]
    email = info["email"]
    name = info.get("name", email)
    avatar_url = info.get("picture")

    user = db.query(models.User).filter(models.User.google_id == google_id).first()
    if not user:
        # Check if pre-created by email (pending google_id)
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            raise HTTPException(
                status_code=403,
                detail="No account found for this email. Contact your administrator.",
            )
        if user.google_id.startswith("pending_"):
            user.google_id = google_id
        user.name = name
        user.avatar_url = avatar_url
        db.commit()
    elif not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")
    else:
        user.name = name
        user.avatar_url = avatar_url
        db.commit()

    roles = [r.role for r in user.roles]
    access_token = create_access_token(user.id, roles)
    db.refresh(user)
    return schemas.TokenResponse(
        access_token=access_token,
        user=schemas.UserOut.model_validate(user),
    )


@app.post("/api/auth/refresh", response_model=schemas.TokenResponse)
def do_refresh_token(payload: schemas.RefreshRequest, db: Session = Depends(get_db)):
    data = decode_token(payload.refresh_token)
    if data.get("type") != "refresh":
        raise HTTPException(400, "Wrong token type")
    user_id = int(data["sub"])
    user = db.query(models.User).filter(models.User.id == user_id, models.User.is_active == True).first()
    if not user:
        raise HTTPException(401, "User not found")
    roles = [r.role for r in user.roles]
    access_token = create_access_token(user.id, roles)
    return schemas.TokenResponse(
        access_token=access_token,
        user=schemas.UserOut.model_validate(user),
    )


@app.get("/api/auth/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


# ── Include routers ───────────────────────────────────────────────────────────

app.include_router(students.router, prefix="/api")
app.include_router(teachers.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(classroom.router, prefix="/api")
app.include_router(attendance.router, prefix="/api")
app.include_router(timetable.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(announcements.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
app.include_router(student_tools.router, prefix="/api")
app.include_router(messaging.router, prefix="/api")
app.include_router(homework.router, prefix="/api")
app.include_router(project_workspace.router, prefix="/api")
app.include_router(wellness.router, prefix="/api")


from pydantic import BaseModel as _BaseModel
class _DevLoginPayload(_BaseModel):
    email: str

@app.post("/api/auth/dev-login", response_model=schemas.TokenResponse)
def dev_login(payload: _DevLoginPayload, db: Session = Depends(get_db)):
    """Development-only endpoint — bypasses Google OAuth. Disabled in production."""
    if os.getenv("ACADEMIA_ENV", "development") == "production":
        raise HTTPException(403, "Dev login disabled in production")
    email = payload.email
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(404, f"No account found for {email}. Run seed.py first.")
    if not user.is_active:
        raise HTTPException(403, "Account is deactivated")
    roles = [r.role for r in user.roles]
    access_token = create_access_token(user.id, roles)
    db.refresh(user)
    return schemas.TokenResponse(
        access_token=access_token,
        user=schemas.UserOut.model_validate(user),
    )


@app.get("/api/health")
def health():
    return {"status": "ok"}
