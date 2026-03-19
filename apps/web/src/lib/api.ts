import type {
  CharacterProfile,
  ComicProject,
  ComicPanel,
  DirectorChatMessage,
  DirectorDraftResult,
  GenerationJobState,
  PromptPreview,
  WorkflowValidationResult,
  WorkflowPreset
} from "@archmanga/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function fetchBootstrapProject() {
  return request<ComicProject>("/projects/bootstrap");
}

export function fetchProject(projectId: string) {
  return request<ComicProject>(`/projects/${projectId}`);
}

export function saveProject(project: ComicProject) {
  return request<ComicProject>(`/projects/${project.id}`, {
    method: "PUT",
    body: JSON.stringify(project)
  });
}

export function fetchModels() {
  return request<ComicProject["models"]>("/models");
}

export function syncModels() {
  return request<ComicProject["models"]>("/models/sync", {
    method: "POST"
  });
}

export function fetchComfyStatus() {
  return request<{
    connected: boolean;
    baseUrl: string;
    availableEndpoints: string[];
    modelCounts: Record<string, number>;
    detail: string;
  }>("/comfy/status");
}

export function fetchComfyQueue() {
  return request<{
    runningCount: number;
    pendingCount: number;
    runningPromptIds: string[];
    pendingPromptIds: string[];
    detail: string;
  }>("/comfy/queue");
}

export function fetchComfyObjectInfoSummary() {
  return request<{
    nodeCount: number;
    nodeNames: string[];
    sampleInputs: Record<string, string[]>;
  }>("/comfy/object-info-summary");
}

export function fetchWorkflows() {
  return request("/workflows");
}

export function importWorkflowPreset(payload: {
  name: string;
  description: string;
  mode: "bw" | "color";
  promptPrefix: string;
  templateKey:
    | "sdxl_text2img"
    | "sdxl_manga"
    | "sdxl_color_story"
    | "sdxl_manga_regen"
    | "sdxl_color_regen";
  workflowJson: Record<string, unknown>;
}) {
  return request<WorkflowPreset>("/workflows/import", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function validateWorkflowPreset(payload: {
  workflowJson: Record<string, unknown>;
  nodeBindings?: WorkflowPreset["nodeBindings"];
}) {
  return request<WorkflowValidationResult>("/workflows/validate", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateWorkflowPreset(
  workflowId: string,
  payload: {
    promptPrefix?: string;
    nodeBindings?: WorkflowPreset["nodeBindings"];
  }
) {
  return request<WorkflowPreset>(`/workflows/${workflowId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export async function uploadCharacterReference(payload: {
  characterId: string;
  file: File;
  label: string;
  role: CharacterProfile["references"][number]["role"];
  angle: string;
  notes: string;
}) {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("label", payload.label);
  formData.append("role", payload.role);
  formData.append("angle", payload.angle);
  formData.append("notes", payload.notes);

  const response = await fetch(`${API_BASE_URL}/characters/${payload.characterId}/references`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Upload failed: ${response.status}`);
  }

  return response.json() as Promise<{
    characterId: string;
    reference: CharacterProfile["references"][number];
  }>;
}

export function updateCharacterReference(
  characterId: string,
  referenceId: string,
  payload: Partial<Pick<CharacterProfile["references"][number], "label" | "role" | "angle" | "notes">>
) {
  return request<CharacterProfile>(`/characters/${characterId}/references/${referenceId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteCharacterReference(characterId: string, referenceId: string) {
  return request<CharacterProfile>(`/characters/${characterId}/references/${referenceId}`, {
    method: "DELETE"
  });
}

export function updateCharacterProfile(
  characterId: string,
  payload: Partial<
    Pick<CharacterProfile, "referenceNotes" | "negativePrompt" | "consistency" | "adapter">
  >
) {
  return request<CharacterProfile>(`/characters/${characterId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function updateSceneMemory(
  sceneMemoryId: string,
  payload: Partial<
    Pick<
      ComicProject["sceneMemories"][number],
      "location" | "timeOfDay" | "weather" | "lighting" | "mood" | "continuityNotes"
    >
  >
) {
  return request<ComicProject["sceneMemories"][number]>(`/scene-memories/${sceneMemoryId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function createPromptPreview(payload: {
  panel: ComicPanel;
  workflow: WorkflowPreset | undefined;
  characters: CharacterProfile[];
}) {
  return request<PromptPreview>("/generation/prompt-preview", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function createContinuityDraft(payload: {
  currentPanel: ComicPanel;
  previousPanel?: ComicPanel;
  currentSceneMemory?: ComicProject["sceneMemories"][number];
  previousSceneMemory?: ComicProject["sceneMemories"][number];
  characters: CharacterProfile[];
}) {
  return request<{
    prompt: string;
    sceneSummary: string;
    shotType: string;
    styleNotes: string;
    continuityHints: string[];
  }>("/generation/continuity-draft", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function createDirectorDraft(payload: {
  userMessage: string;
  history: DirectorChatMessage[];
  contextSummary?: string;
  project: ComicProject;
  currentPage: ComicProject["pages"][number];
  selectedPanel?: ComicPanel;
  currentSceneMemory?: ComicProject["sceneMemories"][number];
  previousPanel?: ComicPanel;
  previousSceneMemory?: ComicProject["sceneMemories"][number];
  selectedCharacters: CharacterProfile[];
  availableCharacters: CharacterProfile[];
}) {
  return request<DirectorDraftResult>("/generation/director-draft", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function createGenerationJob(payload: {
  projectId: string;
  pageId: string;
  panel: ComicPanel;
  workflow: WorkflowPreset;
  characters: CharacterProfile[];
}) {
  return request<{
    jobId: string;
    status: string;
    promptPreview: PromptPreview;
    workflowPayload: Record<string, unknown>;
  }>("/generation/jobs", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchGenerationJob(jobId: string) {
  return request<GenerationJobState>(`/generation/jobs/${jobId}`);
}

export function cancelGenerationJob(jobId: string) {
  return request<{
    jobId: string;
    status: string;
    detail: string;
  }>(`/generation/jobs/${jobId}/cancel`, {
    method: "POST"
  });
}
