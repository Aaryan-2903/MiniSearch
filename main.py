"""
main.py
-------
FastAPI application entry point.

Startup sequence:
    1. Load environment variables from .env
    2. Initialise the SQLite database (create tables if they don't exist)
    3. Register all API routers

Run the server with:
    uvicorn main:app --reload
"""

from contextlib import asynccontextmanager

from dotenv import load_dotenv

# Load .env BEFORE any app module is imported so that os.getenv() calls
# in database.py and document_service.py see the correct values.
load_dotenv()

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from app.db.database import init_db  # noqa: E402
from app.api import health, documents, search, index  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs once at startup to initialise the database schema."""
    init_db()
    yield


app = FastAPI(
    title="MiniSearch",
    description=(
        "A lightweight full-text search engine built with FastAPI and SQLite. "
        "Supports document upload, inverted index construction, and TF-IDF ranked search."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
# Add allowed origins here as the app is deployed to new environments.
ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite dev server (local development)
    # "https://your-production-domain.com",  # Add production URL when deploying
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routers ───────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(documents.router)
app.include_router(search.router)
app.include_router(index.router)
