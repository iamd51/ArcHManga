"use client";

import Image from "next/image";
import { useMutation } from "@tanstack/react-query";
import {
  updateCharacterProfile,
  updateSceneMemory,
  updateWorkflowPreset,
  uploadCharacterReference
} from "@/lib/api";
import { buildPromptPreview } from "@/lib/prompt-preview";
import {
  getModeLabel,
  useEditorStore,
  useSelectedPanel,
  useSelectedWorkflow
} from "@/store/editor-store";

interface InspectorProps {
  onGenerate: () => void;
  onContinuityDraft: () => void;
  onPreviewPrompt: () => void;
  generationPending: boolean;
  continuityPending: boolean;
  promptPending: boolean;
}

const bindingSources = [
  "model",
  "positive_prompt",
  "negative_prompt",
  "width",
  "height",
  "steps",
  "cfg",
  "sampler",
  "scheduler",
  "seed",
  "reference_image_url",
  "adapter_weight"
] as const;

export function Inspector({
  onGenerate,
  onContinuityDraft,
  onPreviewPrompt,
  generationPending,
  continuityPending,
  promptPending
}: InspectorProps) {
  const project = useEditorStore((state) => state.project);
  const promptPreview = useEditorStore((state) => state.promptPreview);
  const activeJob = useEditorStore((state) => state.activeJob);
  const selectedPanel = useSelectedPanel();
  const selectedWorkflow = useSelectedWorkflow();
  const updatePanelPrompt = useEditorStore((state) => state.updatePanelPrompt);
  const updatePanelMeta = useEditorStore((state) => state.updatePanelMeta);
  const updatePanelGeneration = useEditorStore((state) => state.updatePanelGeneration);
  const updateSceneMemoryLocal = useEditorStore((state) => state.updateSceneMemory);
  const replaceSceneMemory = useEditorStore((state) => state.replaceSceneMemory);
  const updateCharacter = useEditorStore((state) => state.updateCharacter);
  const replaceCharacter = useEditorStore((state) => state.replaceCharacter);
  const appendCharacterReference = useEditorStore((state) => state.appendCharacterReference);
  const updateCharacterAdapter = useEditorStore((state) => state.updateCharacterAdapter);
  const updateWorkflow = useEditorStore((state) => state.updateWorkflow);
  const addWorkflowBinding = useEditorStore((state) => state.addWorkflowBinding);
  const updateWorkflowBinding = useEditorStore((state) => state.updateWorkflowBinding);
  const removeWorkflowBinding = useEditorStore((state) => state.removeWorkflowBinding);
  const uploadMutation = useMutation({
    mutationFn: uploadCharacterReference,
    onSuccess: (result) => appendCharacterReference(result.characterId, result.reference)
  });
  const characterSaveMutation = useMutation({
    mutationFn: async (characterId: string) => {
      const character = project.characters.find((item) => item.id === characterId);
      if (!character) {
        throw new Error("Character not found.");
      }
      return updateCharacterProfile(characterId, {
        referenceNotes: character.referenceNotes,
        negativePrompt: character.negativePrompt,
        consistency: character.consistency,
        adapter: character.adapter
      });
    },
    onSuccess: (character) => replaceCharacter(character)
  });
  const workflowSaveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWorkflow) {
        throw new Error("No workflow selected.");
      }
      return updateWorkflowPreset(selectedWorkflow.id, {
        promptPrefix: selectedWorkflow.promptPrefix,
        nodeBindings: selectedWorkflow.nodeBindings
      });
    },
    onSuccess: (workflow) => updateWorkflow(workflow.id, workflow)
  });
  const sceneMemorySaveMutation = useMutation({
    mutationFn: async (sceneMemoryId: string) => {
      const currentSceneMemory = project.sceneMemories.find((item) => item.id === sceneMemoryId);
      if (!currentSceneMemory) {
        throw new Error("Scene memory not found.");
      }
      return updateSceneMemory(sceneMemoryId, {
        location: currentSceneMemory.location,
        timeOfDay: currentSceneMemory.timeOfDay,
        weather: currentSceneMemory.weather,
        lighting: currentSceneMemory.lighting,
        mood: currentSceneMemory.mood,
        continuityNotes: currentSceneMemory.continuityNotes
      });
    },
    onSuccess: (nextSceneMemory) => replaceSceneMemory(nextSceneMemory)
  });

  if (!selectedPanel) {
    return (
      <aside className="surface inspector">
        <section className="panel-section">
          <h2>Panel Inspector</h2>
          <p>Select a panel to edit generation settings, continuity rules, and character anchors.</p>
        </section>
      </aside>
    );
  }

  const sceneMemory = project.sceneMemories.find((scene) => scene.id === selectedPanel.sceneMemoryId);
  const attachedCharacters = project.characters.filter((character) =>
    selectedPanel.characterIds.includes(character.id)
  );
  const preview = promptPreview ?? buildPromptPreview(selectedPanel, selectedWorkflow ?? undefined, attachedCharacters);
  const workflowNodeOptions = selectedWorkflow
    ? Object.entries(selectedWorkflow.workflowJson).map(([nodeId, node]) => ({
        nodeId,
        classType: node.class_type ?? "UnknownNode",
        inputs: Object.keys(node.inputs ?? {})
      }))
    : [];
  const characterSlotOptions =
    attachedCharacters.length > 0
      ? attachedCharacters.map((character, index) => ({
          value: index,
          label: `Slot ${index + 1} · ${character.name}`
        }))
      : [
          { value: 0, label: "Slot 1" },
          { value: 1, label: "Slot 2" },
          { value: 2, label: "Slot 3" }
        ];

  return (
    <aside className="surface inspector">
      <section className="panel-section">
        <div className="status-row">
          <h2>{selectedPanel.title}</h2>
          <span className="status-pill">{selectedPanel.latestJobStatus ?? "idle"}</span>
        </div>
        <p>
          Tune prompt, workflow, seed, and consistency rules here. Each panel remains independently
          regenerable.
        </p>
        <div className="toolbar-actions">
          <button
            className="button subtle"
            type="button"
            disabled={continuityPending}
            onClick={onContinuityDraft}
          >
            {continuityPending ? "Drafting..." : "Auto-continue from previous panel"}
          </button>
          <button
            className="button"
            type="button"
            disabled={promptPending}
            onClick={onPreviewPrompt}
          >
            {promptPending ? "Optimizing..." : "Preview optimized prompt"}
          </button>
          <button
            className="button primary"
            type="button"
            disabled={generationPending}
            onClick={onGenerate}
          >
            {generationPending ? "Submitting..." : "Generate this panel"}
          </button>
        </div>
      </section>

      <section className="panel-section">
        <div className="stack">
          <label className="label">Generation mode</label>
          <div className="meta-row">
            {(["bw", "color"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`chip ${selectedPanel.mode === mode ? "active" : ""}`}
                onClick={() => updatePanelMeta(selectedPanel.id, { mode })}
              >
                {getModeLabel(mode)}
              </button>
            ))}
          </div>
        </div>

        <div className="stack">
          <label className="label" htmlFor="model">
            SDXL model
          </label>
          <select
            id="model"
            className="select"
            value={selectedPanel.modelId}
            onChange={(event) => updatePanelMeta(selectedPanel.id, { modelId: event.target.value })}
          >
            {project.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        </div>

        <div className="stack">
          <label className="label" htmlFor="workflow">
            Workflow preset
          </label>
          <select
            id="workflow"
            className="select"
            value={selectedPanel.workflowPresetId}
            onChange={(event) =>
              updatePanelMeta(selectedPanel.id, { workflowPresetId: event.target.value })
            }
          >
            {project.workflows.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.name}
              </option>
            ))}
          </select>
        </div>

        <div className="stack">
          <label className="label" htmlFor="scene-memory">
            Scene memory
          </label>
          <select
            id="scene-memory"
            className="select"
            value={selectedPanel.sceneMemoryId ?? ""}
            onChange={(event) => updatePanelMeta(selectedPanel.id, { sceneMemoryId: event.target.value })}
          >
            {project.sceneMemories.map((scene) => (
              <option key={scene.id} value={scene.id}>
                {scene.location}
              </option>
            ))}
          </select>
        </div>
      </section>

      {sceneMemory ? (
        <section className="panel-section">
          <h3>Scene Memory</h3>
          <div className="two-column">
            <div className="stack">
              <label className="label" htmlFor="scene-location">
                Location
              </label>
              <input
                id="scene-location"
                className="input"
                value={sceneMemory.location}
                onChange={(event) =>
                  updateSceneMemoryLocal(sceneMemory.id, { location: event.target.value })
                }
              />
            </div>
            <div className="stack">
              <label className="label" htmlFor="scene-time">
                Time of day
              </label>
              <input
                id="scene-time"
                className="input"
                value={sceneMemory.timeOfDay}
                onChange={(event) =>
                  updateSceneMemoryLocal(sceneMemory.id, { timeOfDay: event.target.value })
                }
              />
            </div>
            <div className="stack">
              <label className="label" htmlFor="scene-weather">
                Weather
              </label>
              <input
                id="scene-weather"
                className="input"
                value={sceneMemory.weather}
                onChange={(event) =>
                  updateSceneMemoryLocal(sceneMemory.id, { weather: event.target.value })
                }
              />
            </div>
            <div className="stack">
              <label className="label" htmlFor="scene-lighting">
                Lighting
              </label>
              <input
                id="scene-lighting"
                className="input"
                value={sceneMemory.lighting}
                onChange={(event) =>
                  updateSceneMemoryLocal(sceneMemory.id, { lighting: event.target.value })
                }
              />
            </div>
            <div className="stack">
              <label className="label" htmlFor="scene-mood">
                Mood
              </label>
              <input
                id="scene-mood"
                className="input"
                value={sceneMemory.mood}
                onChange={(event) =>
                  updateSceneMemoryLocal(sceneMemory.id, { mood: event.target.value })
                }
              />
            </div>
          </div>
          <div className="stack">
            <label className="label" htmlFor="scene-continuity">
              Continuity notes
            </label>
            <textarea
              id="scene-continuity"
              className="textarea compact"
              value={sceneMemory.continuityNotes}
              onChange={(event) =>
                updateSceneMemoryLocal(sceneMemory.id, { continuityNotes: event.target.value })
              }
            />
          </div>
          <button
            className="button"
            type="button"
            disabled={sceneMemorySaveMutation.isPending}
            onClick={() => sceneMemorySaveMutation.mutate(sceneMemory.id)}
          >
            {sceneMemorySaveMutation.isPending ? "Saving..." : "Save scene memory"}
          </button>
        </section>
      ) : null}

      <section className="panel-section">
        <div className="stack">
          <label className="label" htmlFor="prompt">
            Prompt
          </label>
          <textarea
            id="prompt"
            className="textarea"
            value={selectedPanel.prompt.prompt}
            onChange={(event) => updatePanelPrompt(selectedPanel.id, { prompt: event.target.value })}
          />
        </div>

        <div className="stack">
          <label className="label" htmlFor="scene-summary">
            Scene continuation
          </label>
          <textarea
            id="scene-summary"
            className="textarea"
            value={selectedPanel.prompt.sceneSummary}
            onChange={(event) =>
              updatePanelPrompt(selectedPanel.id, { sceneSummary: event.target.value })
            }
          />
        </div>

        <div className="stack two-column">
          <div className="stack">
            <label className="label" htmlFor="shot-type">
              Shot type
            </label>
            <input
              id="shot-type"
              className="input"
              value={selectedPanel.prompt.shotType}
              onChange={(event) =>
                updatePanelPrompt(selectedPanel.id, { shotType: event.target.value })
              }
            />
          </div>
          <div className="stack">
            <label className="label" htmlFor="style-notes">
              Style notes
            </label>
            <input
              id="style-notes"
              className="input"
              value={selectedPanel.prompt.styleNotes}
              onChange={(event) =>
                updatePanelPrompt(selectedPanel.id, { styleNotes: event.target.value })
              }
            />
          </div>
        </div>

        <div className="stack">
          <label className="label" htmlFor="negative-prompt">
            Negative prompt
          </label>
          <textarea
            id="negative-prompt"
            className="textarea"
            value={selectedPanel.prompt.negativePrompt}
            onChange={(event) =>
              updatePanelPrompt(selectedPanel.id, { negativePrompt: event.target.value })
            }
          />
        </div>
      </section>

      <section className="panel-section">
        <h3>Generation Settings</h3>
        <div className="two-column">
          <div className="stack">
            <label className="label" htmlFor="seed">
              Seed
            </label>
            <input
              id="seed"
              className="input"
              type="number"
              value={selectedPanel.generation.seed}
              onChange={(event) =>
                updatePanelGeneration(selectedPanel.id, { seed: Number(event.target.value) })
              }
            />
          </div>
          <div className="stack">
            <label className="label" htmlFor="steps">
              Steps
            </label>
            <input
              id="steps"
              className="input"
              type="number"
              value={selectedPanel.generation.steps}
              onChange={(event) =>
                updatePanelGeneration(selectedPanel.id, { steps: Number(event.target.value) })
              }
            />
          </div>
          <div className="stack">
            <label className="label" htmlFor="cfg">
              CFG
            </label>
            <input
              id="cfg"
              className="input"
              type="number"
              step="0.1"
              value={selectedPanel.generation.cfg}
              onChange={(event) =>
                updatePanelGeneration(selectedPanel.id, { cfg: Number(event.target.value) })
              }
            />
          </div>
          <div className="stack">
            <label className="label" htmlFor="sampler">
              Sampler
            </label>
            <select
              id="sampler"
              className="select"
              value={selectedPanel.generation.sampler}
              onChange={(event) =>
                updatePanelGeneration(selectedPanel.id, { sampler: event.target.value })
              }
            >
              <option value="euler">euler</option>
              <option value="dpmpp_2m">dpmpp_2m</option>
              <option value="dpmpp_sde">dpmpp_sde</option>
            </select>
          </div>
        </div>

        {selectedWorkflow ? (
          <div className="hint-box">
            <strong>{selectedWorkflow.name}</strong>
            <br />
            {selectedWorkflow.description}
            <br />
            Controls: {selectedWorkflow.controls.join(" · ")}
          </div>
        ) : null}
      </section>

      <section className="panel-section">
        <h3>Character Anchors</h3>
        <div className="meta-row">
          {project.characters.map((character) => {
            const active = selectedPanel.characterIds.includes(character.id);
            return (
              <button
                key={character.id}
                type="button"
                className={`chip ${active ? "active" : ""}`}
                onClick={() => {
                  const nextIds = active
                    ? selectedPanel.characterIds.filter((item) => item !== character.id)
                    : [...selectedPanel.characterIds, character.id];
                  updatePanelMeta(selectedPanel.id, { characterIds: nextIds });
                }}
              >
                {character.name}
              </button>
            );
          })}
        </div>

        {attachedCharacters.length > 0 ? (
          <div className="card-grid">
            {attachedCharacters.map((character) => (
              <div key={character.id} className="mini-card active">
                <strong>{character.name}</strong>
                <span>{character.consistency.anchorFeatures.join(" · ")}</span>
                <div className="two-column">
                  <select
                    className="select"
                    value={character.adapter.provider}
                    onChange={(event) =>
                      updateCharacterAdapter(character.id, {
                        provider: event.target.value as "none" | "ip-adapter" | "instantid"
                      })
                    }
                  >
                    <option value="none">No adapter</option>
                    <option value="ip-adapter">IP-Adapter</option>
                    <option value="instantid">InstantID</option>
                  </select>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={character.adapter.weight}
                    onChange={(event) =>
                      updateCharacterAdapter(character.id, { weight: Number(event.target.value) })
                    }
                  />
                </div>
                <label className="chip">
                  <input
                    type="checkbox"
                    checked={character.adapter.enabled}
                    onChange={(event) =>
                      updateCharacterAdapter(character.id, { enabled: event.target.checked })
                    }
                  />
                  Adapter enabled
                </label>
                <textarea
                  className="textarea compact"
                  value={character.referenceNotes}
                  onChange={(event) =>
                    updateCharacter(character.id, { referenceNotes: event.target.value })
                  }
                />
                <span>Forbidden drift: {character.consistency.forbiddenDrift.join(" · ")}</span>
                <span>
                  References:{" "}
                  {character.references.length > 0
                    ? character.references.map((reference) => reference.label).join(" · ")
                    : "none"}
                </span>
                <button
                  className="button"
                  type="button"
                  disabled={characterSaveMutation.isPending}
                  onClick={() => characterSaveMutation.mutate(character.id)}
                >
                  {characterSaveMutation.isPending ? "Saving..." : "Save character"}
                </button>
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }
                    uploadMutation.mutate({
                      characterId: character.id,
                      file,
                      label: file.name.replace(/\.[^.]+$/, ""),
                      angle: "front",
                      notes: `Uploaded for ${character.name}`
                    });
                    event.target.value = "";
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="hint-box">
            Attach one or more characters to carry forward identity, wardrobe, and negative prompts.
          </div>
        )}
      </section>

      <section className="panel-section">
        <h3>Workflow Tuning</h3>
        {selectedWorkflow ? (
          <div className="card-grid">
            <div className="mini-card">
              <strong>Prompt prefix</strong>
              <textarea
                className="textarea compact"
                value={selectedWorkflow.promptPrefix}
                onChange={(event) =>
                  updateWorkflow(selectedWorkflow.id, { promptPrefix: event.target.value })
                }
              />
            </div>
            <div className="mini-card">
              <div className="status-row">
                <strong>Node mappings</strong>
                <button
                  className="button subtle"
                  type="button"
                  onClick={() =>
                    addWorkflowBinding(selectedWorkflow.id, {
                      id: `bind-${Math.random().toString(36).slice(2, 8)}`,
                      nodeId: workflowNodeOptions[0]?.nodeId ?? "1",
                      inputName: workflowNodeOptions[0]?.inputs[0] ?? "text",
                      source: "positive_prompt",
                      provider: "generic",
                      characterIndex: 0
                    })
                  }
                >
                  Add mapping
                </button>
              </div>
              <div className="stack">
                {selectedWorkflow.nodeBindings.map((binding) => {
                  const selectedNode =
                    workflowNodeOptions.find((node) => node.nodeId === binding.nodeId) ?? workflowNodeOptions[0];
                  const inputOptions = selectedNode?.inputs ?? [binding.inputName];

                  return (
                    <div key={binding.id} className="binding-row">
                      <select
                        className="select"
                        value={binding.nodeId}
                        onChange={(event) =>
                          updateWorkflowBinding(selectedWorkflow.id, binding.id, {
                            nodeId: event.target.value,
                            inputName:
                              workflowNodeOptions.find((node) => node.nodeId === event.target.value)?.inputs[0] ??
                              binding.inputName
                          })
                        }
                      >
                        {workflowNodeOptions.map((node) => (
                          <option key={node.nodeId} value={node.nodeId}>
                            {node.nodeId} · {node.classType}
                          </option>
                        ))}
                      </select>
                      <select
                        className="select"
                        value={binding.inputName}
                        onChange={(event) =>
                          updateWorkflowBinding(selectedWorkflow.id, binding.id, {
                            inputName: event.target.value
                          })
                        }
                      >
                        {inputOptions.map((inputName) => (
                          <option key={`${binding.id}-${inputName}`} value={inputName}>
                            {inputName}
                          </option>
                        ))}
                      </select>
                      <select
                        className="select"
                        value={binding.source}
                        onChange={(event) =>
                          updateWorkflowBinding(selectedWorkflow.id, binding.id, {
                            source: event.target.value as (typeof bindingSources)[number]
                          })
                        }
                      >
                        {bindingSources.map((source) => (
                          <option key={`${binding.id}-${source}`} value={source}>
                            {source}
                          </option>
                        ))}
                      </select>
                      <select
                        className="select"
                        value={binding.provider ?? "generic"}
                        onChange={(event) =>
                          updateWorkflowBinding(selectedWorkflow.id, binding.id, {
                            provider: event.target.value as "generic" | "ip-adapter" | "instantid"
                          })
                        }
                      >
                        <option value="generic">generic</option>
                        <option value="ip-adapter">ip-adapter</option>
                        <option value="instantid">instantid</option>
                      </select>
                      <input
                        className="input"
                        value={binding.label ?? ""}
                        placeholder="Optional label"
                        onChange={(event) =>
                          updateWorkflowBinding(selectedWorkflow.id, binding.id, {
                            label: event.target.value
                          })
                        }
                      />
                      <select
                        className="select"
                        value={binding.characterIndex ?? 0}
                        onChange={(event) =>
                          updateWorkflowBinding(selectedWorkflow.id, binding.id, {
                            characterIndex: Number(event.target.value)
                          })
                        }
                      >
                        {characterSlotOptions.map((slot) => (
                          <option key={`${binding.id}-slot-${slot.value}`} value={slot.value}>
                            {slot.label}
                          </option>
                        ))}
                      </select>
                      <button
                        className="button subtle"
                        type="button"
                        onClick={() => removeWorkflowBinding(selectedWorkflow.id, binding.id)}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="toolbar-actions">
                <button
                  className="button primary"
                  type="button"
                  disabled={workflowSaveMutation.isPending}
                  onClick={() => workflowSaveMutation.mutate()}
                >
                  {workflowSaveMutation.isPending ? "Saving..." : "Save workflow preset"}
                </button>
              </div>
              {workflowSaveMutation.error ? (
                <div className="callout callout-warning">
                  Workflow save failed. Check that the API is running and the preset still exists.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel-section">
        <h3>Prompt Preview</h3>
        <div className="hint-box">{preview.optimizedPrompt}</div>
        <div className="meta-row">
          {preview.continuityHints.map((hint) => (
            <span key={hint} className="chip">
              {hint}
            </span>
          ))}
        </div>
        {sceneMemory ? (
          <div className="hint-box">
            <strong>{sceneMemory.location}</strong>
            <br />
            {sceneMemory.timeOfDay} · {sceneMemory.weather} · {sceneMemory.lighting}
            <br />
            {sceneMemory.continuityNotes}
          </div>
        ) : null}
        {uploadMutation.error ? (
          <div className="callout callout-warning">
            Reference upload failed. Check that the API is running and multipart uploads are enabled.
          </div>
        ) : null}
        {characterSaveMutation.error ? (
          <div className="callout callout-warning">
            Character save failed. Check that the API is running before saving consistency settings.
          </div>
        ) : null}
        {sceneMemorySaveMutation.error ? (
          <div className="callout callout-warning">
            Scene memory save failed. Check that the API is running before saving scene continuity.
          </div>
        ) : null}
      </section>

      {selectedPanel.imageUrl ? (
        <section className="panel-section">
          <h3>Latest Render</h3>
          <Image
            className="render-preview"
            src={selectedPanel.imageUrl}
            alt={`${selectedPanel.title} render`}
            width={720}
            height={420}
            unoptimized
          />
          {activeJob?.panelId === selectedPanel.id ? (
            <div className="hint-box">{activeJob.detail}</div>
          ) : null}
        </section>
      ) : null}
    </aside>
  );
}
