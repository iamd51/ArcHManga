"use client";

import { useEffect } from "react";
import type { CharacterProfile, ComicPanel, ComicProject, WorkflowPreset } from "@archmanga/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildConsistencyPreflight, buildPanelConsistencyPlan } from "@/lib/character-consistency";
import {
  cancelGenerationJob,
  createContinuityDraft,
  createGenerationJob,
  createPromptPreview,
  fetchBootstrapProject,
  fetchGenerationJob,
  saveProject
} from "@/lib/api";
import { useCurrentPage, useEditorStore, useSelectedPanel, useSelectedWorkflow } from "@/store/editor-store";

export interface GenerationRequestTarget {
  panel?: ComicPanel;
  workflow?: WorkflowPreset | null;
  characters?: CharacterProfile[];
  pageId?: string;
}

export function getGenerationConsistencyPreflight(
  panel: ComicPanel,
  characters: CharacterProfile[]
) {
  return buildConsistencyPreflight(buildPanelConsistencyPlan(panel, characters));
}

function hasActiveRevisionIntent(panel: ComicPanel) {
  const revisionIntent = panel.prompt.revisionIntent;
  return Boolean(
    panel.imageUrl &&
      (revisionIntent.preserveComposition ||
        revisionIntent.preserveBackground ||
        revisionIntent.changeInstructions ||
        revisionIntent.editPriority !== "general")
  );
}

export function resolveGenerationWorkflow(
  project: ComicProject,
  panel: ComicPanel,
  preferredWorkflow?: WorkflowPreset | null
) {
  const shouldPreferRegeneration = hasActiveRevisionIntent(panel);
  if (shouldPreferRegeneration) {
    const regenerationWorkflow =
      (panel.inpaintMask.enabled
        ? project.workflows.find(
            (workflow) =>
              workflow.mode === panel.mode &&
              workflow.controls.includes("img2img") &&
              workflow.controls.includes("inpaint")
          )
        : null) ??
      project.workflows.find(
        (workflow) => workflow.mode === panel.mode && workflow.controls.includes("img2img")
      ) ?? null;
    if (regenerationWorkflow) {
      return regenerationWorkflow;
    }
  }

  return (
    preferredWorkflow ??
    project.workflows.find((workflow) => workflow.id === panel.workflowPresetId) ??
    project.workflows.find((workflow) => workflow.mode === panel.mode) ??
    project.workflows[0] ??
    null
  );
}

export function useBootstrapProject() {
  const hydrateProject = useEditorStore((state) => state.hydrateProject);

  const query = useQuery({
    queryKey: ["bootstrap-project"],
    queryFn: fetchBootstrapProject
  });

  useEffect(() => {
    if (query.data) {
      hydrateProject(query.data);
    }
  }, [hydrateProject, query.data]);

  return query;
}

export function useGenerationActions() {
  const project = useEditorStore((state) => state.project);
  const activeJob = useEditorStore((state) => state.activeJob);
  const setPromptPreview = useEditorStore((state) => state.setPromptPreview);
  const setActiveJob = useEditorStore((state) => state.setActiveJob);
  const setPanelJobStatus = useEditorStore((state) => state.setPanelJobStatus);
  const setPanelImage = useEditorStore((state) => state.setPanelImage);
  const selectedPanel = useSelectedPanel();
  const selectedWorkflow = useSelectedWorkflow();
  const currentPage = useCurrentPage();
  const queryClient = useQueryClient();
  const updatePanelPrompt = useEditorStore((state) => state.updatePanelPrompt);

  const attachedCharacters = project.characters.filter((character) =>
    selectedPanel?.characterIds.includes(character.id)
  );
  const currentIndex = currentPage.panels.findIndex((panel) => panel.id === selectedPanel?.id);
  const previousPanel = currentIndex > 0 ? currentPage.panels[currentIndex - 1] : undefined;
  const currentSceneMemory = project.sceneMemories.find(
    (sceneMemory) => sceneMemory.id === selectedPanel?.sceneMemoryId
  );
  const previousSceneMemory = project.sceneMemories.find(
    (sceneMemory) => sceneMemory.id === previousPanel?.sceneMemoryId
  );

  const promptPreviewMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPanel) {
        throw new Error("No panel selected.");
      }
      return createPromptPreview({
        panel: selectedPanel,
        workflow: selectedWorkflow ?? undefined,
        characters: attachedCharacters
      });
    },
    onSuccess: (preview) => setPromptPreview(preview)
  });

  const generationMutation = useMutation({
    mutationFn: async (target?: GenerationRequestTarget) => {
      const panel = target?.panel ?? selectedPanel;
      const workflow = panel ? resolveGenerationWorkflow(project, panel, target?.workflow ?? selectedWorkflow) : null;
      const characters = target?.characters ?? attachedCharacters;
      const pageId = target?.pageId ?? currentPage.id;

      if (!panel || !workflow) {
        throw new Error("Select a panel and workflow first.");
      }
      const consistencyPreflight = getGenerationConsistencyPreflight(panel, characters);
      if (consistencyPreflight.status === "blocked") {
        throw new Error(consistencyPreflight.reasons[0] ?? "Consistency anchors are not ready.");
      }
      return createGenerationJob({
        projectId: project.id,
        pageId,
        panel,
        workflow,
        characters
      });
    },
    onMutate: (target) => {
      const panelId = target?.panel?.id ?? selectedPanel?.id;
      if (panelId) {
        setPanelJobStatus(panelId, "queued");
      }
    },
    onSuccess: (result, target) => {
      const panelId = target?.panel?.id ?? selectedPanel?.id;
      setPromptPreview(result.promptPreview);
      setActiveJob({
        jobId: result.jobId,
        panelId,
        status: "queued",
        promptId: undefined,
        imageUrls: [],
        detail: "Submitted to generation queue."
      });
      if (panelId) {
        setPanelJobStatus(panelId, "queued");
      }
      queryClient.invalidateQueries({ queryKey: ["generation-job", result.jobId] });
    }
  });

  const cancelGenerationMutation = useMutation({
    mutationFn: async () => {
      if (!activeJob?.jobId) {
        throw new Error("No active job.");
      }
      return cancelGenerationJob(activeJob.jobId);
    },
    onSuccess: (result) => {
      if (activeJob?.panelId) {
        setPanelJobStatus(activeJob.panelId, "failed");
      }
      setActiveJob({
        ...(activeJob ?? {
          jobId: result.jobId,
          imageUrls: []
        }),
        status: result.status as "cancelled",
        detail: result.detail
      });
    }
  });

  const continuityDraftMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPanel) {
        throw new Error("No panel selected.");
      }
      return createContinuityDraft({
        currentPanel: selectedPanel,
        previousPanel,
        currentSceneMemory,
        previousSceneMemory,
        characters: attachedCharacters
      });
    },
    onSuccess: (draft) => {
      if (!selectedPanel) {
        return;
      }
      updatePanelPrompt(selectedPanel.id, {
        prompt: draft.prompt,
        sceneSummary: draft.sceneSummary,
        shotType: draft.shotType,
        styleNotes: draft.styleNotes
      });
    }
  });

  const jobQuery = useQuery({
    queryKey: ["generation-job", activeJob?.jobId],
    queryFn: async () => {
      if (!activeJob?.jobId) {
        throw new Error("No active job.");
      }
      return fetchGenerationJob(activeJob.jobId);
    },
    enabled: Boolean(activeJob?.jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "complete" || status === "failed" || status === "missing" || status === "cancelled"
        ? false
        : 1500;
    }
  });

  useEffect(() => {
    const job = jobQuery.data;
    if (!job || !job.panelId) {
      return;
    }

    setActiveJob(job);
    if (job.status === "queued" || job.status === "running") {
      setPanelJobStatus(job.panelId, job.status);
    }
    if (job.status === "complete") {
      setPanelJobStatus(job.panelId, "complete");
      if (job.imageUrls[0]) {
        setPanelImage(job.panelId, job.imageUrls[0]);
      }
    }
    if (job.status === "failed" || job.status === "missing") {
      setPanelJobStatus(job.panelId, "failed");
    }
    if (job.status === "cancelled") {
      setPanelJobStatus(job.panelId, "failed");
    }
  }, [jobQuery.data, setActiveJob, setPanelImage, setPanelJobStatus]);

  return {
    promptPreviewMutation,
    generationMutation,
    cancelGenerationMutation,
    continuityDraftMutation,
    jobQuery
  };
}

export function useProjectPersistence() {
  const project = useEditorStore((state) => state.project);
  const markProjectSaved = useEditorStore((state) => state.markProjectSaved);
  const queryClient = useQueryClient();

  const saveProjectMutation = useMutation({
    mutationFn: async () => saveProject(project),
    onSuccess: (savedProject) => {
      markProjectSaved(savedProject);
      queryClient.setQueryData(["bootstrap-project"], savedProject);
    }
  });

  return {
    saveProjectMutation
  };
}
