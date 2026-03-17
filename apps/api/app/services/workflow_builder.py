from copy import deepcopy

from app.schemas.comic import CharacterProfile, ComicPanel, WorkflowPreset


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
                "model": ["1", 0],
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
                "model": ["1", 0],
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

    negative_prompt = panel.prompt.negative_prompt
    if characters:
        consistency_block = " | ".join(
            [
                f"{character.name}: anchors={', '.join(character.consistency.anchor_features)}; "
                f"avoid={', '.join(character.consistency.forbidden_drift)}; "
                f"adapter={character.adapter.provider}:{character.adapter.weight}"
                for character in characters
            ]
        )
        negative_bits = [negative_prompt] if negative_prompt else []
        negative_bits.extend(character.negative_prompt for character in characters if character.negative_prompt)
        negative_prompt = ", ".join(bit for bit in negative_bits if bit)
        optimized_prompt = f"{optimized_prompt}. Character consistency: {consistency_block}"

    values = {
        "model": panel.model_id,
        "positive_prompt": optimized_prompt,
        "negative_prompt": negative_prompt,
        "width": int(panel.generation.width),
        "height": int(panel.generation.height),
        "steps": int(panel.generation.steps),
        "cfg": float(panel.generation.cfg),
        "sampler": panel.generation.sampler,
        "scheduler": panel.generation.scheduler,
        "seed": int(panel.generation.seed),
    }

    for binding in workflow.node_bindings:
        node = template.get(binding.node_id)
        if not isinstance(node, dict):
            continue
        inputs = node.setdefault("inputs", {})
        bound_value = _resolve_binding_value(binding.source, binding.character_index, characters, values)
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
    values: dict,
):
    if source in values:
        return values[source]

    if source == "adapter_weight":
        character = _get_character(characters, character_index)
        return character.adapter.weight if character and character.adapter.enabled else None

    if source == "reference_image_url":
        character = _get_character(characters, character_index)
        if character is None or not character.adapter.enabled:
            return None
        preferred_ids = character.adapter.reference_image_ids
        if preferred_ids:
            reference = next((item for item in character.references if item.id == preferred_ids[0]), None)
            if reference:
                return reference.url
        return character.references[0].url if character.references else None

    return None


def _get_character(characters: list[CharacterProfile], character_index: int) -> CharacterProfile | None:
    if 0 <= character_index < len(characters):
        return characters[character_index]
    return None
