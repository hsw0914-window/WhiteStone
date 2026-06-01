from fastapi import APIRouter, Depends

from db import get_current_user
from schemas import MessageCreate, SessionCreate
from services import session_service


router = APIRouter(prefix="/sessions")


@router.get("")
def list_sessions(current_user: dict = Depends(get_current_user)):
    return session_service.list_sessions(current_user)


@router.post("")
def create_session(req: SessionCreate, current_user: dict = Depends(get_current_user)):
    return session_service.create_session(req, current_user)


@router.patch("/{session_id}")
def rename_session(session_id: str, req: SessionCreate, current_user: dict = Depends(get_current_user)):
    return session_service.rename_session(session_id, req, current_user)


@router.delete("/{session_id}")
def delete_session(session_id: str, current_user: dict = Depends(get_current_user)):
    return session_service.delete_session(session_id, current_user)


@router.get("/{session_id}/messages")
def get_session_messages(session_id: str, current_user: dict = Depends(get_current_user)):
    return session_service.get_session_messages(session_id, current_user)


@router.post("/{session_id}/messages")
def send_session_message(
    session_id: str,
    req: MessageCreate,
    current_user: dict = Depends(get_current_user),
):
    return session_service.send_session_message(session_id, req, current_user)
