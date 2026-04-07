from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "School Chatbot API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    GEMINI_API_KEY: str = ""

    # 매칭 임계값: 이 값 미만이면 fallback 메시지 반환
    MATCH_THRESHOLD: float = 0.1

    class Config:
        env_file = ".env"


settings = Settings()
