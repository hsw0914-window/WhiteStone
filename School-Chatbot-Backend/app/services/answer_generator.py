"""
답변 생성기.
매처 결과를 받아 ChatResponse 형식으로 변환합니다.
추후 LLM 기반 답변 생성으로 교체 가능한 구조입니다.
"""

from app.schemas.chat import ChatResponse
from app.services.classifier import classify
from app.services.matcher import find_best_match

FALLBACK_ANSWER = (
    "관련된 학교 정보를 찾지 못했습니다. 질문을 조금 더 구체적으로 입력해주세요."
)


def generate_answer(question: str) -> ChatResponse:
    """
    질문을 받아 분류 → 매칭 → 응답 생성 파이프라인을 실행합니다.
    """
    category = classify(question)
    match = find_best_match(question, category)

    if match is None:
        return ChatResponse(
            question=question,
            category=category,
            matched_question=None,
            answer=FALLBACK_ANSWER,
            source="mock_data",
            confidence=0.0,
            related_url=None,
        )

    faq = match.faq
    return ChatResponse(
        question=question,
        category=faq["category"],
        matched_question=faq["question"],
        answer=faq["answer"],
        source="mock_data",
        confidence=match.confidence,
        related_url=faq.get("url"),
    )
