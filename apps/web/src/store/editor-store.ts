"use client";

import { create } from "zustand";
import type {
  CharacterProfile,
  ComicPage,
  ComicPageTemplate,
  ComicPanel,
  ComicProject,
  DirectorBeat,
  GenerationJobState,
  GenerationMode,
  PromptPreview,
  RevisionIntent,
  WorkflowPreset
} from "@archmanga/shared";
import { defaultProject } from "@/lib/default-data";

interface EditorState {
  project: ComicProject;
  selectedPageId: string;
  selectedPanelId: string | null;
  activeJob: GenerationJobState | null;
  promptPreview: PromptPreview | null;
  isDirty: boolean;
  lastSavedAt: string | null;
  hydrateProject: (project: ComicProject) => void;
  markProjectSaved: (project: ComicProject) => void;
  setSelectedPageId: (pageId: string) => void;
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
  updatePanelInpaintMask: (panelId: string, updates: Partial<ComicPanel["inpaintMask"]>) => void;
  updatePanelGeneration: (panelId: string, updates: Partial<ComicPanel["generation"]>) => void;
  updateSceneMemory: (
    sceneMemoryId: string,
    updates: Partial<ComicProject["sceneMemories"][number]>
  ) => void;
  replaceSceneMemory: (sceneMemory: ComicProject["sceneMemories"][number]) => void;
  replaceModels: (models: ComicProject["models"]) => void;
  addPage: () => void;
  duplicateCurrentPage: () => void;
  applyDirectorStoryboard: (payload: {
    beats: DirectorBeat[];
    mode?: GenerationMode;
    characterIds?: string[];
    sceneMemoryId?: string;
    styleNotes?: string;
  }) => void;
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
  updateCharacterReference: (
    characterId: string,
    referenceId: string,
    updates: Partial<CharacterProfile["references"][number]>
  ) => void;
  removeCharacterReference: (characterId: string, referenceId: string) => void;
  toggleCharacterAdapterReference: (
    characterId: string,
    referenceId: string,
    enabled: boolean
  ) => void;
  setCharacterPrimaryReference: (characterId: string, referenceId: string) => void;
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
    project.workflows.find((workflow) => workflow.mode === mode && !workflow.controls.includes("img2img")) ??
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

function createPageId() {
  return `page-${Math.random().toString(36).slice(2, 9)}`;
}

function createDefaultRevisionIntent(): RevisionIntent {
  return {
    preserveComposition: false,
    preserveBackground: false,
    preserveCharacterIdentity: true,
    editPriority: "general",
    changeInstructions: ""
  };
}

function createDefaultInpaintMask(): ComicPanel["inpaintMask"] {
  return {
    enabled: false,
    x: 0.25,
    y: 0.2,
    width: 0.5,
    height: 0.4,
    feather: 24
  };
}

function ensurePanelRevisionIntent(panel: ComicPanel): ComicPanel {
  return {
    ...panel,
    inpaintMask: {
      ...createDefaultInpaintMask(),
      ...(panel.inpaintMask ?? {})
    },
    prompt: {
      ...panel.prompt,
      revisionIntent: {
        ...createDefaultRevisionIntent(),
        ...(panel.prompt.revisionIntent ?? {})
      }
    }
  };
}

function normalizeProject(project: ComicProject): ComicProject {
  return {
    ...project,
    pages: project.pages.map((page) => ({
      ...page,
      panels: page.panels.map((panel) => ensurePanelRevisionIntent(panel))
    }))
  };
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
      styleNotes: "",
      revisionIntent: createDefaultRevisionIntent()
    },
    inpaintMask: createDefaultInpaintMask(),
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

function buildNewPage(project: ComicProject, pagesLength: number): ComicProject["pages"][number] {
  return {
    id: createPageId(),
    title: `Page ${String(pagesLength + 1).padStart(2, "0")}`,
    width: 852,
    height: 1200,
    panels: [buildNewPanel(project, 0, "bw")]
  };
}

function getTemplateForBeatCount(project: ComicProject, beatCount: number): ComicPageTemplate | null {
  const exact = project.templates.find((template) => template.panels.length === beatCount);
  if (exact) {
    return exact;
  }
  const larger = [...project.templates]
    .filter((template) => template.panels.length >= beatCount)
    .sort((left, right) => left.panels.length - right.panels.length)[0];
  return larger ?? null;
}

function buildStoryboardPanels(
  project: ComicProject,
  beats: DirectorBeat[],
  mode: GenerationMode,
  characterIds: string[],
  sceneMemoryId?: string,
  styleNotes?: string
): ComicPanel[] {
  const template = getTemplateForBeatCount(project, beats.length);
  const frames = template?.panels.slice(0, beats.length) ?? beats.map((_, index) => ({
    x: 48,
    y: 48 + index * 188,
    width: 756,
    height: 160,
    rotation: 0
  }));

  return beats.map((beat, index) => {
    const frame = frames[index];
    const nextPanel = buildNewPanel(project, index, beat.mode ?? mode);
    return {
      ...nextPanel,
      title: beat.title,
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      mode: beat.mode ?? mode,
      characterIds,
      sceneMemoryId,
      prompt: {
        prompt: beat.description,
        negativePrompt: nextPanel.prompt.negativePrompt,
        sceneSummary: beat.description,
        shotType: beat.shotType,
        styleNotes: styleNotes ?? "",
        revisionIntent: nextPanel.prompt.revisionIntent
      },
      generation: {
        ...nextPanel.generation,
        width: Math.round(frame.width),
        height: Math.round(frame.height)
      }
    };
  });
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: defaultProject,
  selectedPageId: defaultProject.pages[0]?.id ?? "",
  selectedPanelId: defaultProject.pages[0]?.panels[0]?.id ?? null,
  activeJob: null,
  promptPreview: null,
  isDirty: false,
  lastSavedAt: null,
  hydrateProject: (project) =>
    set((state) => {
      const normalizedProject = normalizeProject(project);
      const nextPage =
        normalizedProject.pages.find((page) => page.id === state.selectedPageId) ?? normalizedProject.pages[0];
      const nextPanel =
        nextPage?.panels.find((panel) => panel.id === state.selectedPanelId) ?? nextPage?.panels[0] ?? null;
      return {
        project: normalizedProject,
        selectedPageId: nextPage?.id ?? "",
        selectedPanelId: nextPanel?.id ?? null,
        isDirty: false,
        lastSavedAt: new Date().toISOString()
      };
    }),
  markProjectSaved: (project) =>
    set((state) => {
      const normalizedProject = normalizeProject(project);
      const nextPage =
        normalizedProject.pages.find((page) => page.id === state.selectedPageId) ?? normalizedProject.pages[0];
      const nextPanel =
        nextPage?.panels.find((panel) => panel.id === state.selectedPanelId) ?? nextPage?.panels[0] ?? null;
      return {
        project: normalizedProject,
        selectedPageId: nextPage?.id ?? "",
        selectedPanelId: nextPanel?.id ?? null,
        isDirty: false,
        lastSavedAt: new Date().toISOString(),
        promptPreview: null
      };
    }),
  setSelectedPageId: (pageId) =>
    set((state) => {
      const page = state.project.pages.find((item) => item.id === pageId);
      return {
        selectedPageId: pageId,
        selectedPanelId: page?.panels[0]?.id ?? null,
        promptPreview: null
      };
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
      activeJob: null,
      isDirty: true
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
      ),
      isDirty: true
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
      ),
      isDirty: true
    }));
  },
  updatePanelMeta: (panelId, updates) => {
    set((state) => ({
      project: updateCurrentPage(state.project, state.selectedPageId, (panels) =>
        panels.map((panel) => (panel.id === panelId ? { ...panel, ...updates } : panel))
      ),
      isDirty: true
    }));
  },
  updatePanelInpaintMask: (panelId, updates) => {
    set((state) => ({
      project: updateCurrentPage(state.project, state.selectedPageId, (panels) =>
        panels.map((panel) =>
          panel.id === panelId
            ? {
                ...panel,
                inpaintMask: {
                  ...panel.inpaintMask,
                  ...updates
                }
              }
            : panel
        )
      ),
      isDirty: true
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
      ),
      isDirty: true
    }));
  },
  updateSceneMemory: (sceneMemoryId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        sceneMemories: state.project.sceneMemories.map((sceneMemory) =>
          sceneMemory.id === sceneMemoryId ? { ...sceneMemory, ...updates } : sceneMemory
        )
      },
      isDirty: true
    })),
  replaceSceneMemory: (nextSceneMemory) =>
    set((state) => ({
      project: {
        ...state.project,
        sceneMemories: state.project.sceneMemories.map((sceneMemory) =>
          sceneMemory.id === nextSceneMemory.id ? nextSceneMemory : sceneMemory
        )
      },
      isDirty: true
    })),
  replaceModels: (models) =>
    set((state) => ({
      project: {
        ...state.project,
        models
      },
      isDirty: true
    })),
  addPage: () => {
    set((state) => {
      const nextPage = buildNewPage(state.project, state.project.pages.length);
      return {
        project: {
          ...state.project,
          pages: [...state.project.pages, nextPage]
        },
        selectedPageId: nextPage.id,
        selectedPanelId: nextPage.panels[0]?.id ?? null,
        promptPreview: null,
        isDirty: true
      };
    });
  },
  duplicateCurrentPage: () => {
    const { selectedPageId } = get();
    set((state) => {
      const source = state.project.pages.find((page) => page.id === selectedPageId);
      if (!source) {
        return {};
      }

      const duplicatedPage: ComicPage = {
        ...source,
        id: createPageId(),
        title: `${source.title} Copy`,
        panels: source.panels.map(
          (panel, index): ComicPanel => ({
            ...panel,
            id: createPanelId(),
            title: `${panel.title}${index === 0 ? " Copy" : ""}`,
            latestJobStatus: "idle",
            imageUrl: undefined,
            generation: {
              ...panel.generation,
              seed: Math.floor(Math.random() * 10_000_000)
            }
          })
        )
      };

      return {
        project: {
          ...state.project,
          pages: [...state.project.pages, duplicatedPage]
        },
        selectedPageId: duplicatedPage.id,
        selectedPanelId: duplicatedPage.panels[0]?.id ?? null,
        promptPreview: null,
        isDirty: true
      };
    });
  },
  applyDirectorStoryboard: (payload) => {
    const { selectedPageId } = get();
    set((state) => {
      const nextPanels = buildStoryboardPanels(
        state.project,
        payload.beats,
        payload.mode ?? "bw",
        payload.characterIds ?? [],
        payload.sceneMemoryId,
        payload.styleNotes
      );
      return {
        project: updateCurrentPage(state.project, selectedPageId, () => nextPanels),
        selectedPanelId: nextPanels[0]?.id ?? null,
        promptPreview: null,
        isDirty: true
      };
    });
  },
  addPanel: () => {
    const { selectedPageId } = get();
    set((state) => ({
      project: updateCurrentPage(state.project, selectedPageId, (panels) => [
        ...panels,
        buildNewPanel(state.project, panels.length, "color")
      ]),
      isDirty: true
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
      }),
      isDirty: true
    }));
  },
  setPromptPreview: (preview) => set({ promptPreview: preview }),
  setActiveJob: (job) => set({ activeJob: job }),
  setPanelJobStatus: (panelId, status) =>
    set((state) => ({
      project: updateCurrentPage(state.project, state.selectedPageId, (panels) =>
        panels.map((panel) => (panel.id === panelId ? { ...panel, latestJobStatus: status } : panel))
      ),
      isDirty: true
    })),
  setPanelImage: (panelId, imageUrl) =>
    set((state) => ({
      project: updateCurrentPage(state.project, state.selectedPageId, (panels) =>
        panels.map((panel) => (panel.id === panelId ? { ...panel, imageUrl } : panel))
      ),
      isDirty: true
    })),
  updateCharacter: (characterId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        characters: state.project.characters.map((character) =>
          character.id === characterId ? { ...character, ...updates } : character
        )
      },
      isDirty: true
    })),
  replaceCharacter: (nextCharacter) =>
    set((state) => ({
      project: {
        ...state.project,
        characters: state.project.characters.map((character) =>
          character.id === nextCharacter.id ? nextCharacter : character
        )
      },
      isDirty: true
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
      },
      isDirty: true
    })),
  updateCharacterReference: (characterId, referenceId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        characters: state.project.characters.map((character) =>
          character.id === characterId
            ? {
                ...character,
                references: character.references.map((reference) =>
                  reference.id === referenceId ? { ...reference, ...updates } : reference
                )
              }
            : character
        )
      },
      isDirty: true
    })),
  removeCharacterReference: (characterId, referenceId) =>
    set((state) => ({
      project: {
        ...state.project,
        characters: state.project.characters.map((character) =>
          character.id === characterId
            ? {
                ...character,
                references: character.references.filter((reference) => reference.id !== referenceId),
                adapter: {
                  ...character.adapter,
                  referenceImageIds: character.adapter.referenceImageIds.filter((item) => item !== referenceId)
                }
              }
            : character
        )
      },
      isDirty: true
    })),
  toggleCharacterAdapterReference: (characterId, referenceId, enabled) =>
    set((state) => ({
      project: {
        ...state.project,
        characters: state.project.characters.map((character) => {
          if (character.id !== characterId) {
            return character;
          }
          const referenceImageIds = enabled
            ? Array.from(new Set([...character.adapter.referenceImageIds, referenceId]))
            : character.adapter.referenceImageIds.filter((item) => item !== referenceId);
          return {
            ...character,
            adapter: {
              ...character.adapter,
              referenceImageIds
            }
          };
        })
      },
      isDirty: true
    })),
  setCharacterPrimaryReference: (characterId, referenceId) =>
    set((state) => ({
      project: {
        ...state.project,
        characters: state.project.characters.map((character) => {
          if (character.id !== characterId) {
            return character;
          }
          const remaining = character.adapter.referenceImageIds.filter((item) => item !== referenceId);
          return {
            ...character,
            adapter: {
              ...character.adapter,
              referenceImageIds: [referenceId, ...remaining]
            }
          };
        })
      },
      isDirty: true
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
      },
      isDirty: true
    })),
  updateWorkflow: (workflowId, updates) =>
    set((state) => ({
      project: {
        ...state.project,
        workflows: state.project.workflows.map((workflow) =>
          workflow.id === workflowId ? { ...workflow, ...updates } : workflow
        )
      },
      isDirty: true
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
      },
      isDirty: true
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
      },
      isDirty: true
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
      },
      isDirty: true
    })),
  addWorkflow: (workflow) =>
    set((state) => ({
      project: {
        ...state.project,
        workflows: [...state.project.workflows, workflow]
      },
      isDirty: true
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
