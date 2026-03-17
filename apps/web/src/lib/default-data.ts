import type { ComicPageTemplate, ComicProject } from "@archmanga/shared";

const templates: ComicPageTemplate[] = [
  {
    id: "template-classic",
    name: "Classic Page",
    panels: [
      { x: 48, y: 48, width: 504, height: 320, rotation: 0 },
      { x: 568, y: 48, width: 236, height: 320, rotation: 0 },
      { x: 48, y: 388, width: 356, height: 408, rotation: 0 },
      { x: 420, y: 388, width: 384, height: 180, rotation: 0 },
      { x: 420, y: 584, width: 384, height: 212, rotation: 0 }
    ]
  },
  {
    id: "template-cinematic",
    name: "Cinematic",
    panels: [
      { x: 48, y: 48, width: 756, height: 242, rotation: 0 },
      { x: 48, y: 308, width: 368, height: 488, rotation: 0 },
      { x: 432, y: 308, width: 372, height: 236, rotation: 0 },
      { x: 432, y: 560, width: 372, height: 236, rotation: 0 }
    ]
  },
  {
    id: "template-yonkoma",
    name: "4-koma",
    panels: [
      { x: 132, y: 48, width: 588, height: 168, rotation: 0 },
      { x: 132, y: 234, width: 588, height: 168, rotation: 0 },
      { x: 132, y: 420, width: 588, height: 168, rotation: 0 },
      { x: 132, y: 606, width: 588, height: 168, rotation: 0 }
    ]
  },
  {
    id: "template-webtoon",
    name: "Webtoon",
    panels: [
      { x: 96, y: 48, width: 660, height: 176, rotation: 0 },
      { x: 96, y: 256, width: 660, height: 212, rotation: 0 },
      { x: 96, y: 500, width: 660, height: 148, rotation: 0 },
      { x: 96, y: 680, width: 660, height: 116, rotation: 0 }
    ]
  }
];

const mangaWorkflowJson = {
  "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "sdxl-manga-ink" } },
  "2": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["1", 1] } },
  "3": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["1", 1] } },
  "4": { class_type: "EmptyLatentImage", inputs: { width: 1024, height: 1024, batch_size: 1 } },
  "5": {
    class_type: "KSampler",
    inputs: {
      seed: 0,
      steps: 28,
      cfg: 6.2,
      sampler_name: "euler",
      scheduler: "normal",
      denoise: 1
    }
  },
  "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
  "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "archmanga/manga" } },
  "8": { class_type: "IPAdapterApply", inputs: { image: "", weight: 0, model: ["1", 0] } }
};

const colorWorkflowJson = {
  "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "sdxl-anime-pro" } },
  "2": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["1", 1] } },
  "3": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["1", 1] } },
  "4": { class_type: "EmptyLatentImage", inputs: { width: 1152, height: 896, batch_size: 1 } },
  "5": {
    class_type: "KSampler",
    inputs: {
      seed: 0,
      steps: 32,
      cfg: 6.8,
      sampler_name: "dpmpp_2m",
      scheduler: "normal",
      denoise: 1
    }
  },
  "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
  "7": { class_type: "SaveImage", inputs: { images: ["6", 0], filename_prefix: "archmanga/color" } },
  "8": {
    class_type: "InstantIDApply",
    inputs: { image: "", weight_faceidv2: 0, model: ["1", 0] }
  }
};

export const defaultProject: ComicProject = {
  id: "project-arc-h",
  title: "Rain Alley Prototype",
  synopsis: "A moody cyber-drama built for panel-by-panel AI-assisted manga production.",
  templates,
  models: [
    {
      id: "sdxl-anime-pro",
      label: "SDXL Anime Pro",
      family: "sdxl",
      kind: "checkpoint",
      tags: ["color", "character", "cinematic"]
    },
    {
      id: "sdxl-manga-ink",
      label: "SDXL Manga Ink",
      family: "sdxl",
      kind: "checkpoint",
      tags: ["bw", "screen-tone", "lineart"]
    },
    {
      id: "lora-rain-neon",
      label: "Rain Neon LoRA",
      family: "sdxl",
      kind: "lora",
      tags: ["atmosphere", "night", "city"]
    }
  ],
  workflows: [
    {
      id: "wf-bw-panel",
      name: "Manga BW Panel",
      description: "SDXL lineart workflow with screen tone cleanup and inpaint-ready output.",
      mode: "bw",
      modelFamily: "sdxl",
      promptPrefix: "high-contrast manga panel, clean ink lines, dramatic composition",
      controls: ["ip-adapter", "controlnet-canny", "inpaint"],
      templateKey: "sdxl_manga",
      parameters: [
        { key: "steps", label: "Steps", type: "number", defaultValue: 28 },
        { key: "cfg", label: "CFG", type: "number", defaultValue: 6.2 },
        {
          key: "sampler",
          label: "Sampler",
          type: "select",
          defaultValue: "euler",
          options: ["euler", "dpmpp_2m", "dpmpp_sde"]
        }
      ],
      nodeBindings: [
        { id: "bind-model-bw", nodeId: "1", inputName: "ckpt_name", source: "model" },
        { id: "bind-pos-bw", nodeId: "2", inputName: "text", source: "positive_prompt" },
        { id: "bind-neg-bw", nodeId: "3", inputName: "text", source: "negative_prompt" },
        { id: "bind-width-bw", nodeId: "4", inputName: "width", source: "width" },
        { id: "bind-height-bw", nodeId: "4", inputName: "height", source: "height" },
        { id: "bind-steps-bw", nodeId: "5", inputName: "steps", source: "steps" },
        { id: "bind-cfg-bw", nodeId: "5", inputName: "cfg", source: "cfg" },
        { id: "bind-sampler-bw", nodeId: "5", inputName: "sampler_name", source: "sampler" },
        { id: "bind-scheduler-bw", nodeId: "5", inputName: "scheduler", source: "scheduler" },
        { id: "bind-seed-bw", nodeId: "5", inputName: "seed", source: "seed" },
        {
          id: "bind-adapter-image-bw",
          nodeId: "8",
          inputName: "image",
          source: "reference_image_url",
          provider: "ip-adapter",
          characterIndex: 0,
          label: "Primary character reference"
        },
        {
          id: "bind-adapter-weight-bw",
          nodeId: "8",
          inputName: "weight",
          source: "adapter_weight",
          provider: "ip-adapter",
          characterIndex: 0,
          label: "Primary adapter weight"
        }
      ],
      workflowJson: mangaWorkflowJson
    },
    {
      id: "wf-color-panel",
      name: "Color Story Panel",
      description: "SDXL color workflow with cinematic lighting and reference image support.",
      mode: "color",
      modelFamily: "sdxl",
      promptPrefix: "polished anime illustration, cinematic lighting, crisp focal character",
      controls: ["ip-adapter", "controlnet-depth", "img2img"],
      templateKey: "sdxl_color_story",
      parameters: [
        { key: "steps", label: "Steps", type: "number", defaultValue: 32 },
        { key: "cfg", label: "CFG", type: "number", defaultValue: 6.8 },
        {
          key: "sampler",
          label: "Sampler",
          type: "select",
          defaultValue: "dpmpp_2m",
          options: ["euler", "dpmpp_2m", "dpmpp_sde"]
        }
      ],
      nodeBindings: [
        { id: "bind-model-color", nodeId: "1", inputName: "ckpt_name", source: "model" },
        { id: "bind-pos-color", nodeId: "2", inputName: "text", source: "positive_prompt" },
        { id: "bind-neg-color", nodeId: "3", inputName: "text", source: "negative_prompt" },
        { id: "bind-width-color", nodeId: "4", inputName: "width", source: "width" },
        { id: "bind-height-color", nodeId: "4", inputName: "height", source: "height" },
        { id: "bind-steps-color", nodeId: "5", inputName: "steps", source: "steps" },
        { id: "bind-cfg-color", nodeId: "5", inputName: "cfg", source: "cfg" },
        { id: "bind-sampler-color", nodeId: "5", inputName: "sampler_name", source: "sampler" },
        { id: "bind-scheduler-color", nodeId: "5", inputName: "scheduler", source: "scheduler" },
        { id: "bind-seed-color", nodeId: "5", inputName: "seed", source: "seed" },
        {
          id: "bind-adapter-image-color",
          nodeId: "8",
          inputName: "image",
          source: "reference_image_url",
          provider: "instantid",
          characterIndex: 0,
          label: "Primary character reference"
        },
        {
          id: "bind-adapter-weight-color",
          nodeId: "8",
          inputName: "weight_faceidv2",
          source: "adapter_weight",
          provider: "instantid",
          characterIndex: 0,
          label: "Primary adapter weight"
        }
      ],
      workflowJson: colorWorkflowJson
    }
  ],
  characters: [
    {
      id: "char-rin",
      name: "Rin",
      appearance: "short silver hair, tired amber eyes, slim build, soft jawline",
      wardrobe: "oversized black coat, white shirt, dark slacks, rain droplets on fabric",
      personality: "guarded, observant, emotionally restrained",
      negativePrompt: "extra limbs, wrong hairstyle, bright cheerful smile, child proportions",
      referenceNotes: "Keep the coat silhouette consistent and avoid changing eye color.",
      references: [
        {
          id: "ref-rin-front",
          label: "Front portrait",
          url: "https://example.invalid/rin-front.png",
          angle: "front",
          notes: "Best anchor for hair shape and eye color."
        },
        {
          id: "ref-rin-full",
          label: "Full body",
          url: "https://example.invalid/rin-full.png",
          angle: "full-body",
          notes: "Use for coat silhouette and body proportions."
        }
      ],
      consistency: {
        anchorFeatures: ["silver bob cut", "amber eyes", "oversized black coat"],
        forbiddenDrift: ["blue eyes", "long hair", "cheerful idol styling"],
        paletteHints: ["graphite", "off-white", "rain sheen"],
        expressionDefaults: ["guarded", "tired", "quietly tense"],
        bodyShape: "slim and understated"
      },
      adapter: {
        provider: "ip-adapter",
        enabled: true,
        weight: 0.72,
        referenceImageIds: ["ref-rin-front", "ref-rin-full"]
      }
    },
    {
      id: "char-kai",
      name: "Kai",
      appearance: "dark undercut, rectangular glasses, tall frame, composed posture",
      wardrobe: "olive utility jacket, messenger bag, rolled sleeves",
      personality: "analytical, calm, dry sense of humor",
      negativePrompt: "fantasy armor, long hair, muscular bodybuilder silhouette",
      referenceNotes: "Glasses and messenger bag are the strongest identity anchors.",
      references: [
        {
          id: "ref-kai-front",
          label: "Front portrait",
          url: "https://example.invalid/kai-front.png",
          angle: "front",
          notes: "Primary glasses and facial proportion reference."
        }
      ],
      consistency: {
        anchorFeatures: ["rectangular glasses", "dark undercut", "olive jacket"],
        forbiddenDrift: ["round glasses", "long fringe", "heroic fantasy styling"],
        paletteHints: ["olive", "smoke gray", "paper beige"],
        expressionDefaults: ["calm", "dry amusement", "focused"],
        bodyShape: "tall and lean"
      },
      adapter: {
        provider: "instantid",
        enabled: true,
        weight: 0.68,
        referenceImageIds: ["ref-kai-front"]
      }
    }
  ],
  sceneMemories: [
    {
      id: "scene-rain-alley",
      location: "Neon alley outside a convenience store",
      timeOfDay: "late night",
      weather: "steady rain",
      lighting: "cyan and amber reflections on wet asphalt",
      mood: "tense and emotionally distant",
      continuityNotes: "Keep storefront signage blurred and avoid crowding the background."
    }
  ],
  pages: [
    {
      id: "page-01",
      title: "Page 01",
      width: 852,
      height: 1200,
      panels: templates[0].panels.map((panel, index) => ({
        id: `panel-${index + 1}`,
        title: `Panel ${index + 1}`,
        ...panel,
        mode: index < 3 ? "bw" : "color",
        modelId: index < 3 ? "sdxl-manga-ink" : "sdxl-anime-pro",
        workflowPresetId: index < 3 ? "wf-bw-panel" : "wf-color-panel",
        characterIds: index === 0 ? ["char-rin"] : ["char-rin", "char-kai"],
        sceneMemoryId: "scene-rain-alley",
        latestJobStatus: index === 0 ? "complete" : "idle",
        prompt: {
          prompt:
            index === 0
              ? "Rin stands in the rain outside a convenience store, shoulder-up shot, quiet tension"
              : "Continue the alley scene with controlled pacing and keep character silhouettes stable",
          negativePrompt: "muddy anatomy, extra fingers, inconsistent costume details",
          sceneSummary: "Rainy neon alley at night, reflective asphalt, emotional distance",
          shotType: index === 0 ? "close-up" : "medium shot",
          styleNotes: index < 3 ? "manga screentone, stark blacks" : "wet neon highlights, muted palette"
        },
        generation: {
          width: Math.round(panel.width),
          height: Math.round(panel.height),
          seed: 8745123 + index,
          steps: index < 3 ? 28 : 32,
          cfg: index < 3 ? 6.2 : 6.8,
          sampler: index < 3 ? "euler" : "dpmpp_2m",
          scheduler: "normal",
          denoise: 1
        }
      }))
    }
  ]
};
