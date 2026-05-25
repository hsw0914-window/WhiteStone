from datetime import datetime, timedelta

from fastapi import APIRouter, Depends

from app.db import get_conn
from app.routers.auth import get_current_user
from app.services.answer_generator import generate_answer

router = APIRouter(prefix="/insights")

RECOMMENDATIONS = {
    "학사일정": {
        "blurb": "최근 학사일정 관련 질문이 많아요. 마감일과 처리 기준을 먼저 확인하면 놓치는 일을 줄일 수 있어요.",
        "questions": ["이번 학기 주요 학사일정을 알려줘", "성적 처리와 정정 기간은 언제야?", "휴학이나 복학 신청 기간을 알려줘"],
    },
    "수강신청": {
        "blurb": "수강신청은 일정, 제한 조건, 변경 기간을 함께 확인하는 게 좋아요.",
        "questions": ["수강신청 변경 기간은 언제야?", "수강신청할 때 유의해야 할 점을 알려줘", "전공 과목 신청 기준을 알려줘"],
    },
    "장학금": {
        "blurb": "장학금은 신청 조건과 제출 서류를 놓치기 쉬워서 미리 정리해두면 좋아요.",
        "questions": ["신청 가능한 장학금 종류를 알려줘", "장학금 신청 기간과 제출 서류를 알려줘", "성적 장학금 기준을 알려줘"],
    },
    "기숙사": {
        "blurb": "기숙사 관련 질문이 반복되고 있어요. 신청, 외박, 식단처럼 자주 쓰는 정보를 바로 확인해보세요.",
        "questions": ["기숙사 입사 신청 방법을 알려줘", "기숙사 외박 신청은 어디서 해?", "오늘 기숙사 식단을 알려줘"],
    },
    "교통/버스": {
        "blurb": "통학이나 셔틀 이용 정보는 시간표와 노선을 같이 확인하는 게 좋아요.",
        "questions": ["셔틀버스 시간표를 알려줘", "천안역에서 학교까지 가는 방법을 알려줘", "캠퍼스 순환버스 노선을 알려줘"],
    },
    "도서관": {
        "blurb": "도서관 이용 시간, 대출, 열람실 정보를 자주 확인하면 공부 동선이 편해져요.",
        "questions": ["도서관 운영 시간을 알려줘", "도서 대출 기간은 며칠이야?", "열람실 이용 방법을 알려줘"],
    },
    "등록금": {
        "blurb": "등록금은 납부 기간과 고지서 확인 방법을 먼저 보는 게 좋아요.",
        "questions": ["등록금 납부 기간을 알려줘", "등록금 고지서는 어디서 확인해?", "등록금 분할 납부가 가능한지 알려줘"],
    },
}

DEFAULT_RECOMMENDATION = {
    "blurb": "최근 질문 패턴을 기준으로 다음에 확인하면 좋을 내용을 추천했어요.",
    "questions": ["이 주제에서 꼭 알아야 할 내용을 정리해줘", "관련해서 자주 묻는 질문을 알려줘", "내가 놓치기 쉬운 부분을 알려줘"],
}


@router.get("")
def get_insights(days: int = 30, current_user: dict = Depends(get_current_user)):
    period_days = max(1, min(days, 365))
    cutoff = (datetime.now() - timedelta(days=period_days)).isoformat()
    conn = get_conn()
    try:
        rows = conn.execute(
            """
            SELECT m.id, m.text, m.category, m.confidence
            FROM messages m
            JOIN chat_sessions s ON s.id = m.session_id
            WHERE s.user_id = ?
              AND m.role = 'user'
              AND m.created_at >= ?
            ORDER BY m.id ASC
            """,
            (current_user["id"], cutoff),
        ).fetchall()

        counts = {}
        confidence_sum = {}
        for row in rows:
            category = (row["category"] or "").strip()
            confidence = row["confidence"]

            if not category:
                result = generate_answer(row["text"])
                category = result.category or "기타"
                confidence = result.confidence
                conn.execute(
                    "UPDATE messages SET category = ?, confidence = ? WHERE id = ?",
                    (category, float(confidence or 0.0), row["id"]),
                )

            counts[category] = counts.get(category, 0) + 1
            confidence_sum[category] = confidence_sum.get(category, 0.0) + float(confidence or 0.0)

        if rows:
            conn.commit()

        total = sum(counts.values())
        categories = []
        for category, count in sorted(counts.items(), key=lambda item: item[1], reverse=True):
            categories.append({
                "name": category,
                "count": count,
                "percent": round((count / total) * 100) if total else 0,
                "confidence": round(confidence_sum.get(category, 0.0) / count, 2) if count else 0.0,
            })

        top = categories[0] if categories else None
        topic = top["name"] if top else "기타"
        recommendation = RECOMMENDATIONS.get(topic, DEFAULT_RECOMMENDATION)

        return {
            "period_days": period_days,
            "total": total,
            "daily_average": round(total / period_days, 1),
            "topic_count": len(categories),
            "categories": categories,
            "top_category": top,
            "recommendation": {
                "topic": topic,
                "blurb": recommendation["blurb"],
                "questions": recommendation["questions"],
            },
        }
    finally:
        conn.close()
