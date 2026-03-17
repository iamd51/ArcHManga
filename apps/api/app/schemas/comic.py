from pydantic import Field

from app.schemas.base import ApiModel


class WorkflowParameter(ApiModel):
    key: str
    label: str
    type: str
    default_value: str | int | float | bool
    options: list[str] = Field(default_factory=list)


class WorkflowNodeBinding(ApiModel):
    id: str
    node_id: str
    input_name: str
    source: str
    provider: str = "generic"
    character_index: int = 0
    label: str | None = None


class ModelOption(ApiModel):
    id: str
    label: str
    family: str = "sdxl"
    kind: str
    tags: list[str] = Field(default_factory=list)


class WorkflowPreset(ApiModel):
    id: str
    name: str
    description: str
    mode: str
    model_family: str = "sdxl"
    prompt_prefix: str
    controls: list[str] = Field(default_factory=list)
    template_key: str
    parameters: list[WorkflowParameter] = Field(default_factory=list)
    node_bindings: list[WorkflowNodeBinding] = Field(default_factory=list)
    workflow_json: dict = Field(default_factory=dict)


class CharacterReferenceImage(ApiModel):
    id: str
    label: str
    url: str
    angle: str
    notes: str


class ConsistencyProfile(ApiModel):
    anchor_features: list[str] = Field(default_factory=list)
    forbidden_drift: list[str] = Field(default_factory=list)
    palette_hints: list[str] = Field(default_factory=list)
    expression_defaults: list[str] = Field(default_factory=list)
    body_shape: str = ""


class CharacterConsistencyAdapter(ApiModel):
    provider: str = "none"
    enabled: bool = False
    weight: float = 0.6
    reference_image_ids: list[str] = Field(default_factory=list)


class CharacterProfile(ApiModel):
    id: str
    name: str
    appearance: str
    wardrobe: str
    personality: str
    negative_prompt: str
    reference_notes: str
    references: list[CharacterReferenceImage] = Field(default_factory=list)
    consistency: ConsistencyProfile = Field(default_factory=ConsistencyProfile)
    adapter: CharacterConsistencyAdapter = Field(default_factory=CharacterConsistencyAdapter)


class CharacterUpdateRequest(ApiModel):
    reference_notes: str | None = None
    negative_prompt: str | None = None
    consistency: ConsistencyProfile | None = None
    adapter: CharacterConsistencyAdapter | None = None


class PanelPromptSettings(ApiModel):
    prompt: str = ""
    negative_prompt: str = ""
    scene_summary: str = ""
    shot_type: str = ""
    style_notes: str = ""


class GenerationSettings(ApiModel):
    width: int
    height: int
    seed: int
    steps: int
    cfg: float
    sampler: str
    scheduler: str
    denoise: float = 1.0


class SceneMemory(ApiModel):
    id: str
    location: str
    time_of_day: str
    weather: str
    lighting: str
    mood: str
    continuity_notes: str


class SceneMemoryUpdateRequest(ApiModel):
    location: str | None = None
    time_of_day: str | None = None
    weather: str | None = None
    lighting: str | None = None
    mood: str | None = None
    continuity_notes: str | None = None


class ComicPanel(ApiModel):
    id: str
    title: str
    x: float
    y: float
    width: float
    height: float
    rotation: float = 0
    mode: str
    model_id: str
    workflow_preset_id: str
    character_ids: list[str] = Field(default_factory=list)
    prompt: PanelPromptSettings = Field(default_factory=PanelPromptSettings)
    scene_memory_id: str | None = None
    generation: GenerationSettings
    image_url: str | None = None
    latest_job_status: str = "idle"


class ComicPage(ApiModel):
    id: str
    title: str
    width: int
    height: int
    panels: list[ComicPanel] = Field(default_factory=list)


class ComicPageTemplate(ApiModel):
    id: str
    name: str
    panels: list[dict] = Field(default_factory=list)


class ComicProject(ApiModel):
    id: str
    title: str
    synopsis: str
    models: list[ModelOption] = Field(default_factory=list)
    workflows: list[WorkflowPreset] = Field(default_factory=list)
    characters: list[CharacterProfile] = Field(default_factory=list)
    scene_memories: list[SceneMemory] = Field(default_factory=list)
    templates: list[ComicPageTemplate] = Field(default_factory=list)
    pages: list[ComicPage] = Field(default_factory=list)


class WorkflowImportRequest(ApiModel):
    name: str
    description: str
    mode: str
    prompt_prefix: str = ""
    template_key: str = "sdxl_text2img"
    workflow_json: dict


class WorkflowUpdateRequest(ApiModel):
    prompt_prefix: str | None = None
    node_bindings: list[WorkflowNodeBinding] | None = None


class CharacterReferenceUploadResponse(ApiModel):
    character_id: str
    reference: CharacterReferenceImage
