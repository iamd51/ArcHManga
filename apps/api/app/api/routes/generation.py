from fastapi import APIRouter

from app.schemas.generation import (
    ContinuityDraftRequest,
    ContinuityDraftResponse,
    GenerationCancelResponse,
    GenerationJobRequest,
    GenerationJobResponse,
    GenerationJobStatus,
    PromptPreviewRequest,
    PromptPreviewResponse,
)
from app.services.orchestrator import generation_orchestrator
from app.services.qwen_service import qwen_prompt_service

router = APIRouter()


@router.post("/generation/prompt-preview", response_model=PromptPreviewResponse)
async def prompt_preview(payload: PromptPreviewRequest) -> PromptPreviewResponse:
    return await qwen_prompt_service.build_prompt_preview(payload)


@router.post("/generation/continuity-draft", response_model=ContinuityDraftResponse)
async def continuity_draft(payload: ContinuityDraftRequest) -> ContinuityDraftResponse:
    return await qwen_prompt_service.build_continuity_draft(payload)


@router.post("/generation/jobs", response_model=GenerationJobResponse)
async def create_generation_job(payload: GenerationJobRequest) -> GenerationJobResponse:
    return await generation_orchestrator.create_job(payload)


@router.get("/generation/jobs/{job_id}", response_model=GenerationJobStatus)
async def get_generation_job(job_id: str) -> GenerationJobStatus:
    return await generation_orchestrator.get_job(job_id)


@router.post("/generation/jobs/{job_id}/cancel", response_model=GenerationCancelResponse)
async def cancel_generation_job(job_id: str) -> GenerationCancelResponse:
    return await generation_orchestrator.cancel_job(job_id)
