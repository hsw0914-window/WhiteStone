from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime

from app.db import get_conn
from app.routers.auth import get_current_user
from app.services.answer_generator import generate_answer

router = APIRouter(prefix="/sessions")

BOT_GREETING = "안녕하세요! 학교 관련 궁금한 점을 질문해주세요."


class SessionCreateRequest(BaseModel):
    title: Optional[str] = "새로운 대화"

class SessionPatchRequest(BaseModel):
    title: str

class MessageRequest(BaseModel):
    text: str


# ── 세션 CRUD ─────────────────────────────────────────────────────────────────

@router.get("")
def list_sessions(current_user: dict = Depends(get_current_user)):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC",
        (current_user["id"],)
    ).fetchall()
    result = []
    for row in rows:
        last_msg = conn.execute(
            "SELECT text FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT 1",
            (row["id"],)
        ).fetchone()
        result.append({
            "id": row["id"],
            "title": row["title"],
            "preview": last_msg["text"] if last_msg else "대화를 시작해 보세요",
            "time": row["updated_at"] if "updated_at" in row.keys() else row["created_at"],
            "unread": 0,
        })
    conn.close()
    return result


@router.post("")
def create_session(req: SessionCreateRequest, current_user: dict = Depends(get_current_user)):
    session_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    conn = get_conn()
    conn.execute(
        "INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (session_id, current_user["id"], req.title or "새로운 대화", now, now)
    )
    conn.execute(
        "INSERT INTO messages (session_id, role, text, created_at) VALUES (?, 'bot', ?, ?)",
        (session_id, BOT_GREETING, now)
    )
    conn.commit()
    row = conn.execute("SELECT * FROM chat_sessions WHERE id = ?", (session_id,)).fetchone()
    conn.close()
    return {
        "id": row["id"],
        "title": row["title"],
        "messages": [{"role": "bot", "text": BOT_GREETING, "time": now}],
    }


@router.patch("/{session_id}")
def rename_session(session_id: str, req: SessionPatchRequest, current_user: dict = Depends(get_current_user)):
    if not req.title.strip():
        raise HTTPException(status_code=400, detail="제목을 입력해주세요.")
    conn = get_conn()
    result = conn.execute(
        "UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?",
        (req.title.strip(), datetime.now().isoformat(), session_id, current_user["id"])
    )
    conn.commit()
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
    return {"ok": True}


@router.delete("/{session_id}")
def delete_session(session_id: str, current_user: dict = Depends(get_current_user)):
    conn = get_conn()
    _assert_owner(conn, session_id, current_user["id"])
    conn.execute(
        "DELETE FROM messages WHERE session_id = ?",
        (session_id,)
    )
    result = conn.execute(
        "DELETE FROM chat_sessions WHERE id = ? AND user_id = ?",
        (session_id, current_user["id"])
    )
    conn.commit()
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
    return {"ok": True}


# ── 메시지 ────────────────────────────────────────────────────────────────────

@router.get("/{session_id}/messages")
def get_messages(session_id: str, current_user: dict = Depends(get_current_user)):
    conn = get_conn()
    _assert_owner(conn, session_id, current_user["id"])
    rows = conn.execute(
        "SELECT role, text, created_at FROM messages WHERE session_id = ? ORDER BY id ASC",
        (session_id,)
    ).fetchall()
    conn.close()
    return [{"role": r["role"], "text": r["text"], "time": r["created_at"]} for r in rows]


@router.post("/{session_id}/messages")
def send_message(session_id: str, req: MessageRequest, current_user: dict = Depends(get_current_user)):
    conn = get_conn()
    _assert_owner(conn, session_id, current_user["id"])
    now = datetime.now().isoformat()

    user_insert = conn.execute(
        "INSERT INTO messages (session_id, role, text, created_at) VALUES (?, 'user', ?, ?)",
        (session_id, req.text, now)
    )
    conn.commit()

    result = generate_answer(req.text)
    bot_reply = result.answer
    conn.execute(
        "UPDATE messages SET category = ?, confidence = ? WHERE id = ?",
        (result.category or "기타", float(result.confidence or 0.0), user_insert.lastrowid)
    )

    bot_now = datetime.now().isoformat()
    conn.execute(
        "INSERT INTO messages (session_id, role, text, created_at) VALUES (?, 'bot', ?, ?)",
        (session_id, bot_reply, bot_now)
    )
    conn.execute(
        "UPDATE chat_sessions SET updated_at = ? WHERE id = ?",
        (bot_now, session_id)
    )
    conn.commit()
    conn.close()
    return {"bot_reply": bot_reply}


def _assert_owner(conn, session_id: str, user_id: int):
    row = conn.execute(
        "SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?",
        (session_id, user_id)
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
