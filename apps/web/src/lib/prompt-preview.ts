import type { CharacterProfile, ComicPanel, WorkflowPreset } from "@archmanga/shared";

export function buildPromptPreview(
  panel: ComicPanel,
  workflow: WorkflowPreset | undefined,
  characters: CharacterProfile[]
) {
  const characterLine = characters
    .map(
      (character) =>
        `${character.name}: ${character.appearance}; ${character.wardrobe}; anchors=${character.consistency.anchorFeatures.join("/")}`
    )
    .join(" | ");

  const continuityHints = [
    panel.prompt.sceneSummary || "Carry over location, weather, and emotional tone from prior panel.",
    panel.prompt.shotType ? `Preferred shot: ${panel.prompt.shotType}` : "",
    panel.prompt.styleNotes ? `Style anchor: ${panel.prompt.styleNotes}` : "",
    characters.length > 0
      ? `Keep identity stable for ${characters.map((item) => item.name).join(", ")} and avoid ${characters
          .flatMap((item) => item.consistency.forbiddenDrift)
          .join(", ")}.`
      : ""
  ].filter(Boolean);

  const optimizedPrompt = [
    workflow?.promptPrefix,
    panel.prompt.prompt,
    characterLine ? `Character anchors: ${characterLine}` : "",
    continuityHints.join(" "),
    "Preserve manga readability and maintain clean silhouette separation between foreground and background."
  ]
    .filter(Boolean)
    .join(", ");

  return {
    userPrompt: panel.prompt.prompt,
    optimizedPrompt,
    continuityHints,
    sceneState: panel.prompt.sceneSummary || "No scene summary yet."
  };
}
