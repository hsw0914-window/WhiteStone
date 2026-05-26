from fastapi import APIRouter, Depends

from db import get_current_user
from services import insight_service


router = APIRouter(prefix="/insights")


@router.get("")
def get_insights(days: int = 30, current_user: dict = Depends(get_current_user)):
    return insight_service.get_insights(days, current_user)


@router.get("/recommendation")
def get_insight_recommendation(days: int = 30, current_user: dict = Depends(get_current_user)):
    return insight_service.get_insight_recommendation(days, current_user)
