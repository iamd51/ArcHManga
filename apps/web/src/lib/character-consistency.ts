import type {
  CharacterContinuityState,
  CharacterConsistencySelection,
  CharacterProfile,
  ComicPanel,
  PanelContinuitySnapshot,
  PanelConsistencyPlan
} from "@archmanga/shared";

export interface ConsistencyPreflight {
  status: "ready" | "caution" | "blocked";
  title: string;
  reasons: string[];
}

function resolveReadiness(score: number): PanelConsistencyPlan["readiness"] {
  if (score >= 75) {
    return "strong";
  }
  if (score >= 45) {
    return "partial";
  }
  return "weak";
}

function selectPreferredRoles(panel: ComicPanel) {
  const shotType = panel.prompt.shotType.toLowerCase();
  const editPriority = panel.prompt.revisionIntent.editPriority;
  if (["close", "reaction", "portrait"].some((token) => shotType.includes(token)) || editPriority === "expression") {
    return ["primary", "face", "expression", "support", "full-body", "outfit"] as const;
  }
  if (["wide", "long", "full"].some((token) => shotType.includes(token)) || editPriority === "pose") {
    return ["full-body", "outfit", "primary", "support", "face", "expression"] as const;
  }
  return ["primary", "face", "full-body", "outfit", "expression", "support"] as const;
}

function scoreCharacterConsistency(panel: ComicPanel, character: CharacterProfile, activeReferenceCount: number) {
  let score = 0;
  if (character.appearance) {
    score += 18;
  }
  if (character.wardrobe) {
    score += 14;
  }
  if (character.referenceNotes) {
    score += 8;
  }
  if (character.consistency.anchorFeatures.length) {
    score += 18;
  }
  if (character.consistency.forbiddenDrift.length) {
    score += 10;
  }
  if (character.consistency.expressionDefaults.length) {
    score += 6;
  }
  if (activeReferenceCount) {
    score += 16;
  }
  if (character.adapter.enabled && activeReferenceCount) {
    score += 8;
  }
  if (panel.prompt.revisionIntent.preserveCharacterIdentity) {
    score += 6;
  }
  return Math.min(score, 100);
}

function selectReferenceImages(
  character: CharacterProfile,
  preferredRoles: readonly CharacterProfile["references"][number]["role"][]
) {
  const roleRank = new Map(preferredRoles.map((role, index) => [role, preferredRoles.length - index]));
  const adapterRank = new Map(
    character.adapter.referenceImageIds.map((referenceId, index) => [
      referenceId,
      character.adapter.referenceImageIds.length - index
    ])
  );

  return [...character.references]
    .sort((left, right) => {
      const leftScore =
        (roleRank.get(left.role) ?? 0) * 100 +
        (adapterRank.get(left.id) ?? 0) * 10 +
        (left.role === "primary" ? 1 : 0);
      const rightScore =
        (roleRank.get(right.role) ?? 0) * 100 +
        (adapterRank.get(right.id) ?? 0) * 10 +
        (right.role === "primary" ? 1 : 0);
      return rightScore - leftScore;
    })
    .slice(0, 2);
}

function buildWarnings(
  panel: ComicPanel,
  character: CharacterProfile,
  preferredRoles: readonly CharacterProfile["references"][number]["role"][],
  selectedReferences: CharacterProfile["references"]
) {
  const roles = new Set(character.references.map((reference) => reference.role));
  const warnings: string[] = [];
  if (!character.references.length) {
    warnings.push("No reference images uploaded yet.");
  }
  if (character.adapter.enabled && !character.adapter.referenceImageIds.length) {
    warnings.push("Adapter is enabled but no adapter references are selected.");
  }
  if (
    ["primary", "face", "expression"].includes(preferredRoles[0]) &&
    !["primary", "face", "expression"].some((role) => roles.has(role as CharacterProfile["references"][number]["role"]))
  ) {
    warnings.push("Close-up identity references are missing for this shot.");
  }
  if (
    ["full-body", "outfit"].includes(preferredRoles[0]) &&
    !["full-body", "outfit"].some((role) => roles.has(role as CharacterProfile["references"][number]["role"]))
  ) {
    warnings.push("Full-body or outfit anchors are missing for this shot.");
  }
  if (panel.prompt.revisionIntent.preserveCharacterIdentity && !selectedReferences.length) {
    warnings.push("Identity lock is enabled, but this panel has no active reference anchors.");
  }
  return warnings;
}

export function buildPanelConsistencyPlan(
  panel: ComicPanel,
  characters: CharacterProfile[]
): PanelConsistencyPlan {
  const characterPlans: CharacterConsistencySelection[] = characters.map((character) => {
    const preferredRoles = selectPreferredRoles(panel);
    const selectedReferences = selectReferenceImages(character, preferredRoles);
    const score = scoreCharacterConsistency(panel, character, selectedReferences.length);
    return {
      characterId: character.id,
      characterName: character.name,
      readiness: resolveReadiness(score),
      score,
      anchorSummary: [
        character.consistency.anchorFeatures.join(", "),
        character.consistency.bodyShape,
        character.appearance
      ]
        .filter(Boolean)
        .join("; "),
      wardrobeLock: character.wardrobe,
      expressionCue: character.consistency.expressionDefaults.join(", "),
      selectedReferenceIds: selectedReferences.map((reference) => reference.id),
      selectedReferenceLabels: selectedReferences.map((reference) => reference.label),
      selectedReferenceUrls: selectedReferences.map((reference) => reference.url),
      adapterProvider: character.adapter.provider,
      adapterEnabled: character.adapter.enabled,
      adapterWeight: character.adapter.weight,
      promptHints: [
        character.consistency.anchorFeatures.length
          ? `${character.name} anchor features: ${character.consistency.anchorFeatures.join(", ")}.`
          : `${character.name} appearance lock: ${character.appearance}.`,
        character.wardrobe ? `${character.name} wardrobe lock: ${character.wardrobe}.` : "",
        character.consistency.expressionDefaults.length
          ? `${character.name} expression baseline: ${character.consistency.expressionDefaults.join(", ")}.`
          : "",
        selectedReferences.length
          ? `${character.name} selected references: ${selectedReferences.map((reference) => reference.label).join(", ")}.`
          : ""
      ].filter(Boolean),
      negativeHints: [
        character.consistency.forbiddenDrift.length
          ? `Avoid ${character.name} drift: ${character.consistency.forbiddenDrift.join(", ")}.`
          : "",
        character.negativePrompt
      ].filter(Boolean),
      warnings: buildWarnings(panel, character, preferredRoles, selectedReferences)
    };
  });

  const score = characterPlans.length
    ? Math.round(characterPlans.reduce((sum, plan) => sum + plan.score, 0) / characterPlans.length)
    : 0;
  const readiness = resolveReadiness(score);
  const referenceCount = characterPlans.reduce(
    (sum, plan) => sum + plan.selectedReferenceIds.length,
    0
  );
  return {
    readiness,
    score,
    summary: characterPlans.length
      ? `${readiness.toUpperCase()} consistency for ${characterPlans
          .map((plan) => plan.characterName)
          .join(", ")} with ${referenceCount} active reference anchors.`
      : "No active character anchors for this panel yet.",
    globalHints: [
      characterPlans.length ? "Keep wardrobe and silhouette locked across adjacent panels." : "",
      panel.prompt.revisionIntent.preserveCharacterIdentity
        ? "Prioritize face identity over style drift during redraws."
        : "",
      referenceCount
        ? "Use shot-matched references instead of generic anchors whenever possible."
        : "Add shot-matched references to improve identity stability.",
      characterPlans.length
        ? "Do not change costume, eye color, or hair silhouette unless explicitly requested."
        : ""
    ].filter(Boolean),
    characterPlans
  };
}

export function buildConsistencyPreflight(plan: PanelConsistencyPlan): ConsistencyPreflight {
  const reasons = plan.characterPlans.flatMap((characterPlan) => characterPlan.warnings);
  const hasMissingReferences = reasons.some((reason) =>
    ["No reference images", "no active reference anchors", "no adapter references"].some((token) =>
      reason.toLowerCase().includes(token.toLowerCase())
    )
  );
  if (plan.characterPlans.length > 0 && hasMissingReferences) {
    return {
      status: "blocked",
      title: "Consistency anchors need attention",
      reasons
    };
  }
  if (plan.readiness !== "strong" || reasons.length) {
    return {
      status: "caution",
      title: "Consistency is usable but not locked yet",
      reasons
    };
  }
  return {
    status: "ready",
    title: "Consistency anchors look strong",
    reasons: plan.globalHints
  };
}

export function buildPanelContinuitySnapshot(
  panel: ComicPanel,
  characters: CharacterProfile[],
  plan: PanelConsistencyPlan = buildPanelConsistencyPlan(panel, characters)
): PanelContinuitySnapshot {
  const characterStates: CharacterContinuityState[] = plan.characterPlans.map((characterPlan) => ({
    characterId: characterPlan.characterId,
    characterName: characterPlan.characterName,
    expression:
      characterPlan.expressionCue ||
      characters.find((character) => character.id === characterPlan.characterId)?.consistency.expressionDefaults[0] ||
      "",
    wardrobe: characterPlan.wardrobeLock,
    poseCue:
      panel.prompt.revisionIntent.editPriority === "pose"
        ? panel.prompt.revisionIntent.changeInstructions
        : panel.prompt.prompt,
    framingCue: panel.prompt.shotType,
    carriedReferenceIds: characterPlan.selectedReferenceIds,
    notes: [characterPlan.anchorSummary, ...characterPlan.promptHints.slice(0, 1)].filter(Boolean).join(" | ")
  }));

  return {
    continuitySummary: [
      panel.prompt.sceneSummary || "Continue the same scene state.",
      panel.prompt.shotType ? `Shot: ${panel.prompt.shotType}` : "",
      characterStates.length
        ? `Carry ${characterStates.map((state) => `${state.characterName}(${state.expression || "neutral"})`).join(", ")}`
        : "",
      plan.summary
    ]
      .filter(Boolean)
      .join(" | "),
    sourcePrompt: panel.prompt.prompt,
    shotType: panel.prompt.shotType,
    sceneSummary: panel.prompt.sceneSummary,
    styleNotes: panel.prompt.styleNotes,
    characterStates
  };
}
