from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.api import projects, backlog, sprints, board


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="AI Teams Manager", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3340", "https://*.trycloudflare.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"https://.*\.trycloudflare\.com",
)

app.include_router(projects.router)
app.include_router(backlog.router)
app.include_router(sprints.router)
app.include_router(board.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
