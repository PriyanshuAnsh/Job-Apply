"""
J.A.R.V.I.S. Job Agent Backend — FastAPI entry point
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from database import init_db
from routers.agent import router as agent_router
from routers.crud import (
    companies_router,
    jobs_router,
    applications_router,
    profile_router,
)

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    await init_db()
    yield


app = FastAPI(
    title="J.A.R.V.I.S. Job Agent API",
    description="AI-powered job discovery and auto-application backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Vite dev server
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(agent_router,       prefix="/api")
app.include_router(companies_router,   prefix="/api")
app.include_router(jobs_router,        prefix="/api")
app.include_router(applications_router, prefix="/api")
app.include_router(profile_router,     prefix="/api")


@app.get("/")
async def root():
    return {"status": "online", "app": "J.A.R.V.I.S. Job Agent"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )
