from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes.generation import router as generation_router
from app.api.routes.health import router as health_router
from app.api.routes.models import router as models_router
from app.api.routes.projects import router as projects_router
from app.core.config import get_settings


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


settings = get_settings()

app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, tags=["health"])
app.include_router(models_router, prefix="/api", tags=["models"])
app.include_router(projects_router, prefix="/api", tags=["projects"])
app.include_router(generation_router, prefix="/api", tags=["generation"])
app.mount("/static", StaticFiles(directory="storage"), name="static")
