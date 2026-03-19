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


class ComfyStatus(ApiModel):
    connected: bool
    base_url: str
    available_endpoints: list[str] = Field(default_factory=list)
    model_counts: dict[str, int] = Field(default_factory=dict)
    detail: str = ""


class ComfyQueue(ApiModel):
    running_count: int = 0
    pending_count: int = 0
    running_prompt_ids: list[str] = Field(default_factory=list)
    pending_prompt_ids: list[str] = Field(default_factory=list)
    detail: str = ""


class ComfyObjectInfoSummary(ApiModel):
    node_count: int = 0
    node_names: list[str] = Field(default_factory=list)
    sample_inputs: dict[str, list[str]] = Field(default_factory=dict)


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
    role: str = "support"
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


class CharacterConsistencySelection(ApiModel):
    character_id: str
    character_name: str
    readiness: str = "weak"
    score: int = 0
    anchor_summary: str = ""
    wardrobe_lock: str = ""
    expression_cue: str = ""
    selected_reference_ids: list[str] = Field(default_factory=list)
    selected_reference_labels: list[str] = Field(default_factory=list)
    selected_reference_urls: list[str] = Field(default_factory=list)
    adapter_provider: str = "none"
    adapter_enabled: bool = False
    adapter_weight: float = 0
    prompt_hints: list[str] = Field(default_factory=list)
    negative_hints: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class PanelConsistencyPlan(ApiModel):
    readiness: str = "weak"
    score: int = 0
    summary: str = ""
    global_hints: list[str] = Field(default_factory=list)
    character_plans: list[CharacterConsistencySelection] = Field(default_factory=list)


class CharacterUpdateRequest(ApiModel):
    reference_notes: str | None = None
    negative_prompt: str | None = None
    consistency: ConsistencyProfile | None = None
    adapter: CharacterConsistencyAdapter | None = None


class CharacterReferenceUpdateRequest(ApiModel):
    label: str | None = None
    role: str | None = None
    angle: str | None = None
    notes: str | None = None


class RevisionIntent(ApiModel):
    preserve_composition: bool = False
    preserve_background: bool = False
    preserve_character_identity: bool = True
    edit_priority: str = "general"
    change_instructions: str = ""


class PanelPromptSettings(ApiModel):
    prompt: str = ""
    negative_prompt: str = ""
    scene_summary: str = ""
    shot_type: str = ""
    style_notes: str = ""
    revision_intent: RevisionIntent = Field(default_factory=RevisionIntent)


class GenerationSettings(ApiModel):
    width: int
    height: int
    seed: int
    steps: int
    cfg: float
    sampler: str
    scheduler: str
    denoise: float = 1.0


class InpaintMask(ApiModel):
    enabled: bool = False
    x: float = 0.25
    y: float = 0.2
    width: float = 0.5
    height: float = 0.4
    feather: int = 24


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
    inpaint_mask: InpaintMask = Field(default_factory=InpaintMask)
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


class WorkflowNodeSummary(ApiModel):
    node_id: str
    node_type: str
    input_names: list[str] = Field(default_factory=list)


class WorkflowValidationIssue(ApiModel):
    level: str
    code: str
    message: str
    node_id: str | None = None
    node_type: str | None = None
    input_name: str | None = None


class WorkflowValidationSummary(ApiModel):
    error_count: int = 0
    warning_count: int = 0
    unknown_node_types: list[str] = Field(default_factory=list)
    missing_custom_nodes: list[str] = Field(default_factory=list)
    mapped_sources: list[str] = Field(default_factory=list)
    unmapped_recommended_sources: list[str] = Field(default_factory=list)


class WorkflowValidationRequest(ApiModel):
    workflow_json: dict
    node_bindings: list[WorkflowNodeBinding] = Field(default_factory=list)


class WorkflowValidationResponse(ApiModel):
    valid: bool
    issues: list[WorkflowValidationIssue] = Field(default_factory=list)
    summary: WorkflowValidationSummary = Field(default_factory=WorkflowValidationSummary)
    recommended_bindings: list[WorkflowNodeBinding] = Field(default_factory=list)
    detected_nodes: list[WorkflowNodeSummary] = Field(default_factory=list)
    checked_nodes: int = 0
    checked_bindings: int = 0


class CharacterReferenceUploadResponse(ApiModel):
    character_id: str
    reference: CharacterReferenceImage
