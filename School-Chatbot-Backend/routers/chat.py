from fastapi import APIRouter

from schemas import ChatRequest
from services import chat_service


router = APIRouter()


@router.post("/chat")
def chat(req: ChatRequest):
    return chat_service.chat(req)
