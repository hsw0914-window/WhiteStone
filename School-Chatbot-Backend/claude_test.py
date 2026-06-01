from dotenv import load_dotenv

from ai_client import generate_ai_text


load_dotenv()

print(generate_ai_text("테스트 문장 하나만 한국어로 출력해줘.", max_tokens=120))
