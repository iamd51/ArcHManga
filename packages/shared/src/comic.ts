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
    | "steps"
    | "cfg"
    | "sampler"
    | "scheduler"
    | "seed"
    | "reference_image_url"
    | "adapter_weight";
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
  templateKey: "sdxl_text2img" | "sdxl_manga" | "sdxl_color_story";
  parameters: WorkflowParameter[];
  nodeBindings: WorkflowNodeBinding[];
  workflowJson: Record<string, { class_type?: string; inputs?: Record<string, unknown> }>;
}

export interface CharacterReferenceImage {
  id: string;
  label: string;
  url: string;
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

export interface PanelPromptSettings {
  prompt: string;
  negativePrompt: string;
  sceneSummary: string;
  shotType: string;
  styleNotes: string;
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

export interface SceneMemory {
  id: string;
  location: string;
  timeOfDay: string;
  weather: string;
  lighting: string;
  mood: string;
  continuityNotes: string;
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
}

export interface GenerationJobState {
  jobId: string;
  status: "queued" | "running" | "complete" | "failed" | "missing";
  panelId?: string;
  promptId?: string;
  imageUrls: string[];
  detail: string;
}
