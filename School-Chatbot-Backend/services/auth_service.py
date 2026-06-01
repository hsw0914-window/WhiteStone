import secrets
import sqlite3

import requests as http
from fastapi import HTTPException

import runtime
from config import GOOGLE_CLIENT_SECRET, GOOGLE_WEB_CLIENT_ID
from db import get_db, hash_password
from schemas import (
    GoogleAuthRequest,
    GoogleCodeRequest,
    LoginRequest,
    ProfileUpdateRequest,
    SignupRequest,
)


def me(current_user: dict):
    return {"user": current_user}


def signup(req: SignupRequest):
    if not req.name.strip() or not req.email.strip() or not req.password:
        raise HTTPException(status_code=400, detail="모든 필드를 입력해주세요")
    major, grade = ("", 0)
    if req.major or req.grade:
        major, grade = runtime.validate_profile_values(req.major, req.grade)
    salt = secrets.token_hex(16)
    password_hash = hash_password(req.password, salt)
    token = secrets.token_urlsafe(32)
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (name, email, password_hash, salt, major, grade) VALUES (?, ?, ?, ?, ?, ?)",
            (req.name.strip(), req.email.strip().lower(), password_hash, salt, major, grade),
        )
        conn.commit()
        user = conn.execute(
            "SELECT * FROM users WHERE email = ?",
            (req.email.strip().lower(),),
        ).fetchone()
        conn.execute(
            "INSERT INTO auth_tokens (token, user_id) VALUES (?, ?)",
            (token, user["id"]),
        )
        conn.commit()
        return {"token": token, "user": runtime.user_to_dict(user)}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다")
    finally:
        conn.close()


def login(req: LoginRequest):
    conn = get_db()
    try:
        user = conn.execute(
            "SELECT * FROM users WHERE email = ?",
            (req.email.strip().lower(),),
        ).fetchone()
        if not user or hash_password(req.password, user["salt"]) != user["password_hash"]:
            raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다")
        token = secrets.token_urlsafe(32)
        conn.execute(
            "INSERT INTO auth_tokens (token, user_id) VALUES (?, ?)",
            (token, user["id"]),
        )
        conn.commit()
        return {"token": token, "user": runtime.user_to_dict(user)}
    finally:
        conn.close()


def update_profile(req: ProfileUpdateRequest, current_user: dict):
    updates = {}
    if req.major is not None:
        updates["major"] = runtime.normalize_major(req.major)
    if req.grade is not None:
        updates["grade"] = int(req.grade)

    if not updates:
        return {"user": current_user}

    major = updates.get("major", current_user.get("major", ""))
    grade = updates.get("grade", current_user.get("grade", 0))
    major, grade = runtime.validate_profile_values(major, grade)

    conn = get_db()
    try:
        conn.execute(
            "UPDATE users SET major = ?, grade = ? WHERE id = ?",
            (major, grade, current_user["id"]),
        )
        conn.commit()
        user = conn.execute("SELECT * FROM users WHERE id = ?", (current_user["id"],)).fetchone()
        return {"user": runtime.user_to_dict(user)}
    finally:
        conn.close()


def google_error_detail(resp, fallback: str) -> str:
    try:
        data = resp.json()
    except ValueError:
        return fallback
    return data.get("error_description") or data.get("error") or fallback


def google_user_from_access_token(access_token: str):
    resp = http.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    if not resp.ok:
        detail = google_error_detail(resp, "Google userinfo request failed.")
        raise HTTPException(status_code=401, detail=f"Google userinfo request failed: {detail}")

    info = resp.json()
    email = info.get("email", "").strip().lower()
    name = info.get("name") or email.split("@")[0]
    if not email:
        raise HTTPException(status_code=400, detail="Google account email is missing.")
    return email, name


def issue_google_login(email: str, name: str):
    conn = get_db()
    try:
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not user:
            salt = secrets.token_hex(16)
            password_hash = hash_password(secrets.token_urlsafe(32), salt)
            conn.execute(
                "INSERT INTO users (name, email, password_hash, salt) VALUES (?, ?, ?, ?)",
                (name, email, password_hash, salt),
            )
            conn.commit()
            user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

        token = secrets.token_urlsafe(32)
        conn.execute(
            "INSERT INTO auth_tokens (token, user_id) VALUES (?, ?)",
            (token, user["id"]),
        )
        conn.commit()
        return {"token": token, "user": runtime.user_to_dict(user)}
    finally:
        conn.close()


def google_auth(req: GoogleAuthRequest):
    email, name = google_user_from_access_token(req.access_token)
    return issue_google_login(email, name)


def google_code_auth(req: GoogleCodeRequest):
    payload = {
        "code": req.code,
        "client_id": req.client_id or GOOGLE_WEB_CLIENT_ID,
        "redirect_uri": req.redirect_uri,
        "grant_type": "authorization_code",
    }
    if not GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="백엔드 .env에 GOOGLE_CLIENT_SECRET을 설정해 주세요.",
        )
    payload["client_secret"] = GOOGLE_CLIENT_SECRET
    if req.code_verifier:
        payload["code_verifier"] = req.code_verifier

    resp = http.post("https://oauth2.googleapis.com/token", data=payload, timeout=10)
    if not resp.ok:
        detail = google_error_detail(resp, "Google login token exchange failed.")
        raise HTTPException(status_code=401, detail=f"Google login token exchange failed: {detail}")

    access_token = resp.json().get("access_token")
    if not access_token:
        raise HTTPException(status_code=401, detail="Google access token is missing.")

    email, name = google_user_from_access_token(access_token)
    return issue_google_login(email, name)
