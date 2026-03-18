from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas.comic import (
    CharacterProfile,
    CharacterReferenceUpdateRequest,
    CharacterReferenceUploadResponse,
    CharacterUpdateRequest,
    ComfyObjectInfoSummary,
    ComfyQueue,
    ComfyStatus,
    ModelOption,
    SceneMemory,
    SceneMemoryUpdateRequest,
    WorkflowImportRequest,
    WorkflowPreset,
    WorkflowValidationRequest,
    WorkflowValidationResponse,
    WorkflowUpdateRequest,
)
from app.services.catalog_service import catalog_service
from app.services.comfyui_service import comfyui_service
from app.services.workflow_validator import validate_workflow

router = APIRouter()


@router.get("/models", response_model=list[ModelOption])
async def list_models() -> list[ModelOption]:
    return catalog_service.list_models()


@router.post("/models/sync", response_model=list[ModelOption])
async def sync_models() -> list[ModelOption]:
    synced_models = await comfyui_service.get_available_models()
    return catalog_service.sync_models(synced_models)


@router.get("/comfy/status", response_model=ComfyStatus)
async def comfy_status() -> ComfyStatus:
    return await comfyui_service.get_status()


@router.get("/comfy/queue", response_model=ComfyQueue)
async def comfy_queue() -> ComfyQueue:
    return await comfyui_service.get_queue()


@router.get("/comfy/object-info-summary", response_model=ComfyObjectInfoSummary)
async def comfy_object_info_summary() -> ComfyObjectInfoSummary:
    return await comfyui_service.get_object_info_summary()


@router.get("/workflows", response_model=list[WorkflowPreset])
async def list_workflows() -> list[WorkflowPreset]:
    return catalog_service.list_workflows()


@router.post("/workflows/import", response_model=WorkflowPreset)
async def import_workflow(payload: WorkflowImportRequest) -> WorkflowPreset:
    return catalog_service.import_workflow(payload)


@router.post("/workflows/validate", response_model=WorkflowValidationResponse)
async def validate_workflow_payload(
    payload: WorkflowValidationRequest,
) -> WorkflowValidationResponse:
    object_info = await comfyui_service.get_object_info()
    return validate_workflow(payload.workflow_json, object_info, payload.node_bindings)


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
    role: str = Form("support"),
    angle: str = Form(...),
    notes: str = Form(""),
) -> CharacterReferenceUploadResponse:
    try:
        content = await file.read()
        return catalog_service.add_character_reference(
            character_id=character_id,
            filename=file.filename or "reference.png",
            label=label,
            role=role,
            angle=angle,
            notes=notes,
            content=content,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/characters/{character_id}/references/{reference_id}", response_model=CharacterProfile)
async def update_character_reference(
    character_id: str,
    reference_id: str,
    payload: CharacterReferenceUpdateRequest,
) -> CharacterProfile:
    try:
        return catalog_service.update_character_reference(character_id, reference_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/characters/{character_id}/references/{reference_id}", response_model=CharacterProfile)
async def delete_character_reference(character_id: str, reference_id: str) -> CharacterProfile:
    try:
        return catalog_service.delete_character_reference(character_id, reference_id)
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
