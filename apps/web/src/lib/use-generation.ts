"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelGenerationJob,
  createContinuityDraft,
  createGenerationJob,
  createPromptPreview,
  fetchBootstrapProject,
  fetchGenerationJob
} from "@/lib/api";
import { useCurrentPage, useEditorStore, useSelectedPanel, useSelectedWorkflow } from "@/store/editor-store";

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
    mutationFn: async () => {
      if (!selectedPanel || !selectedWorkflow) {
        throw new Error("Select a panel and workflow first.");
      }
      return createGenerationJob({
        projectId: project.id,
        pageId: currentPage.id,
        panel: selectedPanel,
        workflow: selectedWorkflow,
        characters: attachedCharacters
      });
    },
    onMutate: () => {
      if (selectedPanel) {
        setPanelJobStatus(selectedPanel.id, "queued");
      }
    },
    onSuccess: (result) => {
      setPromptPreview(result.promptPreview);
      setActiveJob({
        jobId: result.jobId,
        panelId: selectedPanel?.id,
        status: "queued",
        promptId: undefined,
        imageUrls: [],
        detail: "Submitted to generation queue."
      });
      if (selectedPanel) {
        setPanelJobStatus(selectedPanel.id, "queued");
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
