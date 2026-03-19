export type GenerationMode = "bw" | "color";

export type ModelKind = "checkpoint" | "lora" | "controlnet" | "embedding";

export interface WorkflowParameter {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  defaultValue: string | number | boolean;
  options?: string[];
}

export interface WorkflowNodeBinding {
  id: string;
  nodeId: string;
  inputName: string;
  source:
    | "model"
    | "positive_prompt"
    | "negative_prompt"
    | "width"
    | "height"
    | "denoise"
    | "steps"
    | "cfg"
    | "sampler"
    | "scheduler"
    | "seed"
    | "source_image_url"
    | "mask_image_url"
    | "reference_image_url"
    | "primary_reference_image_url"
    | "face_reference_image_url"
    | "full_body_reference_image_url"
    | "outfit_reference_image_url"
    | "expression_reference_image_url"
    | "adapter_weight"
    | "appearance_adapter_weight"
    | "wardrobe_adapter_weight"
    | "expression_adapter_weight";
  provider?: "generic" | "ip-adapter" | "instantid";
  characterIndex?: number;
  label?: string;
}

export interface ModelOption {
  id: string;
  label: string;
  family: "sdxl";
  kind: ModelKind;
  tags: string[];
}

export interface WorkflowPreset {
  id: string;
  name: string;
  description: string;
  mode: GenerationMode;
  modelFamily: "sdxl";
  promptPrefix: string;
  controls: string[];
  templateKey:
    | "sdxl_text2img"
    | "sdxl_manga"
    | "sdxl_color_story"
    | "sdxl_manga_regen"
    | "sdxl_color_regen";
  parameters: WorkflowParameter[];
  nodeBindings: WorkflowNodeBinding[];
  workflowJson: Record<string, { class_type?: string; inputs?: Record<string, unknown> }>;
}

export interface WorkflowNodeSummary {
  nodeId: string;
  nodeType: string;
  inputNames: string[];
}

export interface WorkflowValidationIssue {
  level: "error" | "warning";
  code: string;
  message: string;
  nodeId?: string;
  nodeType?: string;
  inputName?: string;
}

export interface WorkflowValidationSummary {
  errorCount: number;
  warningCount: number;
  unknownNodeTypes: string[];
  missingCustomNodes: string[];
  mappedSources: string[];
  unmappedRecommendedSources: string[];
}

export interface WorkflowValidationResult {
  valid: boolean;
  issues: WorkflowValidationIssue[];
  summary: WorkflowValidationSummary;
  recommendedBindings: WorkflowPreset["nodeBindings"];
  detectedNodes: WorkflowNodeSummary[];
  checkedNodes: number;
  checkedBindings: number;
}

export interface CharacterReferenceImage {
  id: string;
  label: string;
  url: string;
  role: "primary" | "face" | "full-body" | "expression" | "outfit" | "support";
  angle: "front" | "three-quarter" | "profile" | "full-body" | "expression";
  notes: string;
}

export interface ConsistencyProfile {
  anchorFeatures: string[];
  forbiddenDrift: string[];
  paletteHints: string[];
  expressionDefaults: string[];
  bodyShape: string;
}

export interface CharacterConsistencyAdapter {
  provider: "none" | "ip-adapter" | "instantid";
  enabled: boolean;
  weight: number;
  referenceImageIds: string[];
}

export interface CharacterProfile {
  id: string;
  name: string;
  appearance: string;
  wardrobe: string;
  personality: string;
  negativePrompt: string;
  referenceNotes: string;
  references: CharacterReferenceImage[];
  consistency: ConsistencyProfile;
  adapter: CharacterConsistencyAdapter;
}

export interface CharacterConsistencySelection {
  characterId: string;
  characterName: string;
  readiness: "strong" | "partial" | "weak";
  score: number;
  anchorSummary: string;
  wardrobeLock: string;
  expressionCue: string;
  selectedReferenceIds: string[];
  selectedReferenceLabels: string[];
  selectedReferenceUrls: string[];
  adapterProvider: "none" | "ip-adapter" | "instantid";
  adapterEnabled: boolean;
  adapterWeight: number;
  promptHints: string[];
  negativeHints: string[];
  warnings: string[];
}

export interface PanelConsistencyPlan {
  readiness: "strong" | "partial" | "weak";
  score: number;
  summary: string;
  globalHints: string[];
  characterPlans: CharacterConsistencySelection[];
}

export interface PanelPromptSettings {
  prompt: string;
  negativePrompt: string;
  sceneSummary: string;
  shotType: string;
  styleNotes: string;
  revisionIntent: RevisionIntent;
}

export interface RevisionIntent {
  preserveComposition: boolean;
  preserveBackground: boolean;
  preserveCharacterIdentity: boolean;
  lockCharacterAppearance: boolean;
  lockCharacterWardrobe: boolean;
  lockCharacterExpression: boolean;
  lockCameraFraming: boolean;
  editPriority: "general" | "expression" | "pose" | "camera" | "lighting";
  changeInstructions: string;
  characterLocks?: CharacterContinuityLock[];
}

export interface CharacterContinuityLock {
  characterId: string;
  preserveCharacterIdentity?: boolean;
  lockCharacterAppearance?: boolean;
  lockCharacterWardrobe?: boolean;
  lockCharacterExpression?: boolean;
  lockCameraFraming?: boolean;
  note?: string;
}

export interface GenerationSettings {
  width: number;
  height: number;
  seed: number;
  steps: number;
  cfg: number;
  sampler: string;
  scheduler: string;
  denoise: number;
}

export interface InpaintMask {
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  feather: number;
}

export interface SceneMemory {
  id: string;
  location: string;
  timeOfDay: string;
  weather: string;
  lighting: string;
  mood: string;
  continuityNotes: string;
}

export interface CharacterContinuityState {
  characterId: string;
  characterName: string;
  expression: string;
  wardrobe: string;
  poseCue: string;
  framingCue: string;
  carriedReferenceIds: string[];
  notes: string;
}

export interface PanelContinuitySnapshot {
  continuitySummary: string;
  sourcePrompt: string;
  shotType: string;
  sceneSummary: string;
  styleNotes: string;
  characterStates: CharacterContinuityState[];
}

export interface ComicPanel {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  mode: GenerationMode;
  modelId: string;
  workflowPresetId: string;
  characterIds: string[];
  prompt: PanelPromptSettings;
  sceneMemoryId?: string;
  continuitySnapshot?: PanelContinuitySnapshot;
  inpaintMask: InpaintMask;
  generation: GenerationSettings;
  imageUrl?: string;
  latestJobStatus?: "idle" | "queued" | "running" | "complete" | "failed";
}

export interface ComicPageTemplate {
  id: string;
  name: string;
  panels: Array<Pick<ComicPanel, "x" | "y" | "width" | "height" | "rotation">>;
}

export interface ComicPage {
  id: string;
  title: string;
  width: number;
  height: number;
  panels: ComicPanel[];
}

export interface ComicProject {
  id: string;
  title: string;
  synopsis: string;
  pages: ComicPage[];
  models: ModelOption[];
  workflows: WorkflowPreset[];
  characters: CharacterProfile[];
  sceneMemories: SceneMemory[];
  templates: ComicPageTemplate[];
}

export interface PromptPreview {
  userPrompt: string;
  optimizedPrompt: string;
  continuityHints: string[];
  sceneState: string;
  consistencyPlan: PanelConsistencyPlan;
}

export interface PromptPreviewRequestPayload {
  panel: ComicPanel;
  workflow?: WorkflowPreset;
  characters: CharacterProfile[];
  previousPanel?: ComicPanel;
}

export interface GenerationJobRequestPayload {
  projectId: string;
  pageId: string;
  panel: ComicPanel;
  workflow: WorkflowPreset;
  characters: CharacterProfile[];
  previousPanel?: ComicPanel;
}

export interface DirectorChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DirectorBeat {
  id: string;
  title: string;
  description: string;
  shotType: string;
  mode: GenerationMode;
  focusCharacterIds: string[];
}

export interface DirectorPanelSuggestion {
  prompt: string;
  sceneSummary: string;
  shotType: string;
  styleNotes: string;
  mode?: GenerationMode;
  characterIds: string[];
  revisionIntent?: RevisionIntent;
}

export interface DirectorSceneSuggestion {
  location: string;
  timeOfDay: string;
  weather: string;
  lighting: string;
  mood: string;
  continuityNotes: string;
}

export interface DirectorDraftResult {
  assistantMessage: string;
  continuityHints: string[];
  suggestedPanelCount: number;
  selectedCharacterIds: string[];
  suggestedBeats: DirectorBeat[];
  panelSuggestion?: DirectorPanelSuggestion;
  sceneSuggestion?: DirectorSceneSuggestion;
}

export interface GenerationJobState {
  jobId: string;
  status: "queued" | "running" | "complete" | "failed" | "missing" | "cancelled";
  panelId?: string;
  promptId?: string;
  imageUrls: string[];
  detail: string;
}
