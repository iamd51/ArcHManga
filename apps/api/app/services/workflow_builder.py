from copy import deepcopy

from app.schemas.comic import CharacterProfile, ComicPanel, InpaintMask, RevisionIntent, WorkflowPreset
from app.services.character_consistency import build_panel_consistency_plan


WORKFLOW_TEMPLATES: dict[str, dict] = {
    "sdxl_text2img": {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": ""}},
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
                "cfg": 6.5,
                "sampler_name": "euler",
                "scheduler": "normal",
                "denoise": 1,
                "model": ["1", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["4", 0],
            },
        },
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {
            "class_type": "SaveImage",
            "inputs": {"images": ["6", 0], "filename_prefix": "archmanga/default"},
        },
    },
    "sdxl_manga": {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": ""}},
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
        "8": {"class_type": "IPAdapterApply", "inputs": {"image": "", "weight": 0, "model": ["1", 0]}},
        "9": {"class_type": "IPAdapterApply", "inputs": {"image": "", "weight": 0, "model": ["8", 0]}},
        "10": {"class_type": "IPAdapterApply", "inputs": {"image": "", "weight": 0, "model": ["9", 0]}},
    },
    "sdxl_color_story": {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": ""}},
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
        "8": {"class_type": "InstantIDApply", "inputs": {"image": "", "weight_faceidv2": 0, "model": ["1", 0]}},
        "9": {"class_type": "InstantIDApply", "inputs": {"image": "", "weight_faceidv2": 0, "model": ["8", 0]}},
        "10": {"class_type": "InstantIDApply", "inputs": {"image": "", "weight_faceidv2": 0, "model": ["9", 0]}},
    },
    "sdxl_manga_regen": {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": ""}},
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
        "10": {"class_type": "IPAdapterApply", "inputs": {"image": "", "weight": 0, "model": ["1", 0]}},
        "11": {"class_type": "IPAdapterApply", "inputs": {"image": "", "weight": 0, "model": ["10", 0]}},
        "12": {"class_type": "IPAdapterApply", "inputs": {"image": "", "weight": 0, "model": ["11", 0]}},
        "13": {
            "class_type": "SaveImage",
            "inputs": {"images": ["9", 0], "filename_prefix": "archmanga/manga-regen"},
        },
    },
    "sdxl_color_regen": {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": ""}},
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
            "inputs": {"image": "", "weight_faceidv2": 0, "model": ["1", 0]},
        },
        "11": {
            "class_type": "InstantIDApply",
            "inputs": {"image": "", "weight_faceidv2": 0, "model": ["10", 0]},
        },
        "12": {
            "class_type": "InstantIDApply",
            "inputs": {"image": "", "weight_faceidv2": 0, "model": ["11", 0]},
        },
        "13": {
            "class_type": "SaveImage",
            "inputs": {"images": ["9", 0], "filename_prefix": "archmanga/color-regen"},
        },
    },
}


def build_workflow_payload(
    project_id: str,
    page_id: str,
    panel: ComicPanel,
    workflow: WorkflowPreset,
    optimized_prompt: str,
    characters: list[CharacterProfile],
) -> dict:
    template = deepcopy(workflow.workflow_json or WORKFLOW_TEMPLATES.get(workflow.template_key, {}))
    if not template:
        template = deepcopy(WORKFLOW_TEMPLATES["sdxl_text2img"])

    consistency_plan = build_panel_consistency_plan(panel, characters)
    negative_prompt = _build_negative_prompt(panel, consistency_plan)
    values = {
        "model": panel.model_id,
        "positive_prompt": optimized_prompt,
        "negative_prompt": negative_prompt,
        "width": int(panel.generation.width),
        "height": int(panel.generation.height),
        "denoise": _resolve_denoise_value(panel),
        "steps": int(panel.generation.steps),
        "cfg": float(panel.generation.cfg),
        "sampler": panel.generation.sampler,
        "scheduler": panel.generation.scheduler,
        "seed": int(panel.generation.seed),
        "source_image_url": panel.image_url,
        "mask_image_url": _build_mask_data_url(panel),
    }
    inpaint_mask = _get_inpaint_mask(panel)
    revision_intent = _get_revision_intent(panel)

    for binding in workflow.node_bindings:
        node = template.get(binding.node_id)
        if not isinstance(node, dict):
            continue
        inputs = node.setdefault("inputs", {})
        bound_value = _resolve_binding_value(
            binding.source,
            binding.character_index,
            characters,
            consistency_plan,
            values,
        )
        if bound_value is not None:
            inputs[binding.input_name] = bound_value

    for node in template.values():
        if isinstance(node, dict) and str(node.get("class_type", "")).lower() == "saveimage":
            node.setdefault("inputs", {})["filename_prefix"] = f"archmanga/{project_id}/{page_id}/{panel.id}"

    template["meta"] = {
        "project_id": project_id,
        "page_id": page_id,
        "panel_id": panel.id,
        "workflow_preset_id": workflow.id,
        "character_ids": panel.character_ids,
        "scene_memory_id": panel.scene_memory_id,
        "source_image_url": panel.image_url,
        "mask_image_url": values["mask_image_url"],
        "computed_denoise": values["denoise"],
        "revision_intent": revision_intent.model_dump(by_alias=True),
        "inpaint_mask": inpaint_mask.model_dump(by_alias=True),
        "consistency_plan": consistency_plan.model_dump(by_alias=True),
        "consistency_adapters": [
            {
                "character_id": character.id,
                "provider": character.adapter.provider,
                "enabled": character.adapter.enabled,
                "weight": character.adapter.weight,
                "reference_image_ids": character.adapter.reference_image_ids,
            }
            for character in characters
        ],
    }
    return template


def _resolve_binding_value(
    source: str,
    character_index: int,
    characters: list[CharacterProfile],
    consistency_plan,
    values: dict,
):
    if source in values:
        return values[source]

    if source in {
        "reference_image_url",
        "primary_reference_image_url",
        "face_reference_image_url",
        "full_body_reference_image_url",
        "outfit_reference_image_url",
        "expression_reference_image_url",
    }:
        explicit_role_map = {
            "primary_reference_image_url": ["primary", "face", "expression", "support", "full-body", "outfit"],
            "face_reference_image_url": ["face", "primary", "expression", "support", "full-body", "outfit"],
            "full_body_reference_image_url": ["full-body", "outfit", "primary", "support", "face", "expression"],
            "outfit_reference_image_url": ["outfit", "full-body", "primary", "support", "face", "expression"],
            "expression_reference_image_url": ["expression", "face", "primary", "support", "full-body", "outfit"],
        }
        character = _get_character(characters, character_index)
        if character is None or not character.adapter.enabled:
            return None
        if source == "reference_image_url":
            character_plan = _get_character_plan(consistency_plan, character_index)
            if character_plan and character_plan.adapter_enabled and character_plan.selected_reference_urls:
                return character_plan.selected_reference_urls[0]
        return _resolve_reference_url_by_roles(
            character,
            explicit_role_map.get(source, ["primary", "face", "full-body", "outfit", "expression", "support"]),
        )

    if source == "adapter_weight":
        character_plan = _get_character_plan(consistency_plan, character_index)
        if character_plan and character_plan.adapter_enabled:
            return character_plan.adapter_weight
        character = _get_character(characters, character_index)
        return character.adapter.weight if character and character.adapter.enabled else None

    return None


def _get_character(characters: list[CharacterProfile], character_index: int) -> CharacterProfile | None:
    if 0 <= character_index < len(characters):
        return characters[character_index]
    return None


def _get_character_plan(consistency_plan, character_index: int):
    character_plans = getattr(consistency_plan, "character_plans", [])
    if 0 <= character_index < len(character_plans):
        return character_plans[character_index]
    return None


def _build_negative_prompt(panel: ComicPanel, consistency_plan) -> str:
    negative_bits = [panel.prompt.negative_prompt] if panel.prompt.negative_prompt else []
    for character_plan in getattr(consistency_plan, "character_plans", []):
        negative_bits.extend(character_plan.negative_hints)
    deduped: list[str] = []
    for bit in negative_bits:
        normalized = bit.strip()
        if normalized and normalized not in deduped:
            deduped.append(normalized)
    return ", ".join(deduped)


def _resolve_reference_url_by_roles(character: CharacterProfile, preferred_roles: list[str]) -> str | None:
    role_rank = {role: len(preferred_roles) - index for index, role in enumerate(preferred_roles)}
    adapter_rank = {
        reference_id: len(character.adapter.reference_image_ids) - index
        for index, reference_id in enumerate(character.adapter.reference_image_ids)
    }
    ranked = sorted(
        character.references,
        key=lambda reference: (
            role_rank.get(reference.role, 0),
            adapter_rank.get(reference.id, 0),
            1 if reference.role == "primary" else 0,
        ),
        reverse=True,
    )
    return ranked[0].url if ranked else None


def _resolve_denoise_value(panel: ComicPanel) -> float:
    if not panel.image_url:
        return float(panel.generation.denoise)

    revision_intent = _get_revision_intent(panel)
    if revision_intent.preserve_composition and revision_intent.preserve_background:
        return 0.18
    if revision_intent.edit_priority == "expression":
        return 0.24
    if revision_intent.preserve_composition or revision_intent.preserve_background:
        return 0.32
    if revision_intent.edit_priority == "pose":
        return 0.4
    if revision_intent.edit_priority == "camera":
        return 0.58
    if revision_intent.preserve_character_identity:
        return 0.36
    return max(0.45, float(panel.generation.denoise))


def _build_mask_data_url(panel: ComicPanel) -> str | None:
    inpaint_mask = _get_inpaint_mask(panel)
    if not panel.image_url or not inpaint_mask.enabled:
        return None

    width = max(1, int(panel.generation.width))
    height = max(1, int(panel.generation.height))
    mask = inpaint_mask
    mask_x = max(0, min(width - 1, int(width * mask.x)))
    mask_y = max(0, min(height - 1, int(height * mask.y)))
    mask_width = max(1, min(width - mask_x, int(width * mask.width)))
    mask_height = max(1, min(height - mask_y, int(height * mask.height)))
    radius = max(0, int(mask.feather))
    svg = (
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}'>"
        f"<rect width='100%' height='100%' fill='black'/>"
        f"<rect x='{mask_x}' y='{mask_y}' width='{mask_width}' height='{mask_height}' "
        f"rx='{radius}' ry='{radius}' fill='white'/>"
        "</svg>"
    )
    return "data:image/svg+xml;utf8," + svg


def _get_revision_intent(panel: ComicPanel) -> RevisionIntent:
    revision_intent = panel.prompt.revision_intent
    if isinstance(revision_intent, RevisionIntent):
        return revision_intent
    if isinstance(revision_intent, dict):
        return RevisionIntent.model_validate(revision_intent)
    return RevisionIntent()


def _get_inpaint_mask(panel: ComicPanel) -> InpaintMask:
    inpaint_mask = panel.inpaint_mask
    if isinstance(inpaint_mask, InpaintMask):
        return inpaint_mask
    if isinstance(inpaint_mask, dict):
        return InpaintMask.model_validate(inpaint_mask)
    return InpaintMask()
