from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, chat, health, insights, map, recommend, sessions
from services.startup_service import initialize_app

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await initialize_app()


app.include_router(health.router)
app.include_router(map.router)
app.include_router(chat.router)
app.include_router(auth.router)
app.include_router(recommend.router)
app.include_router(sessions.router)
app.include_router(insights.router)
