import hashlib
import secrets
import sqlite3
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional
import requests

from app.db import get_conn

router = APIRouter(prefix="/auth")

GOOGLE_WEB_CLIENT_ID = "985939853275-46vknlh7ahkag296e278h135qcuesm34.apps.googleusercontent.com"


# ── 스키마 ────────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class GoogleTokenRequest(BaseModel):
    access_token: str

class GoogleCodeRequest(BaseModel):
    code: str
    code_verifier: Optional[str] = None
    redirect_uri: str
    client_id: Optional[str] = None


# ── 헬퍼 ─────────────────────────────────────────────────────────────────────

def _legacy_hash(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000
    ).hex()

def _columns(conn, table: str) -> set[str]:
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}

def _public_user(user):
    return {"id": user["id"], "name": user["name"], "email": user["email"]}

def _create_token(conn, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute("INSERT INTO auth_tokens (token, user_id) VALUES (?, ?)", (token, user_id))
    return token

def _find_user(conn, email: str):
    return conn.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()

def _create_user(conn, name: str, email: str, password: str):
    cols = _columns(conn, "users")
    clean_email = email.strip().lower()
    clean_name = name.strip()

    if {"password_hash", "salt"}.issubset(cols):
        salt = secrets.token_hex(16)
        conn.execute(
            "INSERT INTO users (name, email, password_hash, salt) VALUES (?, ?, ?, ?)",
            (clean_name, clean_email, _hash_password(password, salt), salt),
        )
    elif "password" in cols:
        conn.execute(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            (clean_name, clean_email, _legacy_hash(password)),
        )
    else:
        raise RuntimeError("지원하지 않는 users 테이블 구조입니다.")

    conn.commit()
    return _find_user(conn, clean_email)

def _verify_password(user, password: str) -> bool:
    keys = set(user.keys())
    if {"password_hash", "salt"}.issubset(keys):
        return _hash_password(password, user["salt"]) == user["password_hash"]
    if "password" in keys:
        return _legacy_hash(password) == user["password"]
    return False

def _auth_response(conn, user):
    token = _create_token(conn, user["id"])
    conn.commit()
    return {"token": token, "user": _public_user(user)}

def _get_or_create_google_user(conn, email: str, name: str):
    user = _find_user(conn, email)
    if user:
        return user
    return _create_user(conn, name or email.split("@")[0], email, secrets.token_urlsafe(32))

def _google_user_from_access_token(access_token: str):
    resp = requests.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    if not resp.ok:
        raise HTTPException(status_code=401, detail="구글 인증에 실패했습니다.")

    info = resp.json()
    email = (info.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="구글 계정에서 이메일을 가져올 수 없습니다.")
    return email, info.get("name") or email.split("@")[0]

def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증 토큰이 없습니다.")
    token = authorization.split(" ", 1)[1]
    conn = get_conn()
    row = conn.execute(
        "SELECT u.* FROM auth_tokens t JOIN users u ON t.user_id = u.id WHERE t.token = ?",
        (token,)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
    return dict(row)


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.post("/signup")
def signup(req: SignupRequest):
    if not req.name.strip() or not req.email.strip() or not req.password:
        raise HTTPException(status_code=400, detail="모든 필드를 입력해주세요.")

    conn = get_conn()
    try:
        user = _create_user(conn, req.name, req.email, req.password)
        return _auth_response(conn, user)
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")
    finally:
        conn.close()


@router.post("/login")
def login(req: LoginRequest):
    conn = get_conn()
    try:
        user = _find_user(conn, req.email)
        if not user or not _verify_password(user, req.password):
            raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다.")
        return _auth_response(conn, user)
    finally:
        conn.close()


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return {"id": current_user["id"], "name": current_user["name"], "email": current_user["email"]}


@router.post("/google")
def google(req: GoogleTokenRequest):
    email, name = _google_user_from_access_token(req.access_token)
    conn = get_conn()
    try:
        user = _get_or_create_google_user(conn, email, name)
        return _auth_response(conn, user)
    finally:
        conn.close()


@router.post("/google/code")
def google_code(req: GoogleCodeRequest):
    payload = {
        "code": req.code,
        "client_id": req.client_id or GOOGLE_WEB_CLIENT_ID,
        "redirect_uri": req.redirect_uri,
        "grant_type": "authorization_code",
    }
    if req.code_verifier:
        payload["code_verifier"] = req.code_verifier

    resp = requests.post("https://oauth2.googleapis.com/token", data=payload, timeout=10)
    if not resp.ok:
        raise HTTPException(status_code=401, detail="구글 로그인 토큰 교환에 실패했습니다.")

    access_token = resp.json().get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="구글 액세스 토큰을 가져오지 못했습니다.")

    email, name = _google_user_from_access_token(access_token)
    conn = get_conn()
    try:
        user = _get_or_create_google_user(conn, email, name)
        return _auth_response(conn, user)
    finally:
        conn.close()
