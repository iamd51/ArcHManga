"use client";

import { startTransition, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import { DirectorConsole } from "@/components/editor/director-console";
import { Inspector } from "@/components/editor/inspector";
import { Sidebar } from "@/components/editor/sidebar";
import {
  getGenerationConsistencyPreflight,
  useBootstrapProject,
  useGenerationActions,
  useProjectPersistence
} from "@/lib/use-generation";
import { useCurrentPage, useEditorStore } from "@/store/editor-store";

const PageCanvas = dynamic(
  () => import("@/components/editor/page-canvas").then((mod) => mod.PageCanvas),
  { ssr: false }
);

export function ComicEditor() {
  const stageRef = useRef<KonvaStage | null>(null);
  const project = useEditorStore((state) => state.project);
  const isDirty = useEditorStore((state) => state.isDirty);
  const lastSavedAt = useEditorStore((state) => state.lastSavedAt);
  const activeJob = useEditorStore((state) => state.activeJob);
  const selectedPageId = useEditorStore((state) => state.selectedPageId);
  const setSelectedPageId = useEditorStore((state) => state.setSelectedPageId);
  const selectedPanel = useEditorStore((state) => {
    const page = state.project.pages.find((item) => item.id === state.selectedPageId) ?? state.project.pages[0];
    return page?.panels.find((item) => item.id === state.selectedPanelId) ?? null;
  });
  const projectCharacters = useEditorStore((state) => state.project.characters);
  const addPage = useEditorStore((state) => state.addPage);
  const duplicateCurrentPage = useEditorStore((state) => state.duplicateCurrentPage);
  const addPanel = useEditorStore((state) => state.addPanel);
  const duplicateSelectedPanel = useEditorStore((state) => state.duplicateSelectedPanel);
  const page = useCurrentPage();
  const [renderMode, setRenderMode] = useState<"editor" | "export">("editor");
  const [exportingFormat, setExportingFormat] = useState<"png" | "pdf" | null>(null);
  const bootstrapProject = useBootstrapProject();
  const { saveProjectMutation } = useProjectPersistence();
  const { cancelGenerationMutation, continuityDraftMutation, generationMutation, promptPreviewMutation } =
    useGenerationActions();
  const selectedCharacters = selectedPanel
    ? projectCharacters.filter((character) => selectedPanel.characterIds.includes(character.id))
    : [];
  const selectedPanelIndex = page.panels.findIndex((panel) => panel.id === selectedPanel?.id);
  const previousPanel = selectedPanelIndex > 0 ? page.panels[selectedPanelIndex - 1] : undefined;
  const selectedPanelConsistencyPreflight = selectedPanel
    ? getGenerationConsistencyPreflight(selectedPanel, selectedCharacters, previousPanel)
    : null;

  const exportPage = async (format: "png" | "pdf") => {
    setExportingFormat(format);
    setRenderMode("export");

    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      const stage = stageRef.current;
      if (!stage) {
        throw new Error("Page canvas is not ready.");
      }

      const fileStem = page.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "comic-page";
      const dataUrl = stage.toDataURL({
        pixelRatio: 2,
        mimeType: "image/png"
      });

      if (format === "png") {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `${fileStem}.png`;
        link.click();
        return;
      }

      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: page.width >= page.height ? "landscape" : "portrait",
        unit: "px",
        format: [page.width, page.height]
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, page.width, page.height);
      pdf.save(`${fileStem}.pdf`);
    } finally {
      setRenderMode("editor");
      setExportingFormat(null);
    }
  };

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
            <div className={`callout ${isDirty ? "callout-warning" : "callout-info"}`}>
              {isDirty
                ? "Unsaved page/project changes are waiting to be saved."
                : `Project snapshot saved${lastSavedAt ? ` at ${new Date(lastSavedAt).toLocaleTimeString()}` : "."}`}
            </div>
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
            <select
              className="select"
              value={selectedPageId}
              onChange={(event) => setSelectedPageId(event.target.value)}
            >
              {project.pages.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <button className="button subtle" type="button" onClick={duplicateCurrentPage}>
              Duplicate page
            </button>
            <button className="button subtle" type="button" onClick={addPage}>
              Add page
            </button>
            <button className="button subtle" type="button" onClick={duplicateSelectedPanel}>
              Duplicate panel
            </button>
            <button className="button" type="button" onClick={addPanel}>
              Add free panel
            </button>
            <button
              className="button"
              type="button"
              disabled={Boolean(exportingFormat)}
              onClick={() => exportPage("png")}
            >
              {exportingFormat === "png" ? "Exporting PNG..." : "Export PNG"}
            </button>
            <button
              className="button"
              type="button"
              disabled={Boolean(exportingFormat)}
              onClick={() => exportPage("pdf")}
            >
              {exportingFormat === "pdf" ? "Exporting PDF..." : "Export PDF"}
            </button>
            <button
              className="button"
              type="button"
              disabled={bootstrapProject.isFetching}
              onClick={() => bootstrapProject.refetch()}
            >
              Reload project
            </button>
            <button
              className="button primary"
              type="button"
              disabled={saveProjectMutation.isPending || !isDirty}
              onClick={() => saveProjectMutation.mutate()}
            >
              {saveProjectMutation.isPending ? "Saving..." : "Save project"}
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
              disabled={
                !selectedPanel ||
                generationMutation.isPending ||
                selectedPanelConsistencyPreflight?.status === "blocked"
              }
              onClick={() => {
                startTransition(() => {
                  generationMutation.mutate(undefined);
                });
              }}
            >
              {generationMutation.isPending ? "Submitting..." : "Send selected panel to ComfyUI"}
            </button>
          </div>
        </header>

        {saveProjectMutation.error ? (
          <div className="callout callout-warning">
            Project save failed. Check that the FastAPI server is running before saving.
          </div>
        ) : null}
        {generationMutation.error ? (
          <div className="callout callout-warning">
            {generationMutation.error.message || "Generation submit failed."}
          </div>
        ) : null}
        {selectedPanelConsistencyPreflight?.status === "blocked" ? (
          <div className="callout callout-warning">
            Generation is blocked until character anchors are stronger:{" "}
            {selectedPanelConsistencyPreflight.reasons.join(" ")}
          </div>
        ) : null}

        {activeJob ? (
          <div className="callout callout-info">
            Job <strong>{activeJob.jobId}</strong> for panel <strong>{activeJob.panelId}</strong>:{" "}
            {activeJob.detail}
          </div>
        ) : null}

        <DirectorConsole
          generationPending={generationMutation.isPending}
          onGeneratePanel={(payload) => generationMutation.mutate(payload)}
        />
        <PageCanvas stageRef={stageRef} renderMode={renderMode} />
      </section>
      <Inspector
        onGenerate={(target) => generationMutation.mutate(target)}
        onContinuityDraft={() => continuityDraftMutation.mutate()}
        onPreviewPrompt={() => promptPreviewMutation.mutate()}
        generationPending={generationMutation.isPending}
        continuityPending={continuityDraftMutation.isPending}
        promptPending={promptPreviewMutation.isPending}
      />
    </main>
  );
}
