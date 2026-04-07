from fastapi import FastAPI
from pydantic import BaseModel
import json
import os
from google import genai

app = FastAPI()

class ChatRequest(BaseModel):
    question: str

# FAQ 데이터 불러오기
with open("faq_data.json", "r", encoding="utf-8") as f:
    faq_data = json.load(f)

# 질문 분류
def classify_question(question: str) -> str:
    q = question.lower()

    for category, data in faq_data.items():
        if category == "general":
            continue

        for keyword in data["keywords"]:
            if keyword.lower() in q:
                return category

    return "general"

# 카테고리에 맞는 기본 답변 찾기
def get_answer_by_category(category: str) -> str:
    return faq_data.get(category, faq_data["general"])["answer"]

# Gemini로 자연스러운 답변 생성
def generate_gemini_answer(question: str, category: str, base_answer: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise ValueError("GEMINI_API_KEY가 설정되지 않았습니다.")

    client = genai.Client(api_key=api_key)

    prompt = f"""
사용자 질문: {question}
분류 카테고리: {category}
기본 안내 정보: {base_answer}

위 정보를 바탕으로 대학생이 이해하기 쉽게
한국어로 2~3문장 이내로 자연스럽게 답변해줘.
제공된 정보 범위를 벗어나서 추측하지 말고,
모르면 모른다고 답해.
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    return getattr(response, "text", str(response))

@app.get("/")
def read_root():
    return {"message": "FastAPI 연결 성공"}

@app.get("/faq")
def get_faq():
    return faq_data

@app.post("/chat")
def chat(req: ChatRequest):
    try:
        category = classify_question(req.question)
        base_answer = get_answer_by_category(category)
        final_answer = generate_gemini_answer(req.question, category, base_answer)

        return {
            "question": req.question,
            "category": category,
            "base_answer": base_answer,
            "answer": final_answer
        }

    except Exception as e:
        return {
            "error": str(e)
        }