from app.schemas.comic import (
    CharacterConsistencyAdapter,
    CharacterProfile,
    CharacterReferenceImage,
    ComicPage,
    ComicPageTemplate,
    ComicPanel,
    ComicProject,
    ConsistencyProfile,
    GenerationSettings,
    InpaintMask,
    ModelOption,
    PanelPromptSettings,
    RevisionIntent,
    SceneMemory,
    WorkflowNodeBinding,
    WorkflowParameter,
    WorkflowPreset,
)


def get_mock_templates() -> list[ComicPageTemplate]:
    return [
        ComicPageTemplate(
            id="template-classic",
            name="Classic Page",
            panels=[
                {"x": 48, "y": 48, "width": 504, "height": 320, "rotation": 0},
                {"x": 568, "y": 48, "width": 236, "height": 320, "rotation": 0},
                {"x": 48, "y": 388, "width": 356, "height": 408, "rotation": 0},
                {"x": 420, "y": 388, "width": 384, "height": 180, "rotation": 0},
                {"x": 420, "y": 584, "width": 384, "height": 212, "rotation": 0},
            ],
        ),
        ComicPageTemplate(
            id="template-cinematic",
            name="Cinematic",
            panels=[
                {"x": 48, "y": 48, "width": 756, "height": 242, "rotation": 0},
                {"x": 48, "y": 308, "width": 368, "height": 488, "rotation": 0},
                {"x": 432, "y": 308, "width": 372, "height": 236, "rotation": 0},
                {"x": 432, "y": 560, "width": 372, "height": 236, "rotation": 0},
            ],
        ),
    ]


def get_mock_models() -> list[ModelOption]:
    return [
        ModelOption(
            id="sdxl-anime-pro",
            label="SDXL Anime Pro",
            kind="checkpoint",
            tags=["color", "character", "cinematic"],
        ),
        ModelOption(
            id="sdxl-manga-ink",
            label="SDXL Manga Ink",
            kind="checkpoint",
            tags=["bw", "lineart", "screen-tone"],
        ),
        ModelOption(
            id="lora-rain-neon",
            label="Rain Neon LoRA",
            kind="lora",
            tags=["atmosphere", "night", "city"],
        ),
    ]


def _workflow_bindings(
    adapter_node_ids: tuple[str, str, str],
    adapter_provider: str,
    weight_input_name: str,
) -> list[WorkflowNodeBinding]:
    face_node_id, body_node_id, outfit_node_id = adapter_node_ids
    return [
        WorkflowNodeBinding(id="bind-model", node_id="1", input_name="ckpt_name", source="model"),
        WorkflowNodeBinding(id="bind-positive", node_id="2", input_name="text", source="positive_prompt"),
        WorkflowNodeBinding(id="bind-negative", node_id="3", input_name="text", source="negative_prompt"),
        WorkflowNodeBinding(id="bind-width", node_id="4", input_name="width", source="width"),
        WorkflowNodeBinding(id="bind-height", node_id="4", input_name="height", source="height"),
        WorkflowNodeBinding(id="bind-denoise", node_id="5", input_name="denoise", source="denoise"),
        WorkflowNodeBinding(id="bind-steps", node_id="5", input_name="steps", source="steps"),
        WorkflowNodeBinding(id="bind-cfg", node_id="5", input_name="cfg", source="cfg"),
        WorkflowNodeBinding(id="bind-sampler", node_id="5", input_name="sampler_name", source="sampler"),
        WorkflowNodeBinding(id="bind-scheduler", node_id="5", input_name="scheduler", source="scheduler"),
        WorkflowNodeBinding(id="bind-seed", node_id="5", input_name="seed", source="seed"),
        WorkflowNodeBinding(
            id="bind-adapter-face-image",
            node_id=face_node_id,
            input_name="image",
            source="face_reference_image_url",
            provider=adapter_provider,
            character_index=0,
            label="Face reference",
        ),
        WorkflowNodeBinding(
            id="bind-adapter-face-weight",
            node_id=face_node_id,
            input_name=weight_input_name,
            source="adapter_weight",
            provider=adapter_provider,
            character_index=0,
            label="Face adapter weight",
        ),
        WorkflowNodeBinding(
            id="bind-adapter-body-image",
            node_id=body_node_id,
            input_name="image",
            source="full_body_reference_image_url",
            provider=adapter_provider,
            character_index=0,
            label="Full body reference",
        ),
        WorkflowNodeBinding(
            id="bind-adapter-body-weight",
            node_id=body_node_id,
            input_name=weight_input_name,
            source="adapter_weight",
            provider=adapter_provider,
            character_index=0,
            label="Body adapter weight",
        ),
        WorkflowNodeBinding(
            id="bind-adapter-outfit-image",
            node_id=outfit_node_id,
            input_name="image",
            source="outfit_reference_image_url",
            provider=adapter_provider,
            character_index=0,
            label="Outfit reference",
        ),
        WorkflowNodeBinding(
            id="bind-adapter-outfit-weight",
            node_id=outfit_node_id,
            input_name=weight_input_name,
            source="adapter_weight",
            provider=adapter_provider,
            character_index=0,
            label="Outfit adapter weight",
        ),
    ]


def _regeneration_workflow_bindings(
    adapter_node_ids: tuple[str, str, str],
    adapter_provider: str,
    weight_input_name: str,
) -> list[WorkflowNodeBinding]:
    face_node_id, body_node_id, outfit_node_id = adapter_node_ids
    return [
        WorkflowNodeBinding(id="bind-model", node_id="1", input_name="ckpt_name", source="model"),
        WorkflowNodeBinding(id="bind-positive", node_id="2", input_name="text", source="positive_prompt"),
        WorkflowNodeBinding(id="bind-negative", node_id="3", input_name="text", source="negative_prompt"),
        WorkflowNodeBinding(id="bind-source-image", node_id="4", input_name="image", source="source_image_url"),
        WorkflowNodeBinding(id="bind-mask-image", node_id="6", input_name="image", source="mask_image_url"),
        WorkflowNodeBinding(id="bind-denoise", node_id="8", input_name="denoise", source="denoise"),
        WorkflowNodeBinding(id="bind-steps", node_id="8", input_name="steps", source="steps"),
        WorkflowNodeBinding(id="bind-cfg", node_id="8", input_name="cfg", source="cfg"),
        WorkflowNodeBinding(id="bind-sampler", node_id="8", input_name="sampler_name", source="sampler"),
        WorkflowNodeBinding(id="bind-scheduler", node_id="8", input_name="scheduler", source="scheduler"),
        WorkflowNodeBinding(id="bind-seed", node_id="8", input_name="seed", source="seed"),
        WorkflowNodeBinding(
            id="bind-adapter-face-image",
            node_id=face_node_id,
            input_name="image",
            source="face_reference_image_url",
            provider=adapter_provider,
            character_index=0,
            label="Face reference",
        ),
        WorkflowNodeBinding(
            id="bind-adapter-face-weight",
            node_id=face_node_id,
            input_name=weight_input_name,
            source="adapter_weight",
            provider=adapter_provider,
            character_index=0,
            label="Face adapter weight",
        ),
        WorkflowNodeBinding(
            id="bind-adapter-body-image",
            node_id=body_node_id,
            input_name="image",
            source="full_body_reference_image_url",
            provider=adapter_provider,
            character_index=0,
            label="Full body reference",
        ),
        WorkflowNodeBinding(
            id="bind-adapter-body-weight",
            node_id=body_node_id,
            input_name=weight_input_name,
            source="adapter_weight",
            provider=adapter_provider,
            character_index=0,
            label="Body adapter weight",
        ),
        WorkflowNodeBinding(
            id="bind-adapter-outfit-image",
            node_id=outfit_node_id,
            input_name="image",
            source="outfit_reference_image_url",
            provider=adapter_provider,
            character_index=0,
            label="Outfit reference",
        ),
        WorkflowNodeBinding(
            id="bind-adapter-outfit-weight",
            node_id=outfit_node_id,
            input_name=weight_input_name,
            source="adapter_weight",
            provider=adapter_provider,
            character_index=0,
            label="Outfit adapter weight",
        ),
    ]


def _manga_workflow_json() -> dict:
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "sdxl-manga-ink"}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["1", 1]}},
        "4": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 1024, "height": 1024, "batch_size": 1},
        },
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "seed": 0,
                "steps": 28,
                "cfg": 6.2,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1,
                "model": ["10", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["4", 0],
            },
        },
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {
            "class_type": "SaveImage",
            "inputs": {"images": ["6", 0], "filename_prefix": "archmanga/manga"},
        },
        "8": {
            "class_type": "IPAdapterApply",
            "inputs": {"image": "", "weight": 0.0, "model": ["1", 0]},
        },
        "9": {
            "class_type": "IPAdapterApply",
            "inputs": {"image": "", "weight": 0.0, "model": ["8", 0]},
        },
        "10": {
            "class_type": "IPAdapterApply",
            "inputs": {"image": "", "weight": 0.0, "model": ["9", 0]},
        },
    }


def _color_workflow_json() -> dict:
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "sdxl-anime-pro"}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["1", 1]}},
        "4": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": 1152, "height": 896, "batch_size": 1},
        },
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "seed": 0,
                "steps": 32,
                "cfg": 6.8,
                "sampler_name": "dpmpp_2m",
                "scheduler": "normal",
                "denoise": 1,
                "model": ["10", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["4", 0],
            },
        },
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {
            "class_type": "SaveImage",
            "inputs": {"images": ["6", 0], "filename_prefix": "archmanga/color"},
        },
        "8": {
            "class_type": "InstantIDApply",
            "inputs": {"image": "", "weight_faceidv2": 0.0, "model": ["1", 0]},
        },
        "9": {
            "class_type": "InstantIDApply",
            "inputs": {"image": "", "weight_faceidv2": 0.0, "model": ["8", 0]},
        },
        "10": {
            "class_type": "InstantIDApply",
            "inputs": {"image": "", "weight_faceidv2": 0.0, "model": ["9", 0]},
        },
    }


def _manga_regeneration_workflow_json() -> dict:
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "sdxl-manga-ink"}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["1", 1]}},
        "4": {"class_type": "LoadImage", "inputs": {"image": ""}},
        "5": {"class_type": "VAEEncode", "inputs": {"pixels": ["4", 0], "vae": ["1", 2]}},
        "6": {"class_type": "LoadImageMask", "inputs": {"image": ""}},
        "7": {"class_type": "SetLatentNoiseMask", "inputs": {"samples": ["5", 0], "mask": ["6", 0]}},
        "8": {
            "class_type": "KSampler",
            "inputs": {
                "seed": 0,
                "steps": 24,
                "cfg": 5.8,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 0.28,
                "model": ["12", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["7", 0],
            },
        },
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["8", 0], "vae": ["1", 2]}},
        "10": {"class_type": "IPAdapterApply", "inputs": {"image": "", "weight": 0.0, "model": ["1", 0]}},
        "11": {"class_type": "IPAdapterApply", "inputs": {"image": "", "weight": 0.0, "model": ["10", 0]}},
        "12": {"class_type": "IPAdapterApply", "inputs": {"image": "", "weight": 0.0, "model": ["11", 0]}},
        "13": {
            "class_type": "SaveImage",
            "inputs": {"images": ["9", 0], "filename_prefix": "archmanga/manga-regen"},
        },
    }


def _color_regeneration_workflow_json() -> dict:
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "sdxl-anime-pro"}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["1", 1]}},
        "4": {"class_type": "LoadImage", "inputs": {"image": ""}},
        "5": {"class_type": "VAEEncode", "inputs": {"pixels": ["4", 0], "vae": ["1", 2]}},
        "6": {"class_type": "LoadImageMask", "inputs": {"image": ""}},
        "7": {"class_type": "SetLatentNoiseMask", "inputs": {"samples": ["5", 0], "mask": ["6", 0]}},
        "8": {
            "class_type": "KSampler",
            "inputs": {
                "seed": 0,
                "steps": 28,
                "cfg": 6.4,
                "sampler_name": "dpmpp_2m",
                "scheduler": "normal",
                "denoise": 0.34,
                "model": ["12", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["7", 0],
            },
        },
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["8", 0], "vae": ["1", 2]}},
        "10": {
            "class_type": "InstantIDApply",
            "inputs": {"image": "", "weight_faceidv2": 0.0, "model": ["1", 0]},
        },
        "11": {
            "class_type": "InstantIDApply",
            "inputs": {"image": "", "weight_faceidv2": 0.0, "model": ["10", 0]},
        },
        "12": {
            "class_type": "InstantIDApply",
            "inputs": {"image": "", "weight_faceidv2": 0.0, "model": ["11", 0]},
        },
        "13": {
            "class_type": "SaveImage",
            "inputs": {"images": ["9", 0], "filename_prefix": "archmanga/color-regen"},
        },
    }


def get_mock_workflows() -> list[WorkflowPreset]:
    return [
        WorkflowPreset(
            id="wf-bw-panel",
            name="Manga BW Panel",
            description="SDXL black-and-white manga pipeline",
            mode="bw",
            prompt_prefix="high-contrast manga panel, clean ink lines, controlled screentone",
            controls=["ip-adapter", "controlnet-canny", "inpaint"],
            template_key="sdxl_manga",
            parameters=[
                WorkflowParameter(key="steps", label="Steps", type="number", default_value=28),
                WorkflowParameter(key="cfg", label="CFG", type="number", default_value=6.2),
                WorkflowParameter(
                    key="sampler",
                    label="Sampler",
                    type="select",
                    default_value="euler",
                    options=["euler", "dpmpp_2m", "dpmpp_sde"],
                ),
            ],
            node_bindings=_workflow_bindings(("8", "9", "10"), "ip-adapter", "weight"),
            workflow_json=_manga_workflow_json(),
        ),
        WorkflowPreset(
            id="wf-color-panel",
            name="Color Story Panel",
            description="SDXL cinematic color pipeline",
            mode="color",
            prompt_prefix="polished anime illustration, cinematic lighting, clean focal separation",
            controls=["ip-adapter", "controlnet-depth", "img2img"],
            template_key="sdxl_color_story",
            parameters=[
                WorkflowParameter(key="steps", label="Steps", type="number", default_value=32),
                WorkflowParameter(key="cfg", label="CFG", type="number", default_value=6.8),
                WorkflowParameter(
                    key="sampler",
                    label="Sampler",
                    type="select",
                    default_value="dpmpp_2m",
                    options=["euler", "dpmpp_2m", "dpmpp_sde"],
                ),
            ],
            node_bindings=_workflow_bindings(("8", "9", "10"), "instantid", "weight_faceidv2"),
            workflow_json=_color_workflow_json(),
        ),
        WorkflowPreset(
            id="wf-bw-regen",
            name="Manga BW Regeneration",
            description="SDXL black-and-white regeneration pipeline for iterative redraws",
            mode="bw",
            prompt_prefix="high-contrast manga redraw, preserve the existing staging",
            controls=["img2img", "ip-adapter", "inpaint"],
            template_key="sdxl_manga_regen",
            parameters=[
                WorkflowParameter(key="steps", label="Steps", type="number", default_value=24),
                WorkflowParameter(key="cfg", label="CFG", type="number", default_value=5.8),
                WorkflowParameter(
                    key="sampler",
                    label="Sampler",
                    type="select",
                    default_value="euler",
                    options=["euler", "dpmpp_2m", "dpmpp_sde"],
                ),
            ],
            node_bindings=_regeneration_workflow_bindings(("10", "11", "12"), "ip-adapter", "weight"),
            workflow_json=_manga_regeneration_workflow_json(),
        ),
        WorkflowPreset(
            id="wf-color-regen",
            name="Color Story Regeneration",
            description="SDXL color regeneration pipeline for continuity-safe redraws",
            mode="color",
            prompt_prefix="cinematic anime redraw, preserve composition and continuity",
            controls=["img2img", "instantid", "inpaint"],
            template_key="sdxl_color_regen",
            parameters=[
                WorkflowParameter(key="steps", label="Steps", type="number", default_value=28),
                WorkflowParameter(key="cfg", label="CFG", type="number", default_value=6.4),
                WorkflowParameter(
                    key="sampler",
                    label="Sampler",
                    type="select",
                    default_value="dpmpp_2m",
                    options=["euler", "dpmpp_2m", "dpmpp_sde"],
                ),
            ],
            node_bindings=_regeneration_workflow_bindings(("10", "11", "12"), "instantid", "weight_faceidv2"),
            workflow_json=_color_regeneration_workflow_json(),
        ),
    ]


def get_mock_characters() -> list[CharacterProfile]:
    return [
        CharacterProfile(
            id="char-rin",
            name="Rin",
            appearance="short silver hair, tired amber eyes, slim build",
            wardrobe="oversized black coat, white shirt, dark slacks",
            personality="guarded, observant, emotionally restrained",
            negative_prompt="extra limbs, wrong hairstyle, bright cheerful smile",
            reference_notes="Keep the coat silhouette and eye color fixed across pages.",
            references=[
                CharacterReferenceImage(
                    id="ref-rin-front",
                    label="Front portrait",
                    url="https://example.invalid/rin-front.png",
                    role="primary",
                    angle="front",
                    notes="Primary face and hair reference.",
                ),
                CharacterReferenceImage(
                    id="ref-rin-full",
                    label="Full body",
                    url="https://example.invalid/rin-full.png",
                    role="full-body",
                    angle="full-body",
                    notes="Use for coat silhouette and body proportions.",
                ),
                CharacterReferenceImage(
                    id="ref-rin-outfit",
                    label="Coat detail",
                    url="https://example.invalid/rin-outfit.png",
                    role="outfit",
                    angle="three-quarter",
                    notes="Use for coat collar, sleeve shape, and rain-soaked fabric details.",
                ),
            ],
            consistency=ConsistencyProfile(
                anchor_features=["silver bob cut", "amber eyes", "oversized black coat"],
                forbidden_drift=["blue eyes", "long hair", "cheerful idol styling"],
                palette_hints=["graphite", "off-white", "rain sheen"],
                expression_defaults=["guarded", "tired", "quietly tense"],
                body_shape="slim and understated",
            ),
            adapter=CharacterConsistencyAdapter(
                provider="ip-adapter",
                enabled=True,
                weight=0.72,
                reference_image_ids=["ref-rin-front", "ref-rin-full", "ref-rin-outfit"],
            ),
        ),
        CharacterProfile(
            id="char-kai",
            name="Kai",
            appearance="dark undercut, rectangular glasses, tall frame",
            wardrobe="olive utility jacket, messenger bag, rolled sleeves",
            personality="analytical, calm, dry sense of humor",
            negative_prompt="fantasy armor, long hair, bodybuilder proportions",
            reference_notes="Glasses and messenger bag are identity anchors.",
            references=[
                CharacterReferenceImage(
                    id="ref-kai-front",
                    label="Front portrait",
                    url="https://example.invalid/kai-front.png",
                    role="primary",
                    angle="front",
                    notes="Primary glasses and facial proportion reference.",
                ),
                CharacterReferenceImage(
                    id="ref-kai-outfit",
                    label="Jacket detail",
                    url="https://example.invalid/kai-outfit.png",
                    role="outfit",
                    angle="three-quarter",
                    notes="Use for jacket structure, sleeve rolls, and messenger bag strap placement.",
                ),
            ],
            consistency=ConsistencyProfile(
                anchor_features=["rectangular glasses", "dark undercut", "olive jacket"],
                forbidden_drift=["round glasses", "long fringe", "heroic fantasy styling"],
                palette_hints=["olive", "smoke gray", "paper beige"],
                expression_defaults=["calm", "dry amusement", "focused"],
                body_shape="tall and lean",
            ),
            adapter=CharacterConsistencyAdapter(
                provider="instantid",
                enabled=True,
                weight=0.68,
                reference_image_ids=["ref-kai-front", "ref-kai-outfit"],
            ),
        ),
    ]


def get_mock_scene_memories() -> list[SceneMemory]:
    return [
        SceneMemory(
            id="scene-rain-alley",
            location="Neon alley outside a convenience store",
            time_of_day="late night",
            weather="steady rain",
            lighting="cyan and amber reflections on wet asphalt",
            mood="tense and emotionally distant",
            continuity_notes="Keep storefront signage blurred and avoid crowding the background.",
        )
    ]


def get_mock_project() -> ComicProject:
    workflows = get_mock_workflows()
    characters = get_mock_characters()
    templates = get_mock_templates()
    scene_memories = get_mock_scene_memories()

    return ComicProject(
        id="project-arc-h",
        title="Rain Alley Prototype",
        synopsis="A moody cyber-drama built for panel-by-panel AI-assisted manga production.",
        models=get_mock_models(),
        workflows=workflows,
        characters=characters,
        scene_memories=scene_memories,
        templates=templates,
        pages=[
            ComicPage(
                id="page-01",
                title="Page 01",
                width=852,
                height=1200,
                panels=[
                    ComicPanel(
                        id="panel-1",
                        title="Panel 1",
                        x=48,
                        y=48,
                        width=504,
                        height=320,
                        mode="bw",
                        model_id="sdxl-manga-ink",
                        workflow_preset_id="wf-bw-panel",
                        character_ids=["char-rin"],
                        scene_memory_id="scene-rain-alley",
                        inpaint_mask=InpaintMask(),
                        prompt=PanelPromptSettings(
                            prompt="Rin stands in the rain outside a convenience store, shoulder-up shot",
                            negative_prompt="muddy anatomy, extra fingers, inconsistent costume details",
                            scene_summary="Rainy neon alley at night, reflective asphalt, emotional distance",
                            shot_type="close-up",
                            style_notes="manga screentone, stark blacks",
                            revision_intent=RevisionIntent(),
                        ),
                        generation=GenerationSettings(
                            width=504,
                            height=320,
                            seed=8745123,
                            steps=28,
                            cfg=6.2,
                            sampler="euler",
                            scheduler="normal",
                            denoise=1.0,
                        ),
                        latest_job_status="idle",
                    )
                ],
            )
        ],
    )
