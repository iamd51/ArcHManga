import type { ComicPanel, QuickRepairRecipeId, RevisionIntent } from "@archmanga/shared";
import { applyMaskPreset, type MaskPresetId } from "@/lib/mask-presets";

export type { QuickRepairRecipeId } from "@archmanga/shared";

export interface QuickRepairRecipe {
  id: QuickRepairRecipeId;
  label: string;
  ctaLabel: string;
  revisionIntent: {
    preserveComposition: boolean;
    preserveBackground: boolean;
    preserveCharacterIdentity: boolean;
    lockCharacterAppearance: boolean;
    lockCharacterWardrobe: boolean;
    lockCharacterExpression: boolean;
    lockCameraFraming: boolean;
    editPriority: "expression" | "pose" | "camera" | "lighting";
    changeInstructions: string;
  };
  maskPreset: MaskPresetId;
}

export const QUICK_REPAIR_RECIPES: Record<QuickRepairRecipeId, QuickRepairRecipe> = {
  "expression-fix": {
    id: "expression-fix",
    label: "Expression fix",
    ctaLabel: "Expr + generate",
    revisionIntent: {
      preserveComposition: true,
      preserveBackground: true,
      preserveCharacterIdentity: true,
      lockCharacterAppearance: true,
      lockCharacterWardrobe: true,
      lockCharacterExpression: false,
      lockCameraFraming: true,
      editPriority: "expression",
      changeInstructions: "Refine the expression while keeping the existing staging."
    },
    maskPreset: "face-focus"
  },
  "pose-cleanup": {
    id: "pose-cleanup",
    label: "Pose cleanup",
    ctaLabel: "Pose + generate",
    revisionIntent: {
      preserveComposition: false,
      preserveBackground: true,
      preserveCharacterIdentity: true,
      lockCharacterAppearance: true,
      lockCharacterWardrobe: true,
      lockCharacterExpression: false,
      lockCameraFraming: false,
      editPriority: "pose",
      changeInstructions: "Adjust the pose and upper-body acting without drifting identity."
    },
    maskPreset: "half-body"
  },
  "camera-restage": {
    id: "camera-restage",
    label: "Camera restage",
    ctaLabel: "Camera + generate",
    revisionIntent: {
      preserveComposition: false,
      preserveBackground: false,
      preserveCharacterIdentity: true,
      lockCharacterAppearance: true,
      lockCharacterWardrobe: true,
      lockCharacterExpression: false,
      lockCameraFraming: false,
      editPriority: "camera",
      changeInstructions: "Change the framing while keeping the cast recognizable."
    },
    maskPreset: "full-figure"
  },
  "lighting-polish": {
    id: "lighting-polish",
    label: "Lighting polish",
    ctaLabel: "Light + generate",
    revisionIntent: {
      preserveComposition: true,
      preserveBackground: true,
      preserveCharacterIdentity: true,
      lockCharacterAppearance: true,
      lockCharacterWardrobe: true,
      lockCharacterExpression: true,
      lockCameraFraming: true,
      editPriority: "lighting",
      changeInstructions: "Polish lighting and atmosphere without changing acting."
    },
    maskPreset: "panel-center"
  }
};

export function applyQuickRepairRecipe(
  panel: ComicPanel,
  recipeId: QuickRepairRecipeId
) {
  const recipe = QUICK_REPAIR_RECIPES[recipeId];
  const nextRevisionIntent = {
    ...panel.prompt.revisionIntent,
    ...recipe.revisionIntent
  };
  const nextInpaintMask = panel.imageUrl
    ? applyMaskPreset(panel, recipe.maskPreset, {
        shotType: panel.prompt.shotType,
        prompt: panel.prompt.prompt
      })
    : panel.inpaintMask;

  return {
    recipe,
    panel: {
      ...panel,
      inpaintMask: nextInpaintMask,
      prompt: {
        ...panel.prompt,
        revisionIntent: nextRevisionIntent
      }
    }
  };
}

export function inferQuickRepairRecipe(
  revisionIntent: RevisionIntent | undefined
): QuickRepairRecipeId | null {
  if (!revisionIntent) {
    return null;
  }
  if (revisionIntent.editPriority === "expression") {
    return "expression-fix";
  }
  if (revisionIntent.editPriority === "pose") {
    return "pose-cleanup";
  }
  if (revisionIntent.editPriority === "camera") {
    return "camera-restage";
  }
  if (revisionIntent.editPriority === "lighting") {
    return "lighting-polish";
  }
  return null;
}
