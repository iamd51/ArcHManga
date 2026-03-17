from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas.comic import (
    CharacterProfile,
    CharacterReferenceUploadResponse,
    CharacterUpdateRequest,
    ModelOption,
    SceneMemory,
    SceneMemoryUpdateRequest,
    WorkflowImportRequest,
    WorkflowPreset,
    WorkflowUpdateRequest,
)
from app.services.catalog_service import catalog_service

router = APIRouter()


@router.get("/models", response_model=list[ModelOption])
async def list_models() -> list[ModelOption]:
    return catalog_service.list_models()


@router.get("/workflows", response_model=list[WorkflowPreset])
async def list_workflows() -> list[WorkflowPreset]:
    return catalog_service.list_workflows()


@router.post("/workflows/import", response_model=WorkflowPreset)
async def import_workflow(payload: WorkflowImportRequest) -> WorkflowPreset:
    return catalog_service.import_workflow(payload)


@router.patch("/workflows/{workflow_id}", response_model=WorkflowPreset)
async def update_workflow(workflow_id: str, payload: WorkflowUpdateRequest) -> WorkflowPreset:
    try:
        return catalog_service.update_workflow(workflow_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post(
    "/characters/{character_id}/references",
    response_model=CharacterReferenceUploadResponse,
)
async def upload_character_reference(
    character_id: str,
    file: UploadFile = File(...),
    label: str = Form(...),
    angle: str = Form(...),
    notes: str = Form(""),
) -> CharacterReferenceUploadResponse:
    try:
        content = await file.read()
        return catalog_service.add_character_reference(
            character_id=character_id,
            filename=file.filename or "reference.png",
            label=label,
            angle=angle,
            notes=notes,
            content=content,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/characters/{character_id}", response_model=CharacterProfile)
async def update_character(character_id: str, payload: CharacterUpdateRequest) -> CharacterProfile:
    try:
        return catalog_service.update_character(character_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/scene-memories/{scene_memory_id}", response_model=SceneMemory)
async def update_scene_memory(
    scene_memory_id: str, payload: SceneMemoryUpdateRequest
) -> SceneMemory:
    try:
        return catalog_service.update_scene_memory(scene_memory_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
