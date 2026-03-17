"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { ComicPageTemplate } from "@archmanga/shared";
import { importWorkflowPreset } from "@/lib/api";
import { useCurrentPage, useEditorStore, useSelectedWorkflow } from "@/store/editor-store";

function TemplatePreview({ template }: { template: ComicPageTemplate }) {
  return (
    <div className="template-preview" aria-hidden="true">
      {template.panels.map((panel, index) => (
        <div
          key={`${template.id}-${index}`}
          className="template-preview-box"
          style={{
            left: `${(panel.x / 852) * 100}%`,
            top: `${(panel.y / 1200) * 100}%`,
            width: `${(panel.width / 852) * 100}%`,
            height: `${(panel.height / 1200) * 100}%`
          }}
        />
      ))}
    </div>
  );
}

export function Sidebar() {
  const project = useEditorStore((state) => state.project);
  const selectedPanelId = useEditorStore((state) => state.selectedPanelId);
  const addWorkflow = useEditorStore((state) => state.addWorkflow);
  const applyTemplate = useEditorStore((state) => state.applyTemplate);
  const page = useCurrentPage();
  const selectedWorkflow = useSelectedWorkflow();
  const [workflowName, setWorkflowName] = useState("Imported Workflow");
  const [workflowDescription, setWorkflowDescription] = useState("Imported from a ComfyUI API JSON file.");
  const [workflowMode, setWorkflowMode] = useState<"bw" | "color">("bw");
  const [templateKey, setTemplateKey] = useState<"sdxl_text2img" | "sdxl_manga" | "sdxl_color_story">(
    "sdxl_text2img"
  );
  const [promptPrefix, setPromptPrefix] = useState("");
  const [workflowJsonText, setWorkflowJsonText] = useState("");

  const importMutation = useMutation({
    mutationFn: async () =>
      importWorkflowPreset({
        name: workflowName,
        description: workflowDescription,
        mode: workflowMode,
        promptPrefix,
        templateKey,
        workflowJson: JSON.parse(workflowJsonText)
      }),
    onSuccess: (workflow) => addWorkflow(workflow)
  });

  return (
    <aside className="surface sidebar">
      <section className="panel-section">
        <h2>Editor Strategy</h2>
        <p>
          Keep layout, workflow, and character memory as separate layers so any panel can be regenerated
          without losing page composition.
        </p>
      </section>

      <section className="panel-section">
        <div className="status-row">
          <h3>Page Templates</h3>
          <span className="status-pill">{page.panels.length} panels</span>
        </div>
        <div className="template-grid">
          {project.templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className="template-card"
              onClick={() => applyTemplate(template)}
            >
              <TemplatePreview template={template} />
              <strong>{template.name}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <div className="status-row">
          <h3>Workflow Presets</h3>
          {selectedWorkflow ? <span className="status-pill">{selectedWorkflow.templateKey}</span> : null}
        </div>
        <div className="card-grid">
          {project.workflows.map((workflow) => (
            <div
              key={workflow.id}
              className={`mini-card ${selectedWorkflow?.id === workflow.id ? "active" : ""}`}
            >
              <strong>{workflow.name}</strong>
              <span>{workflow.description}</span>
              <span>{workflow.controls.join(" · ")}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <h3>Import ComfyUI Workflow</h3>
        <div className="stack">
          <input
            className="input"
            value={workflowName}
            onChange={(event) => setWorkflowName(event.target.value)}
            placeholder="Workflow name"
          />
          <input
            className="input"
            value={workflowDescription}
            onChange={(event) => setWorkflowDescription(event.target.value)}
            placeholder="Workflow description"
          />
          <div className="two-column">
            <select
              className="select"
              value={workflowMode}
              onChange={(event) => setWorkflowMode(event.target.value as "bw" | "color")}
            >
              <option value="bw">Black & White</option>
              <option value="color">Color</option>
            </select>
            <select
              className="select"
              value={templateKey}
              onChange={(event) =>
                setTemplateKey(
                  event.target.value as "sdxl_text2img" | "sdxl_manga" | "sdxl_color_story"
                )
              }
            >
              <option value="sdxl_text2img">sdxl_text2img</option>
              <option value="sdxl_manga">sdxl_manga</option>
              <option value="sdxl_color_story">sdxl_color_story</option>
            </select>
          </div>
          <input
            className="input"
            value={promptPrefix}
            onChange={(event) => setPromptPrefix(event.target.value)}
            placeholder="Prompt prefix"
          />
          <input
            className="input"
            type="file"
            accept=".json,application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) {
                return;
              }
              setWorkflowJsonText(await file.text());
            }}
          />
          <textarea
            className="textarea compact"
            value={workflowJsonText}
            onChange={(event) => setWorkflowJsonText(event.target.value)}
            placeholder="Paste or load a ComfyUI API-format workflow JSON here."
          />
          <button
            className="button primary"
            type="button"
            disabled={!workflowJsonText || importMutation.isPending}
            onClick={() => importMutation.mutate()}
          >
            {importMutation.isPending ? "Importing..." : "Import workflow"}
          </button>
          {importMutation.error ? (
            <div className="callout callout-warning">
              Workflow import failed. Make sure the JSON is valid ComfyUI API format.
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel-section">
        <h3>Scene Memory</h3>
        <div className="card-grid">
          {project.sceneMemories.map((scene) => (
            <div key={scene.id} className="mini-card">
              <strong>{scene.location}</strong>
              <span>
                {scene.timeOfDay} · {scene.weather}
              </span>
              <span>{scene.continuityNotes}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel-section">
        <h3>Character Bible</h3>
        <div className="card-grid">
          {project.characters.map((character) => {
            const active =
              Boolean(selectedPanelId) &&
              page.panels.some(
                (panel) => panel.id === selectedPanelId && panel.characterIds.includes(character.id)
              );

            return (
              <div key={character.id} className={`mini-card ${active ? "active" : ""}`}>
                <strong>{character.name}</strong>
                <span>{character.appearance}</span>
                <span>
                  {character.adapter.provider} · weight {character.adapter.weight}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
