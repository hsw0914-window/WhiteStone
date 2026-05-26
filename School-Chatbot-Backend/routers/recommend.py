from fastapi import APIRouter, Depends

from db import get_current_user
from schemas import RecommendRequest
from services import recommend_service


router = APIRouter()


@router.post("/recommend")
def recommend_courses(req: RecommendRequest, current_user: dict = Depends(get_current_user)):
    return recommend_service.recommend_courses(req, current_user)


@router.get("/roadmap/courses")
def list_roadmap_courses(major: str | None = None, current_user: dict = Depends(get_current_user)):
    return recommend_service.list_roadmap_courses(major, current_user)
