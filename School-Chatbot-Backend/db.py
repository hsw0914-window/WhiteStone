import hashlib
import sqlite3
from fastapi import Header, HTTPException

from config import DB_PATH


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=TRUNCATE")
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT    NOT NULL,
            email         TEXT    UNIQUE NOT NULL,
            password_hash TEXT    NOT NULL,
            salt          TEXT    NOT NULL,
            major         TEXT    DEFAULT '',
            grade         INTEGER DEFAULT 0,
            created_at    TEXT    DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS auth_tokens (
            token      TEXT    PRIMARY KEY,
            user_id    INTEGER NOT NULL,
            created_at TEXT    DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id         TEXT    PRIMARY KEY,
            user_id    INTEGER NOT NULL,
            title      TEXT    NOT NULL DEFAULT '새로운 대화',
            created_at TEXT    DEFAULT (datetime('now')),
            updated_at TEXT    DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS messages (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT    NOT NULL,
            role       TEXT    NOT NULL,
            text       TEXT    NOT NULL,
            created_at TEXT    DEFAULT (datetime('now')),
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
        );
        CREATE TABLE IF NOT EXISTS message_categories (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id  INTEGER NOT NULL,
            category    TEXT    NOT NULL,
            confidence  REAL    DEFAULT 0,
            intent_text TEXT    DEFAULT '',
            source      TEXT    DEFAULT 'local',
            created_at  TEXT    DEFAULT (datetime('now')),
            FOREIGN KEY (message_id) REFERENCES messages(id)
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_auth_tokens_token ON auth_tokens(token);
        CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);
        CREATE INDEX IF NOT EXISTS idx_message_categories_message ON message_categories(message_id);
        CREATE INDEX IF NOT EXISTS idx_message_categories_category ON message_categories(category);
    """)
    user_columns = {row["name"] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
    if "major" not in user_columns:
        conn.execute("ALTER TABLE users ADD COLUMN major TEXT DEFAULT ''")
    if "grade" not in user_columns:
        conn.execute("ALTER TABLE users ADD COLUMN grade INTEGER DEFAULT 0")
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(messages)").fetchall()}
    if "category" not in columns:
        conn.execute("ALTER TABLE messages ADD COLUMN category TEXT")
    if "confidence" not in columns:
        conn.execute("ALTER TABLE messages ADD COLUMN confidence REAL")
    conn.commit()
    conn.close()


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000
    ).hex()


def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    token = authorization[7:]
    conn = get_db()
    try:
        row = conn.execute(
            """SELECT u.id, u.name, u.email, u.major, u.grade
               FROM users u
               JOIN auth_tokens t ON u.id = t.user_id
               WHERE t.token = ?""",
            (token,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다")
        return dict(row)
    finally:
        conn.close()
