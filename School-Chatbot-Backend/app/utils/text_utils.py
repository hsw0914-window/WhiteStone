"""텍스트 전처리 유틸리티."""

import re


def normalize(text: str) -> str:
    """공백 정규화 및 소문자 변환."""
    text = text.strip()
    text = re.sub(r"\s+", " ", text)
    return text


def tokenize(text: str) -> list[str]:
    """한국어 어절 단위로 토크나이징.
    추후 형태소 분석기(KoNLPy 등)로 교체 가능한 구조입니다.
    """
    text = normalize(text)
    # 특수문자 제거 후 공백 분리
    text = re.sub(r"[^\w\s가-힣]", " ", text)
    tokens = [t for t in text.split() if t]
    return tokens


def compute_token_overlap(tokens_a: list[str], tokens_b: list[str]) -> float:
    """두 토큰 리스트의 Jaccard 유사도를 반환합니다."""
    set_a = set(tokens_a)
    set_b = set(tokens_b)
    if not set_a and not set_b:
        return 0.0
    intersection = set_a & set_b
    union = set_a | set_b
    return len(intersection) / len(union)
