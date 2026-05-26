from fastapi import APIRouter
from fastapi.responses import HTMLResponse

from schemas import NavigateRequest
from services import map_service


router = APIRouter()


@router.get("/map", response_class=HTMLResponse)
def get_map():
    return map_service.get_map()


@router.post("/navigate")
def navigate(req: NavigateRequest):
    return map_service.navigate(req)
