# School Chatbot Backend

학교 안내 AI 챗봇 백엔드 서버입니다.  
현재는 Mock 데이터 기반 키워드 매칭으로 동작하며, DB 연동 없이 즉시 실행 가능합니다.

---

## 프로젝트 구조

```
school-chatbot-backend/
├── app/
│   ├── main.py                  # FastAPI 앱 진입점
│   ├── core/
│   │   └── config.py            # 환경 설정 (pydantic-settings)
│   ├── routers/
│   │   ├── health.py            # GET /health
│   │   └── chat.py              # POST /chat
│   ├── schemas/
│   │   └── chat.py              # ChatRequest / ChatResponse
│   ├── services/
│   │   ├── classifier.py        # 카테고리 분류기
│   │   ├── matcher.py           # FAQ 매처 (DB 교체 포인트)
│   │   └── answer_generator.py  # 분류 → 매칭 → 응답 파이프라인
│   ├── data/
│   │   └── mock_data.py         # Mock FAQ 데이터 + 조회 함수
│   └── utils/
│       └── text_utils.py        # 토크나이징 / 유사도 계산
├── requirements.txt
└── README.md
```

---

## 실행 방법

### 1. 가상환경 생성 및 패키지 설치

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 2. 서버 실행

```bash
uvicorn app.main:app --reload
```

서버가 실행되면 아래 주소로 접근할 수 있습니다.

- API 서버: http://127.0.0.1:8000
- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

---

## API 명세

### GET /health

서버 상태 확인

**응답 예시**
```json
{
  "status": "ok",
  "message": "server is running"
}
```

---

### POST /chat

학교 관련 질문에 대한 답변 반환

**요청 예시**
```json
{
  "question": "수강신청 기간 언제예요?"
}
```

**응답 예시**
```json
{
  "question": "수강신청 기간 언제예요?",
  "category": "학사일정",
  "matched_question": "수강신청 기간은 언제인가요?",
  "answer": "수강신청은 학기별 공지된 일정에 따라 진행됩니다.",
  "source": "mock_data",
  "confidence": 0.7857,
  "related_url": "https://example.ac.kr/schedule"
}
```

**에러 응답 (빈 질문)**
```json
{
  "detail": [
    {
      "msg": "질문이 비어 있습니다. 질문을 입력해주세요."
    }
  ]
}
```

---

## 카테고리

| 카테고리 | 관련 키워드 |
|---------|-----------|
| 학사일정 | 수강신청, 개강, 종강, 학기, 시험, 중간고사, 기말고사 |
| 장학금   | 장학금, 국가장학, 지원금, 장학, 신청기간 |
| 시설     | 도서관, 위치, 열람실, 강의실, 어디 |
| 행정     | 휴학, 복학, 증명서, 신청, 발급, 등록 |
| 학과     | 학과, 전공, 졸업, 교과과정, 교수 |
| 기타     | 위 카테고리에 해당하지 않는 질문 |

---

## DB 연동 가이드

DB를 연동할 때는 아래 두 파일만 수정하면 됩니다.

### 1. `app/data/mock_data.py`

`get_all_faqs()`, `get_faqs_by_category()`, `get_faq_by_id()` 함수 내부를  
SQLAlchemy / SQLModel 등 ORM 쿼리로 교체합니다.

```python
# 예시 (SQLAlchemy)
def get_faqs_by_category(category: str) -> list[dict]:
    with Session(engine) as session:
        rows = session.exec(select(FAQ).where(FAQ.category == category)).all()
        return [row.model_dump() for row in rows]
```

### 2. `app/services/matcher.py`

`_fetch_candidates()` 함수 내부의 데이터 소스를 DB 쿼리로 교체합니다.  
나머지 점수 계산 로직은 그대로 유지됩니다.

### 3. `app/schemas/chat.py`의 `source` 필드

응답의 `source` 필드를 `"mock_data"` → `"database"` 로 변경합니다.
