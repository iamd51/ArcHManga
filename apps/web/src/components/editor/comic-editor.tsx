"use client";

import { startTransition } from "react";
import dynamic from "next/dynamic";
import { Inspector } from "@/components/editor/inspector";
import { Sidebar } from "@/components/editor/sidebar";
import { useBootstrapProject, useGenerationActions } from "@/lib/use-generation";
import { useCurrentPage, useEditorStore } from "@/store/editor-store";

const PageCanvas = dynamic(
  () => import("@/components/editor/page-canvas").then((mod) => mod.PageCanvas),
  { ssr: false }
);

export function ComicEditor() {
  const project = useEditorStore((state) => state.project);
  const activeJob = useEditorStore((state) => state.activeJob);
  const selectedPanel = useEditorStore((state) => {
    const page = state.project.pages.find((item) => item.id === state.selectedPageId) ?? state.project.pages[0];
    return page?.panels.find((item) => item.id === state.selectedPanelId) ?? null;
  });
  const addPanel = useEditorStore((state) => state.addPanel);
  const duplicateSelectedPanel = useEditorStore((state) => state.duplicateSelectedPanel);
  const page = useCurrentPage();
  const bootstrapProject = useBootstrapProject();
  const { cancelGenerationMutation, continuityDraftMutation, generationMutation, promptPreviewMutation } =
    useGenerationActions();

  return (
    <main className="app-shell">
      <Sidebar />
      <section className="surface editor-stage">
        <header className="editor-toolbar">
          <div className="editor-title">
            <h1>{project.title}</h1>
            <p>
              {project.synopsis} Current page: <strong>{page.title}</strong>
            </p>
            {bootstrapProject.isFetching ? (
              <div className="callout callout-info">Syncing project bootstrap data from FastAPI.</div>
            ) : null}
            {bootstrapProject.error ? (
              <div className="callout callout-warning">
                API bootstrap failed, so the editor is using the local fallback project data.
              </div>
            ) : null}
          </div>
          <div className="toolbar-actions">
            <button className="button subtle" type="button" onClick={duplicateSelectedPanel}>
              Duplicate panel
            </button>
            <button className="button" type="button" onClick={addPanel}>
              Add free panel
            </button>
            <button
              className="button subtle"
              type="button"
              disabled={!activeJob?.jobId || cancelGenerationMutation.isPending}
              onClick={() => cancelGenerationMutation.mutate()}
            >
              {cancelGenerationMutation.isPending ? "Cancelling..." : "Cancel active job"}
            </button>
            <button
              className="button primary"
              type="button"
              disabled={!selectedPanel || generationMutation.isPending}
              onClick={() => {
                startTransition(() => {
                  generationMutation.mutate();
                });
              }}
            >
              {generationMutation.isPending ? "Submitting..." : "Send selected panel to ComfyUI"}
            </button>
          </div>
        </header>

        {activeJob ? (
          <div className="callout callout-info">
            Job <strong>{activeJob.jobId}</strong> for panel <strong>{activeJob.panelId}</strong>:{" "}
            {activeJob.detail}
          </div>
        ) : null}

        <PageCanvas />
      </section>
      <Inspector
        onGenerate={() => generationMutation.mutate()}
        onContinuityDraft={() => continuityDraftMutation.mutate()}
        onPreviewPrompt={() => promptPreviewMutation.mutate()}
        generationPending={generationMutation.isPending}
        continuityPending={continuityDraftMutation.isPending}
        promptPending={promptPreviewMutation.isPending}
      />
    </main>
  );
}
