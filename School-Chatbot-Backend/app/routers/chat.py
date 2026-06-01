from fastapi import APIRouter, HTTPException, status

from app.schemas.chat import ChatRequest, ChatResponse
from app.services.answer_generator import generate_answer

router = APIRouter()


@router.post("/chat", response_model=ChatResponse, status_code=status.HTTP_200_OK)
def chat(request: ChatRequest) -> ChatResponse:
    """
    학교 관련 질문을 받아 분류 → 매칭 → 답변을 반환합니다.
    question이 비어 있으면 Pydantic validator가 422를 반환합니다.
    """
    try:
        return generate_answer(request.question)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"답변 생성 중 오류가 발생했습니다: {str(e)}",
        )
