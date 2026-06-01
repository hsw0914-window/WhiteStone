import requests

from config import ANTHROPIC_API_KEY, CLAUDE_MODEL


class AIClientError(RuntimeError):
    pass


class MissingAIKeyError(AIClientError):
    pass


def has_ai_key() -> bool:
    return bool(ANTHROPIC_API_KEY)


def generate_ai_text(prompt: str, max_tokens: int = 900, timeout: int = 30) -> str:
    if not ANTHROPIC_API_KEY:
        raise MissingAIKeyError("ANTHROPIC_API_KEY is not configured.")

    response = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": CLAUDE_MODEL,
            "max_tokens": max_tokens,
            "messages": [
                {"role": "user", "content": prompt},
            ],
        },
        timeout=timeout,
    )
    response.raise_for_status()

    data = response.json()
    blocks = data.get("content") or []
    text_parts = [
        block.get("text", "")
        for block in blocks
        if isinstance(block, dict) and block.get("type") == "text"
    ]
    text = "".join(text_parts).strip()
    if not text:
        raise AIClientError("Claude returned an empty response.")
    return text
