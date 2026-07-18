"""
Messaging: Direct Messages (1-on-1) + Group Chats with events.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

import models
from auth import get_current_user
from database import get_db

router = APIRouter(tags=["messaging"])


# ════════════════════════════════════════════════════
#  DIRECT MESSAGES
# ════════════════════════════════════════════════════

def _fmt_dm(msg: models.DirectMessage) -> dict:
    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "receiver_id": msg.receiver_id,
        "sender_name": msg.sender.name,
        "receiver_name": msg.receiver.name,
        "content": msg.content,
        "created_at": msg.created_at.isoformat(),
    }


@router.get("/conversations")
def list_conversations(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return a deduplicated list of conversation partners with their last message."""
    messages = (
        db.query(models.DirectMessage)
        .filter(or_(
            models.DirectMessage.sender_id == current_user.id,
            models.DirectMessage.receiver_id == current_user.id,
        ))
        .order_by(models.DirectMessage.created_at.desc())
        .all()
    )
    seen: dict = {}
    for msg in messages:
        partner_id = msg.receiver_id if msg.sender_id == current_user.id else msg.sender_id
        if partner_id not in seen:
            partner = msg.receiver if msg.sender_id == current_user.id else msg.sender
            seen[partner_id] = {
                "user": {"id": partner.id, "name": partner.name, "email": partner.email, "avatar_url": partner.avatar_url},
                "last_message": _fmt_dm(msg),
            }
    return list(seen.values())


@router.get("/messages/{partner_id}")
def get_messages(partner_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    messages = (
        db.query(models.DirectMessage)
        .filter(or_(
            and_(models.DirectMessage.sender_id == current_user.id, models.DirectMessage.receiver_id == partner_id),
            and_(models.DirectMessage.sender_id == partner_id, models.DirectMessage.receiver_id == current_user.id),
        ))
        .order_by(models.DirectMessage.created_at)
        .all()
    )
    return [_fmt_dm(m) for m in messages]


class DMCreate(BaseModel):
    content: str


@router.post("/messages/{partner_id}")
def send_message(partner_id: int, payload: DMCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    partner = db.query(models.User).filter(models.User.id == partner_id).first()
    if not partner:
        raise HTTPException(404, "User not found")
    msg = models.DirectMessage(
        sender_id=current_user.id,
        receiver_id=partner_id,
        content=payload.content,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return _fmt_dm(msg)


@router.get("/users/search")
def search_users(
    q: str = "",
    email: str = "",  # kept for backwards compatibility
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search users by name or email."""
    query = q or email
    if len(query) < 2:
        return []
    users = (
        db.query(models.User)
        .filter(
            or_(
                models.User.name.ilike(f"%{query}%"),
                models.User.email.ilike(f"%{query}%"),
            ),
            models.User.id != current_user.id,
            models.User.is_active == True,
        )
        .limit(10)
        .all()
    )
    return [{"id": u.id, "name": u.name, "email": u.email, "avatar_url": u.avatar_url} for u in users]


# ════════════════════════════════════════════════════
#  GROUP CHATS
# ════════════════════════════════════════════════════

def _fmt_group(group: models.GroupChat, current_user_id: int) -> dict:
    return {
        "id": group.id,
        "name": group.name,
        "created_at": group.created_at.isoformat(),
        "members": [{"id": m.user.id, "name": m.user.name} for m in group.members],
    }


@router.get("/groups")
def list_groups(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = (
        db.query(models.GroupMember)
        .filter(models.GroupMember.user_id == current_user.id)
        .all()
    )
    return [_fmt_group(m.group, current_user.id) for m in memberships]


class GroupCreate(BaseModel):
    name: str


@router.post("/groups")
def create_group(payload: GroupCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    group = models.GroupChat(name=payload.name, created_by=current_user.id)
    db.add(group)
    db.flush()
    member = models.GroupMember(group_id=group.id, user_id=current_user.id)
    db.add(member)
    db.commit()
    db.refresh(group)
    return _fmt_group(group, current_user.id)


class AddMemberPayload(BaseModel):
    user_id: int

@router.post("/groups/{group_id}/members")
def add_member_to_group(
    group_id: int,
    payload: AddMemberPayload,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add any user to a group (called by any current member)."""
    _assert_member(current_user.id, group_id, db)
    group = db.query(models.GroupChat).filter(models.GroupChat.id == group_id).first()
    if not group:
        raise HTTPException(404, "Group not found")
    user = db.query(models.User).filter(models.User.id == payload.user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    existing = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id,
        models.GroupMember.user_id == payload.user_id,
    ).first()
    if not existing:
        db.add(models.GroupMember(group_id=group_id, user_id=payload.user_id))
        db.commit()
        db.refresh(group)
    return _fmt_group(group, current_user.id)


@router.post("/groups/{group_id}/join")
def join_group(group_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    group = db.query(models.GroupChat).filter(models.GroupChat.id == group_id).first()
    if not group:
        raise HTTPException(404, "Group not found")
    existing = db.query(models.GroupMember).filter(
        models.GroupMember.group_id == group_id,
        models.GroupMember.user_id == current_user.id,
    ).first()
    if not existing:
        db.add(models.GroupMember(group_id=group_id, user_id=current_user.id))
        db.commit()
    return {"joined": True}


@router.get("/groups/{group_id}/messages")
def get_group_messages(group_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    _assert_member(current_user.id, group_id, db)
    messages = (
        db.query(models.GroupMessage)
        .filter(models.GroupMessage.group_id == group_id)
        .order_by(models.GroupMessage.created_at)
        .all()
    )
    return [
        {
            "id": m.id,
            "content": m.content,
            "sender_id": m.sender_id,
            "sender_name": m.sender.name,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]


class GroupMsgCreate(BaseModel):
    content: str


@router.post("/groups/{group_id}/messages")
def send_group_message(group_id: int, payload: GroupMsgCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    _assert_member(current_user.id, group_id, db)
    msg = models.GroupMessage(group_id=group_id, sender_id=current_user.id, content=payload.content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {
        "id": msg.id,
        "content": msg.content,
        "sender_id": msg.sender_id,
        "sender_name": msg.sender.name,
        "created_at": msg.created_at.isoformat(),
    }


@router.get("/groups/{group_id}/events")
def get_group_events(group_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    _assert_member(current_user.id, group_id, db)
    events = (
        db.query(models.GroupEvent)
        .filter(models.GroupEvent.group_id == group_id)
        .order_by(models.GroupEvent.event_date)
        .all()
    )
    return [
        {
            "id": e.id,
            "title": e.title,
            "description": e.description,
            "event_date": e.event_date.isoformat(),
        }
        for e in events
    ]


class GroupEventCreate(BaseModel):
    title: str
    description: str = ""
    event_date: str   # ISO datetime string


@router.post("/groups/{group_id}/events")
def create_group_event(group_id: int, payload: GroupEventCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    _assert_member(current_user.id, group_id, db)
    from datetime import datetime
    event = models.GroupEvent(
        group_id=group_id,
        title=payload.title,
        description=payload.description,
        event_date=datetime.fromisoformat(payload.event_date),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return {
        "id": event.id,
        "title": event.title,
        "description": event.description,
        "event_date": event.event_date.isoformat(),
    }


def _assert_member(user_id: int, group_id: int, db: Session):
    m = db.query(models.GroupMember).filter(
        models.GroupMember.user_id == user_id,
        models.GroupMember.group_id == group_id,
    ).first()
    if not m:
        raise HTTPException(403, "Not a member of this group")
