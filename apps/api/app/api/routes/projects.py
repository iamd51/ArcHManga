from fastapi import APIRouter

from app.schemas.comic import ComicProject
from app.services.catalog_service import catalog_service

router = APIRouter()


@router.get("/projects/bootstrap", response_model=ComicProject)
async def get_bootstrap_project() -> ComicProject:
    return catalog_service.get_project()
