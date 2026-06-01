"""
질문 카테고리 분류기.
키워드 기반으로 카테고리를 결정합니다.
추후 ML 모델이나 LLM 분류기로 교체 가능한 구조입니다.
"""

from app.utils.text_utils import tokenize

# 카테고리별 키워드 사전
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "학사일정": ["수강신청", "개강", "종강", "학기", "일정", "시험", "중간고사", "기말고사", "학사"],
    "장학금": ["장학금", "국가장학", "지원금", "장학", "신청기간", "한국장학재단"],
    "시설": ["도서관", "건물", "위치", "열람실", "강의실", "사무실", "어디", "식당", "주차"],
    "행정": ["휴학", "복학", "증명서", "신청", "발급", "등록", "재학", "졸업증명"],
    "학과": ["학과", "전공", "졸업", "교과과정", "교수", "커리큘럼", "학점"],
    "기타": [],
}


def classify(question: str) -> str:
    """
    질문 문자열을 받아 카테고리 문자열을 반환합니다.
    매칭되는 카테고리가 없으면 '기타'를 반환합니다.
    """
    tokens = set(tokenize(question))
    scores: dict[str, int] = {cat: 0 for cat in CATEGORY_KEYWORDS}

    for category, keywords in CATEGORY_KEYWORDS.items():
        if category == "기타":
            continue
        for keyword in keywords:
            if keyword in question:  # 원문 포함 검사
                scores[category] += 2
            # 토큰 레벨 검사
            for token in tokens:
                if keyword in token or token in keyword:
                    scores[category] += 1

    best_category = max(scores, key=lambda c: scores[c])
    if scores[best_category] == 0:
        return "기타"
    return best_category
