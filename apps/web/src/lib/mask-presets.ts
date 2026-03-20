import type { ComicPanel, InpaintMask, RevisionIntent } from "@archmanga/shared";

export type MaskPresetId =
  | "face-focus"
  | "half-body"
  | "full-figure"
  | "panel-center"
  | "prop-detail";

export interface MaskPreset {
  id: MaskPresetId;
  label: string;
  description: string;
  mask: InpaintMask;
}

interface MaskPresetContext {
  shotType?: string;
  prompt?: string;
  targetSlots?: number[];
  targetCount?: number;
}

export const MASK_PRESETS: MaskPreset[] = [
  {
    id: "face-focus",
    label: "Face Focus",
    description: "Useful for expression, gaze, and small face adjustments.",
    mask: { enabled: true, x: 0.28, y: 0.12, width: 0.44, height: 0.32, feather: 24 }
  },
  {
    id: "half-body",
    label: "Half Body",
    description: "Good for pose tweaks, upper body gestures, and dialogue beats.",
    mask: { enabled: true, x: 0.18, y: 0.12, width: 0.64, height: 0.72, feather: 24 }
  },
  {
    id: "full-figure",
    label: "Full Figure",
    description: "Broader redraw zone for bigger camera or pose changes.",
    mask: { enabled: true, x: 0.1, y: 0.08, width: 0.8, height: 0.82, feather: 28 }
  },
  {
    id: "panel-center",
    label: "Panel Center",
    description: "Balanced mask for lighting and general center-frame updates.",
    mask: { enabled: true, x: 0.18, y: 0.16, width: 0.64, height: 0.56, feather: 26 }
  },
  {
    id: "prop-detail",
    label: "Detail Spot",
    description: "Small localized area for hands, props, and object fixes.",
    mask: { enabled: true, x: 0.36, y: 0.34, width: 0.24, height: 0.22, feather: 18 }
  }
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function applyContextToMask(mask: InpaintMask, context?: MaskPresetContext): InpaintMask {
  if (!context) {
    return mask;
  }

  const shotType = (context.shotType ?? "").toLowerCase();
  const prompt = (context.prompt ?? "").toLowerCase();
  let nextMask = { ...mask };
  let hasExplicitHorizontalCue = false;

  if (shotType.includes("close") || shotType.includes("reaction")) {
    nextMask = {
      ...nextMask,
      y: clamp(nextMask.y - 0.05, 0.04, 0.7),
      height: clamp(nextMask.height - 0.06, 0.18, 0.8)
    };
  } else if (shotType.includes("wide")) {
    nextMask = {
      ...nextMask,
      x: clamp(nextMask.x - 0.08, 0.04, 0.7),
      width: clamp(nextMask.width + 0.14, 0.2, 0.9),
      height: clamp(nextMask.height + 0.08, 0.2, 0.9)
    };
  } else if (shotType.includes("medium")) {
    nextMask = {
      ...nextMask,
      y: clamp(nextMask.y + 0.02, 0.04, 0.72)
    };
  }

  if (
    prompt.includes("left") ||
    prompt.includes("左") ||
    prompt.includes("畫面左") ||
    prompt.includes("左側")
  ) {
    hasExplicitHorizontalCue = true;
    nextMask = {
      ...nextMask,
      x: clamp(0.12, 0.04, 0.76 - nextMask.width)
    };
  } else if (
    prompt.includes("right") ||
    prompt.includes("右") ||
    prompt.includes("畫面右") ||
    prompt.includes("右側")
  ) {
    hasExplicitHorizontalCue = true;
    nextMask = {
      ...nextMask,
      x: clamp(0.88 - nextMask.width, 0.04, 0.76)
    };
  } else if (prompt.includes("center") || prompt.includes("中央") || prompt.includes("中間")) {
    hasExplicitHorizontalCue = true;
    nextMask = {
      ...nextMask,
      x: clamp((1 - nextMask.width) / 2, 0.04, 0.76),
      y: clamp(nextMask.y, 0.04, 0.76)
    };
  }

  if (
    !hasExplicitHorizontalCue &&
    context.targetSlots?.length &&
    (context.targetCount ?? 0) > 1
  ) {
    const usableSlots = context.targetSlots.filter((slot) => slot >= 0);
    if (usableSlots.length) {
      const maxIndex = Math.max((context.targetCount ?? 1) - 1, 1);
      const averageSlot = usableSlots.reduce((total, slot) => total + slot, 0) / usableSlots.length;
      const horizontalRatio = averageSlot / maxIndex;
      nextMask = {
        ...nextMask,
        x: clamp(0.08 + horizontalRatio * (0.84 - nextMask.width), 0.04, 0.96 - nextMask.width)
      };
    }
  }

  return nextMask;
}

export function applyMaskPreset(
  panel: Pick<ComicPanel, "inpaintMask">,
  presetId: MaskPresetId,
  context?: MaskPresetContext
): InpaintMask {
  const preset = MASK_PRESETS.find((item) => item.id === presetId) ?? MASK_PRESETS[0];
  return applyContextToMask(
    {
      ...panel.inpaintMask,
      ...preset.mask,
      feather: Math.max(panel.inpaintMask.feather, preset.mask.feather)
    },
    context
  );
}

export function suggestContextualMask(
  panel: Pick<ComicPanel, "imageUrl" | "inpaintMask"> | null,
  revisionIntent: RevisionIntent,
  context?: MaskPresetContext
) {
  const presetId = suggestMaskPreset(panel, revisionIntent);
  if (!presetId || !panel) {
    return null;
  }

  const preset = getMaskPresetById(presetId);
  if (!preset) {
    return null;
  }

  return {
    preset,
    mask: applyMaskPreset(panel, presetId, context)
  };
}

export function suggestMaskPreset(
  panel: Pick<ComicPanel, "imageUrl" | "inpaintMask"> | null,
  revisionIntent: RevisionIntent
): MaskPresetId | null {
  if (!panel?.imageUrl) {
    return null;
  }

  const notes = revisionIntent.changeInstructions.toLowerCase();
  if (
    notes.includes("手") ||
    notes.includes("道具") ||
    notes.includes("物件") ||
    notes.includes("hand") ||
    notes.includes("prop") ||
    notes.includes("object")
  ) {
    return "prop-detail";
  }
  if (revisionIntent.editPriority === "expression") {
    return "face-focus";
  }
  if (revisionIntent.editPriority === "pose") {
    return "half-body";
  }
  if (revisionIntent.editPriority === "camera") {
    return "full-figure";
  }
  if (revisionIntent.editPriority === "lighting") {
    return "panel-center";
  }
  if (revisionIntent.preserveBackground) {
    return "half-body";
  }
  return "panel-center";
}

export function getMaskPresetById(presetId: MaskPresetId | null | undefined) {
  return MASK_PRESETS.find((item) => item.id === presetId) ?? null;
}
