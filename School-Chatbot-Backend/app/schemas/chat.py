from pydantic import BaseModel, field_validator
from typing import Optional


class ChatRequest(BaseModel):
    question: str

    @field_validator("question")
    @classmethod
    def question_must_not_be_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("질문이 비어 있습니다. 질문을 입력해주세요.")
        return v.strip()


class ChatResponse(BaseModel):
    question: str
    category: str
    matched_question: Optional[str] = None
    answer: str
    source: str
    confidence: float
    related_url: Optional[str] = None
