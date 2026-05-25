import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "chatbot.db")

KAKAO_JS_KEY = os.getenv("KAKAO_JS_KEY", "")
KAKAO_REST_KEY = os.getenv("KAKAO_REST_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GOOGLE_WEB_CLIENT_ID = os.getenv(
    "GOOGLE_WEB_CLIENT_ID",
    "985939853275-46vknlh7ahkag296e278h135qcuesm34.apps.googleusercontent.com",
)
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET") or os.getenv("GOOGLE_WEB_CLIENT_SECRET", "")

DISTANCE_THRESHOLD = 1.5
TOP_K = 3
SCOPE_DISTANCE_THRESHOLD = 1.65

VALID_MAJORS = {"빅데이터", "핀테크", "IoT", "AR·VR"}
GRADE_MIN = 1
GRADE_MAX = 4
