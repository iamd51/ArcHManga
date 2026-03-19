from pydantic import Field

from app.schemas.comic import (
    CharacterProfile,
    PanelConsistencyPlan,
    ComicPage,
    ComicPanel,
    RevisionIntent,
    SceneMemory,
    WorkflowPreset,
)
from app.schemas.base import ApiModel


class PromptPreviewRequest(ApiModel):
    panel: ComicPanel
    workflow: WorkflowPreset | None = None
    characters: list[CharacterProfile] = Field(default_factory=list)
    previous_panel: ComicPanel | None = None


class PromptPreviewResponse(ApiModel):
    user_prompt: str
    optimized_prompt: str
    continuity_hints: list[str] = Field(default_factory=list)
    scene_state: str
    consistency_plan: PanelConsistencyPlan = Field(default_factory=PanelConsistencyPlan)


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


class DirectorChatMessage(ApiModel):
    role: str
    content: str


class DirectorBeat(ApiModel):
    id: str
    title: str
    description: str
    shot_type: str = ""
    mode: str = "bw"
    focus_character_ids: list[str] = Field(default_factory=list)


class DirectorPanelSuggestion(ApiModel):
    prompt: str
    scene_summary: str = ""
    shot_type: str = ""
    style_notes: str = ""
    mode: str | None = None
    character_ids: list[str] = Field(default_factory=list)
    revision_intent: RevisionIntent | None = None


class DirectorSceneSuggestion(ApiModel):
    location: str = ""
    time_of_day: str = ""
    weather: str = ""
    lighting: str = ""
    mood: str = ""
    continuity_notes: str = ""


class DirectorDraftRequest(ApiModel):
    user_message: str
    history: list[DirectorChatMessage] = Field(default_factory=list)
    context_summary: str = ""
    project: dict
    current_page: ComicPage
    selected_panel: ComicPanel | None = None
    current_scene_memory: SceneMemory | None = None
    previous_panel: ComicPanel | None = None
    previous_scene_memory: SceneMemory | None = None
    selected_characters: list[CharacterProfile] = Field(default_factory=list)
    available_characters: list[CharacterProfile] = Field(default_factory=list)


class DirectorDraftResponse(ApiModel):
    assistant_message: str
    continuity_hints: list[str] = Field(default_factory=list)
    suggested_panel_count: int = 1
    selected_character_ids: list[str] = Field(default_factory=list)
    suggested_beats: list[DirectorBeat] = Field(default_factory=list)
    panel_suggestion: DirectorPanelSuggestion | None = None
    scene_suggestion: DirectorSceneSuggestion | None = None


class GenerationJobRequest(ApiModel):
    project_id: str
    page_id: str
    panel: ComicPanel
    workflow: WorkflowPreset
    characters: list[CharacterProfile] = Field(default_factory=list)
    previous_panel: ComicPanel | None = None


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
