"""
Mock 데이터 저장소.
나중에 DB 연동 시 이 파일의 조회 함수만 DB 쿼리로 교체하면 됩니다.
"""

from typing import Optional

MOCK_FAQ: list[dict] = [
    {
        "id": 1,
        "category": "학사일정",
        "question": "수강신청 기간은 언제인가요?",
        "answer": "수강신청은 학기별 공지된 일정에 따라 진행됩니다. 보통 직전 학기 말에 수강신청 기간이 공지되며, 학교 포털에서 확인하실 수 있습니다.",
        "keywords": ["수강신청", "기간", "일정", "학기"],
        "url": "https://example.ac.kr/schedule",
    },
    {
        "id": 2,
        "category": "학사일정",
        "question": "개강일과 종강일은 언제인가요?",
        "answer": "1학기는 보통 3월 초에 개강하고 6월 말에 종강합니다. 2학기는 9월 초에 개강하고 12월 말에 종강합니다. 정확한 일정은 학사 일정표를 확인해주세요.",
        "keywords": ["개강", "종강", "학기", "일정"],
        "url": "https://example.ac.kr/schedule",
    },
    {
        "id": 3,
        "category": "학사일정",
        "question": "중간고사와 기말고사 일정은 어떻게 되나요?",
        "answer": "중간고사는 학기 중반(약 8~9주차), 기말고사는 학기 말(약 16~17주차)에 진행됩니다. 자세한 시험 일정은 학사 일정표 또는 각 교과목 담당 교수에게 문의해 주세요.",
        "keywords": ["중간고사", "기말고사", "시험", "일정"],
        "url": "https://example.ac.kr/schedule",
    },
    {
        "id": 4,
        "category": "장학금",
        "question": "국가장학금 신청 기간은 언제인가요?",
        "answer": "국가장학금 신청은 한국장학재단 홈페이지(www.kosaf.go.kr)를 통해 학기별로 진행됩니다. 보통 학기 시작 전 약 1~2개월 전부터 신청이 시작되므로 공지사항을 반드시 확인해 주세요.",
        "keywords": ["국가장학금", "장학금", "신청기간", "장학", "지원금"],
        "url": "https://example.ac.kr/scholarship",
    },
    {
        "id": 5,
        "category": "장학금",
        "question": "교내 장학금 종류와 신청 방법이 궁금합니다.",
        "answer": "교내 장학금에는 성적 우수 장학금, 가계 곤란 장학금, 봉사 장학금 등이 있습니다. 학기 초 학생처 공지사항을 확인하고, 학교 포털에서 신청서를 제출하면 됩니다.",
        "keywords": ["장학금", "장학", "신청", "성적", "가계"],
        "url": "https://example.ac.kr/scholarship",
    },
    {
        "id": 6,
        "category": "시설",
        "question": "도서관 열람실 운영 시간이 어떻게 되나요?",
        "answer": "중앙도서관 열람실은 평일 오전 9시부터 오후 10시까지 운영됩니다. 시험 기간에는 24시간 운영될 수 있으며, 공휴일 운영 여부는 도서관 공지를 확인해주세요.",
        "keywords": ["도서관", "열람실", "운영시간", "시설"],
        "url": "https://example.ac.kr/library",
    },
    {
        "id": 7,
        "category": "시설",
        "question": "학생식당은 어디에 있나요?",
        "answer": "학생식당은 학생회관 1층에 위치해 있습니다. 운영 시간은 평일 오전 11시~오후 2시(점심), 오후 5시~오후 7시(저녁)입니다.",
        "keywords": ["식당", "어디", "위치", "학생회관", "시설"],
        "url": "https://example.ac.kr/facility",
    },
    {
        "id": 8,
        "category": "행정",
        "question": "휴학 신청은 어떻게 하나요?",
        "answer": "휴학 신청은 학기 시작 후 일정 기간 내에 학생처에 방문하거나 학교 포털을 통해 온라인으로 신청 가능합니다. 군 입대, 질병, 가계 곤란 등 사유에 따라 구비 서류가 다를 수 있습니다.",
        "keywords": ["휴학", "신청", "행정", "발급"],
        "url": "https://example.ac.kr/admin",
    },
    {
        "id": 9,
        "category": "행정",
        "question": "재학증명서 발급은 어떻게 하나요?",
        "answer": "재학증명서는 학교 포털 또는 무인 발급기에서 발급받을 수 있습니다. 온라인 발급 시 24시간 신청 가능하며, 무인 발급기는 행정관 1층에 설치되어 있습니다.",
        "keywords": ["증명서", "발급", "재학증명서", "행정", "신청"],
        "url": "https://example.ac.kr/admin",
    },
    {
        "id": 10,
        "category": "학과",
        "question": "졸업 요건이 어떻게 되나요?",
        "answer": "졸업 요건은 학과별로 다르나, 일반적으로 졸업 학점(보통 130학점 이상) 이수, 졸업 논문 또는 졸업 시험 통과, 영어 인증 요건 충족 등이 있습니다. 자세한 내용은 학과 사무실에 문의해 주세요.",
        "keywords": ["졸업", "학과", "요건", "학점", "전공"],
        "url": "https://example.ac.kr/department",
    },
]


# ── 데이터 접근 함수 ──────────────────────────────────────────────────────────
# 나중에 DB 연동 시 아래 함수들의 내부 구현만 교체하면 됩니다.

def get_all_faqs() -> list[dict]:
    """전체 FAQ 목록을 반환합니다."""
    return MOCK_FAQ


def get_faqs_by_category(category: str) -> list[dict]:
    """특정 카테고리의 FAQ 목록을 반환합니다."""
    return [faq for faq in MOCK_FAQ if faq["category"] == category]


def get_faq_by_id(faq_id: int) -> Optional[dict]:
    """ID로 단일 FAQ를 반환합니다."""
    for faq in MOCK_FAQ:
        if faq["id"] == faq_id:
            return faq
    return None
