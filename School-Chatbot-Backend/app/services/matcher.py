"""
FAQ 매처.
카테고리와 키워드 중첩도를 기반으로 가장 적합한 FAQ 항목을 찾습니다.

DB 연동 시 교체 포인트:
  - _fetch_candidates() 함수 내부의 데이터 조회 부분만
    DB 쿼리(예: SQLAlchemy ORM)로 바꾸면 됩니다.
"""

from dataclasses import dataclass
from typing import Optional

from app.data.mock_data import get_all_faqs, get_faqs_by_category
from app.utils.text_utils import tokenize, compute_token_overlap

CATEGORY_BONUS = 0.3  # 같은 카테고리일 때 가산점


@dataclass
class MatchResult:
    faq: dict
    confidence: float


def _fetch_candidates(category: str) -> list[dict]:
    """
    후보 FAQ 목록을 가져옵니다.
    같은 카테고리를 우선으로 하되, 전체 목록도 포함합니다.

    ── DB 연동 시 이 함수 내부만 교체 ──
    예:
        primary = session.query(FAQ).filter(FAQ.category == category).all()
        fallback = session.query(FAQ).all()
        ...
    """
    primary = get_faqs_by_category(category)
    all_faqs = get_all_faqs()
    # 중복 없이 카테고리 일치 항목을 앞에 배치
    seen_ids = {faq["id"] for faq in primary}
    fallback = [faq for faq in all_faqs if faq["id"] not in seen_ids]
    return primary + fallback


def find_best_match(question: str, category: str) -> Optional[MatchResult]:
    """
    질문과 카테고리를 받아 가장 잘 맞는 FAQ와 confidence를 반환합니다.
    적합한 항목이 없으면 None을 반환합니다.
    """
    candidates = _fetch_candidates(category)
    if not candidates:
        return None

    question_tokens = tokenize(question)
    best: Optional[MatchResult] = None

    for faq in candidates:
        faq_tokens = tokenize(faq["question"]) + faq.get("keywords", [])
        overlap = compute_token_overlap(question_tokens, faq_tokens)

        # 카테고리 일치 가산점
        bonus = CATEGORY_BONUS if faq["category"] == category else 0.0

        # 키워드 직접 포함 여부 추가 가산점
        keyword_hit = sum(1 for kw in faq.get("keywords", []) if kw in question)
        keyword_bonus = min(keyword_hit * 0.1, 0.3)

        score = min(overlap + bonus + keyword_bonus, 1.0)

        if best is None or score > best.confidence:
            best = MatchResult(faq=faq, confidence=round(score, 4))

    # confidence가 너무 낮으면 매칭 실패로 간주
    if best and best.confidence < 0.05:
        return None

    return best
