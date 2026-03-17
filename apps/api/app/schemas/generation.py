from pydantic import Field

from app.schemas.comic import CharacterProfile, ComicPanel, SceneMemory, WorkflowPreset
from app.schemas.base import ApiModel


class PromptPreviewRequest(ApiModel):
    panel: ComicPanel
    workflow: WorkflowPreset | None = None
    characters: list[CharacterProfile] = Field(default_factory=list)


class PromptPreviewResponse(ApiModel):
    user_prompt: str
    optimized_prompt: str
    continuity_hints: list[str] = Field(default_factory=list)
    scene_state: str


class ContinuityDraftRequest(ApiModel):
    current_panel: ComicPanel
    previous_panel: ComicPanel | None = None
    current_scene_memory: SceneMemory | None = None
    previous_scene_memory: SceneMemory | None = None
    characters: list[CharacterProfile] = Field(default_factory=list)


class ContinuityDraftResponse(ApiModel):
    prompt: str
    scene_summary: str
    shot_type: str
    style_notes: str
    continuity_hints: list[str] = Field(default_factory=list)


class GenerationJobRequest(ApiModel):
    project_id: str
    page_id: str
    panel: ComicPanel
    workflow: WorkflowPreset
    characters: list[CharacterProfile] = Field(default_factory=list)


class GenerationJobResponse(ApiModel):
    job_id: str
    status: str
    prompt_preview: PromptPreviewResponse
    workflow_payload: dict
    provider_response: dict | None = None


class GenerationJobStatus(ApiModel):
    job_id: str
    status: str
    panel_id: str | None = None
    prompt_id: str | None = None
    image_urls: list[str] = Field(default_factory=list)
    detail: str = ""


class GenerationCancelResponse(ApiModel):
    job_id: str
    status: str
    detail: str
