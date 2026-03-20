"use client";

import { startTransition, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { ComicProject, DirectorChatMessage, DirectorDraftResult } from "@archmanga/shared";
import { createDirectorDraft } from "@/lib/api";
import { buildPanelConsistencyPlan } from "@/lib/character-consistency";
import { getMaskPresetById, suggestContextualMask, suggestMaskPreset } from "@/lib/mask-presets";
import {
  applyQuickRepairRecipe,
  inferQuickRepairRecipe,
  QUICK_REPAIR_RECIPES
} from "@/lib/quick-repair";
import { resolveGenerationWorkflow, type GenerationRequestTarget } from "@/lib/use-generation";
import { useCurrentPage, useEditorStore, useSelectedPanel } from "@/store/editor-store";

interface DirectorConsoleProps {
  generationPending: boolean;
  onGeneratePanel: (payload?: GenerationRequestTarget) => void;
}

function buildDirectorContextSummary(args: {
  selectedPanelTitle: string;
  selectedPanelPrompt: string;
  selectedPanelSnapshot?: string;
  previousPanelTitle?: string;
  previousPanelPrompt?: string;
  previousPanelSnapshot?: string;
  sceneContinuity?: string;
  revisionInstructions?: string;
  selectedCharacterNames: string[];
  characterLockSummary?: string;
  consistencySummary?: string;
  latestDraft?: DirectorDraftResult | null;
}) {
  const parts = [
    `Selected panel: ${args.selectedPanelTitle}`,
    args.selectedPanelPrompt ? `Current panel prompt: ${args.selectedPanelPrompt}` : "",
    args.selectedPanelSnapshot ? `Current panel snapshot: ${args.selectedPanelSnapshot}` : "",
    args.previousPanelTitle ? `Previous panel: ${args.previousPanelTitle}` : "",
    args.previousPanelPrompt ? `Previous beat: ${args.previousPanelPrompt}` : "",
    args.previousPanelSnapshot ? `Previous snapshot: ${args.previousPanelSnapshot}` : "",
    args.sceneContinuity ? `Scene continuity: ${args.sceneContinuity}` : "",
    args.revisionInstructions ? `Current revision lock: ${args.revisionInstructions}` : "",
    args.selectedCharacterNames.length
      ? `Characters in play: ${args.selectedCharacterNames.join(", ")}`
      : "Characters in play: infer from current page context",
    args.characterLockSummary ? `Character lock overrides: ${args.characterLockSummary}` : "",
    args.consistencySummary ? `Consistency plan: ${args.consistencySummary}` : "",
    args.latestDraft?.assistantMessage ? `Last director note: ${args.latestDraft.assistantMessage}` : ""
  ];

  return parts.filter(Boolean).join(" | ");
}

function resolveWorkflowForMode(
  project: ComicProject,
  workflowId: string,
  mode: "bw" | "color"
) {
  return (
    project.workflows.find((workflow) => workflow.id === workflowId && workflow.mode === mode) ?? null
  );
}

function resolveModelForMode(
  project: ComicProject,
  modelId: string,
  mode: "bw" | "color"
) {
  return (
    project.models.find((model) => model.id === modelId && model.tags.includes(mode)) ??
    project.models.find((model) => model.tags.includes(mode)) ??
    project.models[0] ??
    null
  );
}

function resolveSuggestedMask(panel: ReturnType<typeof useSelectedPanel>, latestDraft: DirectorDraftResult | null) {
  if (!panel || !panel.imageUrl || !latestDraft?.panelSuggestion?.revisionIntent) {
    return panel?.inpaintMask;
  }

  const revisionIntent = latestDraft.panelSuggestion.revisionIntent;
  const suggestion = suggestContextualMask(panel, revisionIntent, {
    shotType: latestDraft.panelSuggestion.shotType,
    prompt: latestDraft.panelSuggestion.prompt
  });
  if (suggestion) {
    return suggestion.mask;
  }
  return panel.inpaintMask;
}

export function DirectorConsole({ generationPending, onGeneratePanel }: DirectorConsoleProps) {
  const project = useEditorStore((state) => state.project);
  const updatePanelPrompt = useEditorStore((state) => state.updatePanelPrompt);
  const updatePanelMeta = useEditorStore((state) => state.updatePanelMeta);
  const updatePanelInpaintMask = useEditorStore((state) => state.updatePanelInpaintMask);
  const updateSceneMemory = useEditorStore((state) => state.updateSceneMemory);
  const applyDirectorStoryboard = useEditorStore((state) => state.applyDirectorStoryboard);
  const currentPage = useCurrentPage();
  const selectedPanel = useSelectedPanel();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<DirectorChatMessage[]>([
    {
      role: "assistant",
      content:
        "Describe the next beat, ask for a storyboard split, or tell me how to revise the selected panel."
    }
  ]);
  const [latestDraft, setLatestDraft] = useState<DirectorDraftResult | null>(null);

  const currentIndex = currentPage.panels.findIndex((panel) => panel.id === selectedPanel?.id);
  const previousPanel = currentIndex > 0 ? currentPage.panels[currentIndex - 1] : undefined;
  const currentSceneMemory = project.sceneMemories.find(
    (sceneMemory) => sceneMemory.id === selectedPanel?.sceneMemoryId
  );
  const previousSceneMemory = project.sceneMemories.find(
    (sceneMemory) => sceneMemory.id === previousPanel?.sceneMemoryId
  );
  const selectedCharacters = project.characters.filter((character) =>
    selectedPanel?.characterIds.includes(character.id)
  );
  const consistencyPlan = selectedPanel
    ? buildPanelConsistencyPlan(selectedPanel, selectedCharacters, previousPanel)
    : null;
  const contextSummary = buildDirectorContextSummary({
    selectedPanelTitle: selectedPanel?.title ?? currentPage.title,
    selectedPanelPrompt: selectedPanel?.prompt.prompt ?? "",
    selectedPanelSnapshot: selectedPanel?.continuitySnapshot?.continuitySummary,
    previousPanelTitle: previousPanel?.title,
    previousPanelPrompt: previousPanel?.prompt.prompt,
    previousPanelSnapshot: previousPanel?.continuitySnapshot?.continuitySummary,
    sceneContinuity:
      currentSceneMemory?.continuityNotes ??
      previousSceneMemory?.continuityNotes ??
      previousPanel?.continuitySnapshot?.continuitySummary ??
      selectedPanel?.prompt.sceneSummary,
    revisionInstructions: selectedPanel
      ? [
          selectedPanel.prompt.revisionIntent.preserveComposition ? "keep composition" : "",
          selectedPanel.prompt.revisionIntent.preserveBackground ? "keep background" : "",
          selectedPanel.prompt.revisionIntent.preserveCharacterIdentity ? "keep identity" : "",
          selectedPanel.prompt.revisionIntent.lockCharacterAppearance ? "lock appearance" : "",
          selectedPanel.prompt.revisionIntent.lockCharacterWardrobe ? "lock wardrobe" : "",
          selectedPanel.prompt.revisionIntent.lockCharacterExpression ? "lock expression" : "",
          selectedPanel.prompt.revisionIntent.lockCameraFraming ? "lock framing" : "",
          selectedPanel.prompt.revisionIntent.changeInstructions,
          selectedPanel.inpaintMask.enabled ? "mask active" : ""
        ]
          .filter(Boolean)
          .join(", ")
      : "",
    selectedCharacterNames: selectedCharacters.map((character) => character.name),
    characterLockSummary: selectedPanel?.prompt.revisionIntent.characterLocks?.length
      ? selectedPanel.prompt.revisionIntent.characterLocks
          .map((lock) => {
            const characterName =
              selectedCharacters.find((character) => character.id === lock.characterId)?.name ?? lock.characterId;
            const bits = [
              lock.lockCharacterAppearance ? "appearance" : "",
              lock.lockCharacterWardrobe ? "wardrobe" : "",
              lock.lockCharacterExpression ? "expression" : "",
              lock.lockCameraFraming ? "camera" : "",
              lock.preserveCharacterIdentity ? "identity" : ""
            ].filter(Boolean);
            return `${characterName}: ${bits.join("/")}`;
          })
          .join(" | ")
      : "",
    consistencySummary: consistencyPlan?.summary,
    latestDraft
  });

  const directorMutation = useMutation({
    mutationFn: async (userMessage: string) =>
      createDirectorDraft({
        userMessage,
        history: messages,
        contextSummary,
        project,
        currentPage,
        selectedPanel: selectedPanel ?? undefined,
        currentSceneMemory,
        previousPanel,
        previousSceneMemory,
        selectedCharacters,
        availableCharacters: project.characters
      }),
    onSuccess: (draft, userMessage) => {
      setMessages((current) => [
        ...current,
        { role: "user", content: userMessage },
        { role: "assistant", content: draft.assistantMessage }
      ]);
      setLatestDraft(draft);
      setInput("");
    }
  });

  const buildSuggestedPanelTarget = () => {
    if (!selectedPanel || !latestDraft?.panelSuggestion) {
      return null;
    }

    const suggestion = latestDraft.panelSuggestion;
    const nextMode = suggestion.mode ?? selectedPanel.mode;
    const nextModel = resolveModelForMode(project, selectedPanel.modelId, nextMode);
    const nextCharacterIds = suggestion.characterIds.length ? suggestion.characterIds : selectedPanel.characterIds;
    const nextInpaintMask = resolveSuggestedMask(selectedPanel, latestDraft) ?? selectedPanel.inpaintMask;
    const nextPanel = {
      ...selectedPanel,
      mode: nextMode,
      workflowPresetId: resolveWorkflowForMode(project, selectedPanel.workflowPresetId, nextMode)?.id ?? selectedPanel.workflowPresetId,
      modelId: nextModel?.id ?? selectedPanel.modelId,
      characterIds: nextCharacterIds,
      inpaintMask: nextInpaintMask,
      prompt: {
        ...selectedPanel.prompt,
        prompt: suggestion.prompt,
        sceneSummary:
          suggestion.sceneSummary ||
          latestDraft.sceneSuggestion?.continuityNotes ||
          currentSceneMemory?.continuityNotes ||
          selectedPanel.prompt.sceneSummary,
        shotType: suggestion.shotType || selectedPanel.prompt.shotType,
        styleNotes: suggestion.styleNotes || selectedPanel.prompt.styleNotes,
        revisionIntent: suggestion.revisionIntent ?? selectedPanel.prompt.revisionIntent
      }
    };
    const nextWorkflow = resolveGenerationWorkflow(
      project,
      nextPanel,
      resolveWorkflowForMode(project, selectedPanel.workflowPresetId, nextMode)
    );
    nextPanel.workflowPresetId = nextWorkflow?.id ?? nextPanel.workflowPresetId;
    const characters = project.characters.filter((character) => nextCharacterIds.includes(character.id));

    return {
      panel: nextPanel,
      workflow: nextWorkflow,
      characters
    };
  };

  const buildQuickRepairTarget = () => {
    if (!selectedPanel?.imageUrl || !latestDraft?.panelSuggestion?.revisionIntent) {
      return null;
    }
    const recipeId =
      latestDraft.quickRepairRecipeId ??
      inferQuickRepairRecipe(latestDraft.panelSuggestion.revisionIntent);
    const baseTarget = buildSuggestedPanelTarget();
    if (!recipeId || !baseTarget) {
      return null;
    }
    const repaired = applyQuickRepairRecipe(baseTarget.panel, recipeId);
    return {
      ...baseTarget,
      panel: repaired.panel,
      recipe: repaired.recipe
    };
  };

  const syncSceneSuggestion = () => {
    if (selectedPanel?.sceneMemoryId && latestDraft?.sceneSuggestion) {
      updateSceneMemory(selectedPanel.sceneMemoryId, {
        location: latestDraft.sceneSuggestion.location || currentSceneMemory?.location,
        timeOfDay: latestDraft.sceneSuggestion.timeOfDay || currentSceneMemory?.timeOfDay,
        weather: latestDraft.sceneSuggestion.weather || currentSceneMemory?.weather,
        lighting: latestDraft.sceneSuggestion.lighting || currentSceneMemory?.lighting,
        mood: latestDraft.sceneSuggestion.mood || currentSceneMemory?.mood,
        continuityNotes:
          latestDraft.sceneSuggestion.continuityNotes || currentSceneMemory?.continuityNotes
      });
    }
  };

  const applyPanelSuggestion = () => {
    const target = buildSuggestedPanelTarget();
    if (!target || !selectedPanel) {
      return;
    }

    updatePanelPrompt(selectedPanel.id, {
      prompt: target.panel.prompt.prompt,
      sceneSummary: target.panel.prompt.sceneSummary,
      shotType: target.panel.prompt.shotType,
      styleNotes: target.panel.prompt.styleNotes,
      revisionIntent: target.panel.prompt.revisionIntent
    });
    updatePanelMeta(selectedPanel.id, {
      mode: target.panel.mode,
      modelId: target.panel.modelId,
      workflowPresetId: target.panel.workflowPresetId,
      characterIds: target.panel.characterIds
    });
    updatePanelInpaintMask(selectedPanel.id, target.panel.inpaintMask);
    syncSceneSuggestion();
  };

  const generateFromDraft = () => {
    const target = buildSuggestedPanelTarget();
    if (!target) {
      return;
    }

    applyPanelSuggestion();
    startTransition(() => {
      onGeneratePanel({
        panel: target.panel,
        workflow: target.workflow,
        characters: target.characters,
        pageId: currentPage.id
      });
    });
  };

  const generateRepairFromDraft = () => {
    const target = buildQuickRepairTarget();
    if (!target || !selectedPanel) {
      return;
    }

    updatePanelPrompt(selectedPanel.id, {
      prompt: target.panel.prompt.prompt,
      sceneSummary: target.panel.prompt.sceneSummary,
      shotType: target.panel.prompt.shotType,
      styleNotes: target.panel.prompt.styleNotes,
      revisionIntent: target.panel.prompt.revisionIntent
    });
    updatePanelMeta(selectedPanel.id, {
      mode: target.panel.mode,
      modelId: target.panel.modelId,
      workflowPresetId: target.panel.workflowPresetId,
      characterIds: target.panel.characterIds
    });
    updatePanelInpaintMask(selectedPanel.id, target.panel.inpaintMask);
    syncSceneSuggestion();
    startTransition(() => {
      onGeneratePanel({
        panel: target.panel,
        workflow: target.workflow,
        characters: target.characters,
        pageId: currentPage.id
      });
    });
  };

  const applyStoryboard = () => {
    if (!latestDraft?.suggestedBeats.length) {
      return;
    }

    applyDirectorStoryboard({
      beats: latestDraft.suggestedBeats,
      mode: latestDraft.panelSuggestion?.mode ?? selectedPanel?.mode ?? "bw",
      characterIds: latestDraft.selectedCharacterIds,
      sceneMemoryId: selectedPanel?.sceneMemoryId,
      styleNotes: latestDraft.panelSuggestion?.styleNotes
    });

    syncSceneSuggestion();
  };
  const canApplyPanelDraft = Boolean(selectedPanel && latestDraft?.panelSuggestion);
  const canGeneratePanelDraft =
    canApplyPanelDraft && Boolean(buildSuggestedPanelTarget()?.workflow) && !generationPending;
  const quickRepairTarget = buildQuickRepairTarget();
  const suggestedQuickRepairLabel = latestDraft?.quickRepairRecipeId
    ? QUICK_REPAIR_RECIPES[latestDraft.quickRepairRecipeId]?.label ?? latestDraft.quickRepairRecipeId
    : null;
  const suggestedMaskPreset = getMaskPresetById(
    selectedPanel && latestDraft?.panelSuggestion?.revisionIntent
      ? suggestMaskPreset(selectedPanel, latestDraft.panelSuggestion.revisionIntent)
      : null
  );

  return (
    <section className="panel-section">
      <div className="status-row">
        <h3>AI Director</h3>
        <span className="status-pill">{selectedPanel ? selectedPanel.title : currentPage.title}</span>
      </div>
      <p>
        Talk to the director to split beats into panels, keep continuity, or rewrite the selected panel
        without filling every field by hand.
      </p>
      <div className="stack">
        <div className="hint-box">
          {messages.slice(-4).map((message, index) => (
            <div key={`${message.role}-${index}`}>
              <strong>{message.role === "assistant" ? "Director" : "You"}:</strong> {message.content}
            </div>
          ))}
        </div>
        <textarea
          className="textarea compact"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Example: Rin 全鎖，Kai 只放開表情，鏡頭不變。或是幫我把這段劇情拆成 4 格。"
        />
        <div className="toolbar-actions">
          <button
            className="button primary"
            type="button"
            disabled={!input.trim() || directorMutation.isPending}
            onClick={() => directorMutation.mutate(input.trim())}
          >
            {directorMutation.isPending ? "Directing..." : "Ask the director"}
          </button>
          <button
            className="button"
            type="button"
            disabled={!canApplyPanelDraft}
            onClick={applyPanelSuggestion}
          >
            Apply to selected panel
          </button>
          <button
            className="button primary"
            type="button"
            disabled={!canGeneratePanelDraft}
            onClick={generateFromDraft}
          >
            {generationPending ? "Generating..." : "Apply + generate panel"}
          </button>
          <button
            className="button primary"
            type="button"
            disabled={!quickRepairTarget || generationPending}
            onClick={generateRepairFromDraft}
          >
            {generationPending ? "Generating..." : quickRepairTarget?.recipe.ctaLabel ?? "Repair + generate"}
          </button>
          <button
            className="button"
            type="button"
            disabled={!latestDraft?.suggestedBeats.length}
            onClick={applyStoryboard}
          >
            Apply beats to current page
          </button>
        </div>
        {latestDraft ? (
          <>
            <div className="hint-box">
              <strong>Director summary</strong>
              <br />
              {latestDraft.assistantMessage}
            </div>
            {latestDraft.continuityHints.length ? (
              <div className="meta-row">
                {latestDraft.continuityHints.map((hint) => (
                  <span key={hint} className="chip">
                    {hint}
                  </span>
                ))}
              </div>
            ) : null}
            {latestDraft.panelSuggestion?.revisionIntent ? (
              <div className="meta-row">
                {latestDraft.panelSuggestion.revisionIntent.preserveComposition ? (
                  <span className="chip active">Keep composition</span>
                ) : null}
                {latestDraft.panelSuggestion.revisionIntent.preserveBackground ? (
                  <span className="chip active">Keep background</span>
                ) : null}
                {latestDraft.panelSuggestion.revisionIntent.preserveCharacterIdentity ? (
                  <span className="chip active">Keep identity</span>
                ) : null}
                <span className="chip">
                  Edit target: {latestDraft.panelSuggestion.revisionIntent.editPriority}
                </span>
                {(latestDraft.panelSuggestion.revisionIntent.characterLocks ?? []).map((lock) => {
                  const characterName =
                    project.characters.find((character) => character.id === lock.characterId)?.name ?? lock.characterId;
                  const label = [
                    lock.lockCharacterAppearance ? "appearance" : "",
                    lock.lockCharacterWardrobe ? "wardrobe" : "",
                    lock.lockCharacterExpression ? "expression" : "",
                    lock.lockCameraFraming ? "camera" : "",
                    lock.lockCharacterExpression === false ? "expression free" : "",
                    lock.lockCharacterWardrobe === false ? "wardrobe free" : "",
                    lock.lockCharacterAppearance === false ? "appearance free" : "",
                    lock.lockCameraFraming === false ? "camera free" : ""
                  ]
                    .filter(Boolean)
                    .join("/");
                  return label ? (
                    <span key={`${lock.characterId}-${label}`} className="chip active">
                      {characterName}: {label}
                    </span>
                  ) : null;
                })}
                {suggestedMaskPreset ? (
                  <span className="chip active">Mask template: {suggestedMaskPreset.label}</span>
                ) : null}
                {quickRepairTarget ? (
                  <span className="chip active">Quick repair: {quickRepairTarget.recipe.label}</span>
                ) : null}
                {!quickRepairTarget && suggestedQuickRepairLabel ? (
                  <span className="chip active">Director repair: {suggestedQuickRepairLabel}</span>
                ) : null}
              </div>
            ) : null}
            {latestDraft.suggestedBeats.length ? (
              <div className="card-grid">
                {latestDraft.suggestedBeats.map((beat) => (
                  <div key={beat.id} className="mini-card">
                    <strong>{beat.title}</strong>
                    <span>{beat.description}</span>
                    <span>
                      {beat.shotType} · {beat.mode}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
        {directorMutation.error ? (
          <div className="callout callout-warning">
            Director request failed. Check that the API is running before asking for a new draft.
          </div>
        ) : null}
      </div>
    </section>
  );
}
