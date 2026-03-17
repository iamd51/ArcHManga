"use client";

import { create } from "zustand";
import type {
  CharacterProfile,
  ComicPageTemplate,
  ComicPanel,
  ComicProject,
  GenerationJobState,
  GenerationMode,
  PromptPreview,
  WorkflowPreset
} from "@archmanga/shared";
import { defaultProject } from "@/lib/default-data";

interface EditorState {
  project: ComicProject;
  selectedPageId: string;
  selectedPanelId: string | null;
  activeJob: GenerationJobState | null;
  promptPreview: PromptPreview | null;
  hydrateProject: (project: ComicProject) => void;
  applyTemplate: (template: ComicPageTemplate) => void;
  selectPanel: (panelId: string | null) => void;
  updatePanelFrame: (panelId: string, frame: Partial<ComicPanel>) => void;
  updatePanelPrompt: (panelId: string, updates: Partial<ComicPanel["prompt"]>) => void;
  updatePanelMeta: (
    panelId: string,
    updates: Partial<
      Pick<
        ComicPanel,
        "modelId" | "workflowPresetId" | "mode" | "characterIds" | "sceneMemoryId"
      >
    >
  ) => void;
  updatePanelGeneration: (panelId: string, updates: Partial<ComicPanel["generation"]>) => void;
  updateSceneMemory: (
    sceneMemoryId: string,
    updates: Partial<ComicProject["sceneMemories"][number]>
  ) => void;
  replaceSceneMemory: (sceneMemory: ComicProject["sceneMemories"][number]) => void;
  replaceModels: (models: ComicProject["models"]) => void;
  addPanel: () => void;
  duplicateSelectedPanel: () => void;
  setPromptPreview: (preview: PromptPreview | null) => void;
  setActiveJob: (job: GenerationJobState | null) => void;
  setPanelJobStatus: (panelId: string, status: ComicPanel["latestJobStatus"]) => void;
  setPanelImage: (panelId: string, imageUrl: string | undefined) => void;
  updateCharacter: (characterId: string, updates: Partial<CharacterProfile>) => void;
  replaceCharacter: (character: CharacterProfile) => void;
  appendCharacterReference: (
    characterId: string,
    reference: CharacterProfile["references"][number]
  ) => void;
  updateCharacterAdapter: (
    characterId: string,
    updates: Partial<CharacterProfile["adapter"]>
  ) => void;
  updateWorkflow: (workflowId: string, updates: Partial<WorkflowPreset>) => void;
  addWorkflowBinding: (
    workflowId: string,
    binding: WorkflowPreset["nodeBindings"][number]
  ) => void;
  updateWorkflowBinding: (
    workflowId: string,
    bindingId: string,
    updates: Partial<WorkflowPreset["nodeBindings"][number]>
  ) => void;
  removeWorkflowBinding: (workflowId: string, bindingId: string) => void;
  addWorkflow: (workflow: WorkflowPreset) => void;
}

function updateCurrentPage(
  project: ComicProject,
  selectedPageId: string,
  updater: (pagePanels: ComicPanel[], pageIndex: number) => ComicPanel[]
) {
  const pageIndex = project.pages.findIndex((page) => page.id === selectedPageId);
  if (pageIndex === -1) {
    return project;
  }

  const pages = [...project.pages];
  pages[pageIndex] = {
    ...pages[pageIndex],
    panels: updater(pages[pageIndex].panels, pageIndex)
  };

  return {
    ...project,
    pages
  };
}

function getDefaultWorkflow(project: ComicProject, mode: GenerationMode) {
  return (
    project.workflows.find((workflow) => workflow.mode === mode) ??
    project.workflows[0] ??
    defaultProject.workflows[0]
  );
}

function getDefaultModel(project: ComicProject, mode: GenerationMode) {
  return (
    project.models.find((model) => model.tags.includes(mode)) ??
    project.models[0] ??
    defaultProject.models[0]
  );
}

function createPanelId() {
  return `panel-${Math.random().toString(36).slice(2, 9)}`;
}

function buildNewPanel(project: ComicProject, panelsLength: number, mode: GenerationMode): ComicPanel {
  const workflow = getDefaultWorkflow(project, mode);
  const model = getDefaultModel(project, mode);
  const sceneMemory = project.sceneMemories[0];

  return {
    id: createPanelId(),
    title: `Panel ${panelsLength + 1}`,
    x: 96,
    y: 96,
    width: 320,
    height: 220,
    rotation: 0,
    mode,
    modelId: model.id,
    workflowPresetId: workflow.id,
    characterIds: [],
    sceneMemoryId: sceneMemory?.id,
    latestJobStatus: "idle",
    prompt: {
      prompt: "",
      negativePrompt: "",
      sceneSummary: sceneMemory?.continuityNotes ?? "",
      shotType: "",
      styleNotes: ""
    },
    generation: {
      width: 320,
      height: 220,
      seed: Math.floor(Math.random() * 10_000_000),
      steps:
        Number(workflow.parameters.find((parameter) => parameter.key === "steps")?.defaultValue) || 28,
      cfg: Number(workflow.parameters.find((parameter) => parameter.key === "cfg")?.defaultValue) || 6.5,
      sampler:
        String(workflow.parameters.find((parameter) => parameter.key === "sampler")?.defaultValue) ||
        "euler",
      scheduler: "normal",
      denoise: 1
    }
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: defaultProject,
  selectedPageId: defaultProject.pages[0]?.id ?? "",
  selectedPanelId: defaultProject.pages[0]?.panels[0]?.id ?? null,
  activeJob: null,
  promptPreview: null,
  hydrateProject: (project) =>
    set({
      project,
      selectedPageId: project.pages[0]?.id ?? "",
      selectedPanelId: project.pages[0]?.panels[0]?.id ?? null
    }),
  applyTemplate: (template) => {
    set((state) => ({
      project: updateCurrentPage(state.project, state.selectedPageId, () =>
        template.panels.map((panel, index) => {
          const nextPanel = buildNewPanel(state.project, index, "bw");
          return {
            ...nextPanel,
            title: `Panel ${index + 1}`,
            x: panel.x,
            y: panel.y,
            width: panel.width,
            height: panel.height,
            generation: {
              ...nextPanel.generation,
              width: Math.round(panel.width),
              height: Math.round(panel.height)
            }
          };
        })
      ),
      selectedPanelId: null,
      promptPreview: null,
      activeJob: null
    }));
  },
  selectPanel: (panelId) => set({ selectedPanelId: panelId }),
  updatePanelFrame: (panelId, frame) => {
    set((state) => ({
      project: updateCurrentPage(state.project, state.selectedPageId, (panels) =>
        panels.map((panel) =>
          panel.id === panelId
            ? {
                ...panel,
                ...frame,
                generation: {
                  ...panel.generation,
                  width: Math.round(Number(frame.width ?? panel.width)),
                  height: Math.round(Number(frame.height ?? panel.height))
                }
              }
            : panel
        )
      )
    }));
  },
  updatePanelPrompt: (panelId, updates) => {
    set((state) => ({
      project: updateCurrentPage(state.project, state.selectedPageId, (panels) =>
        panels.map((panel) =>
          panel.id === panelId
            ? {
                ...panel,
                prompt: {
                  ...panel.prompt,
                  ...updates
                }
              }
            : panel
        )
      )
    }));
  },
  updatePanelMeta: (panelId, updates) => {
    set((state) => ({
      project: updateCurrentPage(state.project, state.selectedPageId, (panels) =>
        panels.map((panel) => (panel.id === panelId ? { ...panel, ...updates } : panel))
      )
    }));
  },
  updatePanelGeneration: (panelId, updates) => {
    set((state) => ({
      project: updateCurrentPage(state.project, state.selectedPageId, (panels) =>
        panels.map((panel) =>
          panel.id === panelId
            ? {
                ...panel,
                generation: {
                  ...panel.generation,
                  ...updates
                }
              }
            : panel
        )
      )
    }));
  },
  updateSceneMemory: (sceneMemoryId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        sceneMemories: state.project.sceneMemories.map((sceneMemory) =>
          sceneMemory.id === sceneMemoryId ? { ...sceneMemory, ...updates } : sceneMemory
        )
      }
    })),
  replaceSceneMemory: (nextSceneMemory) =>
    set((state) => ({
      project: {
        ...state.project,
        sceneMemories: state.project.sceneMemories.map((sceneMemory) =>
          sceneMemory.id === nextSceneMemory.id ? nextSceneMemory : sceneMemory
        )
      }
    })),
  replaceModels: (models) =>
    set((state) => ({
      project: {
        ...state.project,
        models
      }
    })),
  addPanel: () => {
    const { selectedPageId } = get();
    set((state) => ({
      project: updateCurrentPage(state.project, selectedPageId, (panels) => [
        ...panels,
        buildNewPanel(state.project, panels.length, "color")
      ])
    }));
  },
  duplicateSelectedPanel: () => {
    const { selectedPanelId, selectedPageId } = get();
    if (!selectedPanelId) {
      return;
    }

    set((state) => ({
      project: updateCurrentPage(state.project, selectedPageId, (panels) => {
        const source = panels.find((panel) => panel.id === selectedPanelId);
        if (!source) {
          return panels;
        }

        return [
          ...panels,
          {
            ...source,
            id: createPanelId(),
            title: `${source.title} Copy`,
            x: source.x + 24,
            y: source.y + 24,
            latestJobStatus: "idle",
            generation: {
              ...source.generation,
              seed: Math.floor(Math.random() * 10_000_000)
            }
          }
        ];
      })
    }));
  },
  setPromptPreview: (preview) => set({ promptPreview: preview }),
  setActiveJob: (job) => set({ activeJob: job }),
  setPanelJobStatus: (panelId, status) =>
    set((state) => ({
      project: updateCurrentPage(state.project, state.selectedPageId, (panels) =>
        panels.map((panel) => (panel.id === panelId ? { ...panel, latestJobStatus: status } : panel))
      )
    })),
  setPanelImage: (panelId, imageUrl) =>
    set((state) => ({
      project: updateCurrentPage(state.project, state.selectedPageId, (panels) =>
        panels.map((panel) => (panel.id === panelId ? { ...panel, imageUrl } : panel))
      )
    })),
  updateCharacter: (characterId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        characters: state.project.characters.map((character) =>
          character.id === characterId ? { ...character, ...updates } : character
        )
      }
    })),
  replaceCharacter: (nextCharacter) =>
    set((state) => ({
      project: {
        ...state.project,
        characters: state.project.characters.map((character) =>
          character.id === nextCharacter.id ? nextCharacter : character
        )
      }
    })),
  appendCharacterReference: (characterId, reference) =>
    set((state) => ({
      project: {
        ...state.project,
        characters: state.project.characters.map((character) =>
          character.id === characterId
            ? {
                ...character,
                references: [...character.references, reference],
                adapter: {
                  ...character.adapter,
                  referenceImageIds: [...character.adapter.referenceImageIds, reference.id]
                }
              }
            : character
        )
      }
    })),
  updateCharacterAdapter: (characterId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        characters: state.project.characters.map((character) =>
          character.id === characterId
            ? {
                ...character,
                adapter: {
                  ...character.adapter,
                  ...updates
                }
              }
            : character
        )
      }
    })),
  updateWorkflow: (workflowId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        workflows: state.project.workflows.map((workflow) =>
          workflow.id === workflowId ? { ...workflow, ...updates } : workflow
        )
      }
    })),
  addWorkflowBinding: (workflowId, binding) =>
    set((state) => ({
      project: {
        ...state.project,
        workflows: state.project.workflows.map((workflow) =>
          workflow.id === workflowId
            ? { ...workflow, nodeBindings: [...workflow.nodeBindings, binding] }
            : workflow
        )
      }
    })),
  updateWorkflowBinding: (workflowId, bindingId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        workflows: state.project.workflows.map((workflow) =>
          workflow.id === workflowId
            ? {
                ...workflow,
                nodeBindings: workflow.nodeBindings.map((binding) =>
                  binding.id === bindingId ? { ...binding, ...updates } : binding
                )
              }
            : workflow
        )
      }
    })),
  removeWorkflowBinding: (workflowId, bindingId) =>
    set((state) => ({
      project: {
        ...state.project,
        workflows: state.project.workflows.map((workflow) =>
          workflow.id === workflowId
            ? {
                ...workflow,
                nodeBindings: workflow.nodeBindings.filter((binding) => binding.id !== bindingId)
              }
            : workflow
        )
      }
    })),
  addWorkflow: (workflow) =>
    set((state) => ({
      project: {
        ...state.project,
        workflows: [...state.project.workflows, workflow]
      }
    }))
}));

export function useCurrentPage() {
  return useEditorStore((state) =>
    state.project.pages.find((page) => page.id === state.selectedPageId) ?? state.project.pages[0]
  );
}

export function useSelectedPanel() {
  return useEditorStore((state) => {
    const page =
      state.project.pages.find((item) => item.id === state.selectedPageId) ?? state.project.pages[0];
    return page?.panels.find((panel) => panel.id === state.selectedPanelId) ?? null;
  });
}

export function useSelectedWorkflow() {
  return useEditorStore((state) => {
    const page =
      state.project.pages.find((item) => item.id === state.selectedPageId) ?? state.project.pages[0];
    const panel = page?.panels.find((item) => item.id === state.selectedPanelId);
    return state.project.workflows.find((workflow) => workflow.id === panel?.workflowPresetId) ?? null;
  });
}

export function getModeLabel(mode: GenerationMode) {
  return mode === "bw" ? "Black & White" : "Color";
}
