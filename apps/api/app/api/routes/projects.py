from fastapi import APIRouter, HTTPException

from app.schemas.comic import ComicProject
from app.services.catalog_service import catalog_service

router = APIRouter()


@router.get("/projects/bootstrap", response_model=ComicProject)
async def get_bootstrap_project() -> ComicProject:
    return catalog_service.get_project()


@router.get("/projects/{project_id}", response_model=ComicProject)
async def get_project(project_id: str) -> ComicProject:
    try:
        return catalog_service.get_project(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/projects/{project_id}", response_model=ComicProject)
async def save_project(project_id: str, payload: ComicProject) -> ComicProject:
    if payload.id != project_id:
        raise HTTPException(status_code=400, detail="Project id mismatch.")
    try:
        return catalog_service.save_project(payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
