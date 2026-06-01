app/
├── main.py                  # FastAPI 앱 + CORS 미들웨어
├── core/config.py           # 환경 설정 (MATCH_THRESHOLD 등)
├── routers/
│   ├── health.py            # GET /health
│   └── chat.py              # POST /chat
├── schemas/chat.py          # ChatRequest / ChatResponse (Pydantic)
├── services/
│   ├── classifier.py        # 카테고리 분류 (키워드 점수 기반)
│   ├── matcher.py           # FAQ 매처 (Jaccard + 카테고리 가산점)
│   └── answer_generator.py  # 분류 → 매칭 → 응답 파이프라인
├── data/mock_data.py        # Mock FAQ 10개 + 조회 함수
└── utils/text_utils.py      # 토크나이징 / 유사도 계산


###실행방법

# 패키지 설치
pip install -r requirements.txt

# 서버 실행
uvicorn app.main:app --reload
Swagger UI: http://127.0.0.1:8000/docs