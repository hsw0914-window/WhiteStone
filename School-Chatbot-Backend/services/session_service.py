import uuid
from datetime import datetime

from fastapi import HTTPException

import runtime
from db import get_db
from schemas import MessageCreate, SessionCreate


def list_sessions(current_user: dict):
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC",
            (current_user["id"],),
        ).fetchall()
        result = []
        for session in rows:
            last_msg = conn.execute(
                "SELECT text FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT 1",
                (session["id"],),
            ).fetchone()
            result.append({
                "id": session["id"],
                "title": session["title"],
                "preview": last_msg["text"] if last_msg else "대화를 시작해 보세요",
                "time": session["updated_at"],
                "unread": 0,
            })
        return result
    finally:
        conn.close()


def create_session(req: SessionCreate, current_user: dict):
    session_id = str(uuid.uuid4())
    bot_greeting = "안녕하세요! 흰돌이입니다. 백석대학교에 대해 무엇이든 물어보세요."
    now = datetime.now().isoformat()
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (session_id, current_user["id"], req.title, now, now),
        )
        conn.execute(
            "INSERT INTO messages (session_id, role, text, created_at) VALUES (?, 'bot', ?, ?)",
            (session_id, bot_greeting, now),
        )
        conn.commit()
        return {
            "id": session_id,
            "title": req.title,
            "messages": [{"role": "bot", "text": bot_greeting, "time": now}],
        }
    finally:
        conn.close()


def rename_session(session_id: str, req: SessionCreate, current_user: dict):
    if not req.title.strip():
        raise HTTPException(status_code=400, detail="제목을 입력해주세요")
    conn = get_db()
    try:
        result = conn.execute(
            "UPDATE chat_sessions SET title = ? WHERE id = ? AND user_id = ?",
            (req.title.strip(), session_id, current_user["id"]),
        )
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
        return {"ok": True}
    finally:
        conn.close()


def delete_session(session_id: str, current_user: dict):
    conn = get_db()
    try:
        conn.execute(
            """
            DELETE FROM message_categories
            WHERE message_id IN (SELECT id FROM messages WHERE session_id = ?)
            """,
            (session_id,),
        )
        conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
        result = conn.execute(
            "DELETE FROM chat_sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user["id"]),
        )
        conn.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
        return {"ok": True}
    finally:
        conn.close()


def get_session_messages(session_id: str, current_user: dict):
    conn = get_db()
    try:
        session = conn.execute(
            "SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user["id"]),
        ).fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")
        rows = conn.execute(
            "SELECT role, text, created_at FROM messages WHERE session_id = ? ORDER BY id ASC",
            (session_id,),
        ).fetchall()
        return [{"role": row["role"], "text": row["text"], "time": row["created_at"]} for row in rows]
    finally:
        conn.close()


def send_session_message(session_id: str, req: MessageCreate, current_user: dict):
    conn = get_db()
    try:
        session = conn.execute(
            "SELECT * FROM chat_sessions WHERE id = ? AND user_id = ?",
            (session_id, current_user["id"]),
        ).fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다")

        now = datetime.now().isoformat()
        user_insert = conn.execute(
            "INSERT INTO messages (session_id, role, text, created_at) VALUES (?, 'user', ?, ?)",
            (session_id, req.text, now),
        )

        category, confidence = "기타", 0.0
        try:
            chat_result = runtime.process_chat_question(req.text, current_user)
            category = runtime.normalize_insight_category(chat_result.get("category"))
            confidence = float(chat_result.get("confidence") or 0.0)
            bot_text = chat_result.get("answer", "죄송합니다. 답변을 생성할 수 없습니다.")
        except Exception:
            category, confidence = runtime.infer_question_category(req.text)
            bot_text = "죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."

        intent_categories = runtime.classify_question_intents(req.text)
        if intent_categories:
            primary = next(
                (item for item in intent_categories if item.get("category") != "범위밖"),
                intent_categories[0],
            )
            category = runtime.normalize_insight_category(primary.get("category"))
            confidence = float(primary.get("confidence") or confidence or 0.0)

        conn.execute(
            "UPDATE messages SET category = ?, confidence = ? WHERE id = ?",
            (category, confidence, user_insert.lastrowid),
        )
        runtime.save_message_categories(conn, user_insert.lastrowid, intent_categories)

        bot_now = datetime.now().isoformat()
        conn.execute(
            "INSERT INTO messages (session_id, role, text, created_at) VALUES (?, 'bot', ?, ?)",
            (session_id, bot_text, bot_now),
        )

        if session["title"] == "새로운 대화":
            title = req.text[:25] + ("..." if len(req.text) > 25 else "")
            conn.execute(
                "UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?",
                (title, bot_now, session_id),
            )
        else:
            conn.execute(
                "UPDATE chat_sessions SET updated_at = ? WHERE id = ?",
                (bot_now, session_id),
            )

        conn.commit()
        return {
            "messages": [{"role": "bot", "text": bot_text, "time": bot_now}],
            "bot_reply": bot_text,
        }
    finally:
        conn.close()
