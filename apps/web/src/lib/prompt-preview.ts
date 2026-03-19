import type { CharacterProfile, ComicPanel, WorkflowPreset } from "@archmanga/shared";
import { buildContinuityLockSuggestion, buildPanelConsistencyPlan } from "@/lib/character-consistency";

function buildRevisionHints(panel: ComicPanel) {
  const hints: string[] = [];
  if (panel.prompt.revisionIntent.preserveComposition) {
    hints.push("Preserve the current composition and staging.");
  }
  if (panel.prompt.revisionIntent.preserveBackground) {
    hints.push("Keep the background layout and environment stable.");
  }
  if (panel.prompt.revisionIntent.preserveCharacterIdentity) {
    hints.push("Hold facial identity, wardrobe, and silhouette consistency.");
  }
  if (panel.prompt.revisionIntent.lockCharacterAppearance) {
    hints.push("Lock the recurring character appearance anchors and facial identity.");
  }
  if (panel.prompt.revisionIntent.lockCharacterWardrobe) {
    hints.push("Keep outfit continuity locked to the previous successful panel.");
  }
  if (panel.prompt.revisionIntent.lockCharacterExpression) {
    hints.push("Carry the previous expression unless the new beat explicitly changes it.");
  }
  if (panel.prompt.revisionIntent.lockCameraFraming) {
    hints.push("Preserve the camera framing language from the previous beat when possible.");
  }
  if (panel.prompt.revisionIntent.editPriority !== "general") {
    hints.push(`Primary revision target: ${panel.prompt.revisionIntent.editPriority}.`);
  }
  if (panel.prompt.revisionIntent.changeInstructions) {
    hints.push(`Revision note: ${panel.prompt.revisionIntent.changeInstructions}`);
  }
  for (const characterLock of panel.prompt.revisionIntent.characterLocks ?? []) {
    const lockSummary = [
      characterLock.lockCharacterAppearance ? "appearance" : "",
      characterLock.lockCharacterWardrobe ? "wardrobe" : "",
      characterLock.lockCharacterExpression ? "expression" : "",
      characterLock.lockCameraFraming ? "camera" : "",
      characterLock.preserveCharacterIdentity ? "identity" : "",
      characterLock.note ?? ""
    ]
      .filter(Boolean)
      .join(", ");
    if (lockSummary) {
      hints.push(`Per-character lock for ${characterLock.characterId}: ${lockSummary}.`);
    }
  }
  if (panel.inpaintMask.enabled) {
    hints.push("Use the active inpaint mask to limit the redraw area.");
  }
  return hints;
}

export function buildPromptPreview(
  panel: ComicPanel,
  workflow: WorkflowPreset | undefined,
  characters: CharacterProfile[],
  previousPanel?: ComicPanel
) {
  const consistencyPlan = buildPanelConsistencyPlan(panel, characters, previousPanel);
  const previousSnapshot = previousPanel?.continuitySnapshot;
  const continuityLockSuggestion = buildContinuityLockSuggestion(panel, previousPanel, characters);
  const characterLine = consistencyPlan.characterPlans
    .map(
      (plan) =>
        `${plan.characterName}: ${plan.anchorSummary}; wardrobe=${plan.wardrobeLock}; refs=${plan.selectedReferenceLabels.join("/")}`
    )
    .join(" | ");

  const continuityHints = [
    panel.prompt.sceneSummary || "Carry over location, weather, and emotional tone from prior panel.",
    previousSnapshot?.continuitySummary ? `Previous panel lock: ${previousSnapshot.continuitySummary}` : "",
    continuityLockSuggestion?.summary ?? "",
    panel.prompt.shotType ? `Preferred shot: ${panel.prompt.shotType}` : "",
    panel.prompt.styleNotes ? `Style anchor: ${panel.prompt.styleNotes}` : "",
    ...buildRevisionHints(panel),
    consistencyPlan.summary,
    ...consistencyPlan.globalHints,
    ...consistencyPlan.characterPlans.flatMap((plan) => [...plan.promptHints.slice(0, 2), ...plan.warnings.slice(0, 1)])
  ].filter(Boolean);

  const optimizedPrompt = [
    workflow?.promptPrefix,
    panel.prompt.prompt,
    continuityLockSuggestion?.summary ? `Continuity locks: ${continuityLockSuggestion.summary}` : "",
    characterLine ? `Character anchors: ${characterLine}` : "",
    previousSnapshot?.characterStates.length
      ? `Carry forward continuity states: ${previousSnapshot.characterStates
          .map(
            (state) =>
              `${state.characterName} expression=${state.expression || "neutral"} wardrobe=${state.wardrobe || "same"} framing=${state.framingCue || "same"}`
          )
          .join(" | ")}`
      : "",
    consistencyPlan.characterPlans.length
      ? `Consistency locks: ${[...consistencyPlan.globalHints, ...consistencyPlan.characterPlans.map((plan) => plan.anchorSummary)].filter(Boolean).join(" | ")}`
      : "",
    continuityHints.join(" "),
    "Preserve manga readability and maintain clean silhouette separation between foreground and background."
  ]
    .filter(Boolean)
    .join(", ");

  return {
    userPrompt: panel.prompt.prompt,
    optimizedPrompt,
    continuityHints,
    sceneState:
      panel.prompt.sceneSummary || previousSnapshot?.sceneSummary || "No scene summary yet.",
    consistencyPlan
  };
}
