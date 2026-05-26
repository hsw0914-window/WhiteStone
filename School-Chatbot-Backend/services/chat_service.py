import runtime
from schemas import ChatRequest


def chat(req: ChatRequest):
    try:
        return runtime.process_chat_question(req.question)
    except Exception as exc:
        return {"error": str(exc)}
