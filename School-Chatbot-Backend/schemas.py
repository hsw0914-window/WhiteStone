from pydantic import BaseModel


class NavigateRequest(BaseModel):
    question: str
    lat: float
    lng: float


class ChatRequest(BaseModel):
    question: str


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    major: str = ""
    grade: int = 0


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    access_token: str


class GoogleCodeRequest(BaseModel):
    code: str
    code_verifier: str | None = None
    redirect_uri: str
    client_id: str | None = None


class SessionCreate(BaseModel):
    title: str = "새로운 대화"


class MessageCreate(BaseModel):
    text: str


class ProfileUpdateRequest(BaseModel):
    major: str | None = None
    grade: int | None = None


class RecommendRequest(BaseModel):
    major: str
    grade: int
