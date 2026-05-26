from fastapi import APIRouter, Depends

from db import get_current_user
from schemas import (
    GoogleAuthRequest,
    GoogleCodeRequest,
    LoginRequest,
    ProfileUpdateRequest,
    SignupRequest,
)
from services import auth_service


router = APIRouter(prefix="/auth")


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return auth_service.me(current_user)


@router.post("/signup")
def signup(req: SignupRequest):
    return auth_service.signup(req)


@router.post("/login")
def login(req: LoginRequest):
    return auth_service.login(req)


@router.patch("/profile")
def update_profile(req: ProfileUpdateRequest, current_user: dict = Depends(get_current_user)):
    return auth_service.update_profile(req, current_user)


@router.post("/google/legacy")
def google_auth_legacy(req: GoogleAuthRequest):
    return auth_service.google_auth(req)


@router.post("/google")
def google_auth(req: GoogleAuthRequest):
    return auth_service.google_auth(req)


@router.post("/google/code")
def google_code_auth(req: GoogleCodeRequest):
    return auth_service.google_code_auth(req)
