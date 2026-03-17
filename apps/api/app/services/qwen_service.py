import json

import httpx

from app.core.config import get_settings
from app.schemas.generation import (
    ContinuityDraftRequest,
    ContinuityDraftResponse,
    PromptPreviewRequest,
    PromptPreviewResponse,
)


class QwenPromptService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def build_prompt_preview(
        self, payload: PromptPreviewRequest
    ) -> PromptPreviewResponse:
        fallback = self._fallback_preview(payload)
        if not self.settings.qwen_api_key:
            return fallback

        system_prompt = (
            "You are a manga prompt optimizer. Return compact JSON with keys: "
            "optimized_prompt, continuity_hints, scene_state."
        )
        user_payload = {
            "panel_prompt": payload.panel.prompt.prompt,
            "scene_summary": payload.panel.prompt.scene_summary,
            "shot_type": payload.panel.prompt.shot_type,
            "style_notes": payload.panel.prompt.style_notes,
            "workflow_prefix": payload.workflow.prompt_prefix if payload.workflow else "",
            "characters": [
                {
                    "name": character.name,
                    "appearance": character.appearance,
                    "wardrobe": character.wardrobe,
                    "reference_notes": character.reference_notes,
                    "anchor_features": character.consistency.anchor_features,
                    "forbidden_drift": character.consistency.forbidden_drift,
                }
                for character in payload.characters
            ],
        }

        headers = {
            "Authorization": f"Bearer {self.settings.qwen_api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.settings.qwen_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
            ],
            "temperature": 0.4,
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(
                    f"{self.settings.qwen_api_base_url}/chat/completions",
                    headers=headers,
                    json=body,
                )
                response.raise_for_status()
                data = response.json()
                message = data["choices"][0]["message"]["content"]
                parsed = json.loads(message)
                return PromptPreviewResponse(
                    user_prompt=payload.panel.prompt.prompt,
                    optimized_prompt=parsed["optimized_prompt"],
                    continuity_hints=parsed.get("continuity_hints", []),
                    scene_state=parsed.get("scene_state", payload.panel.prompt.scene_summary),
                )
        except Exception:
            return fallback

    async def build_continuity_draft(
        self, payload: ContinuityDraftRequest
    ) -> ContinuityDraftResponse:
        fallback = self._fallback_continuity_draft(payload)
        if not self.settings.qwen_api_key:
            return fallback

        system_prompt = (
            "You are a manga continuity planner. Return compact JSON with keys: "
            "prompt, scene_summary, shot_type, style_notes, continuity_hints."
        )
        user_payload = {
            "current_panel_title": payload.current_panel.title,
            "previous_panel_prompt": payload.previous_panel.prompt.prompt if payload.previous_panel else "",
            "previous_panel_scene_summary": payload.previous_panel.prompt.scene_summary
            if payload.previous_panel
            else "",
            "previous_shot_type": payload.previous_panel.prompt.shot_type if payload.previous_panel else "",
            "current_scene_memory": payload.current_scene_memory.model_dump(by_alias=True)
            if payload.current_scene_memory
            else None,
            "previous_scene_memory": payload.previous_scene_memory.model_dump(by_alias=True)
            if payload.previous_scene_memory
            else None,
            "characters": [
                {
                    "name": character.name,
                    "appearance": character.appearance,
                    "wardrobe": character.wardrobe,
                    "anchor_features": character.consistency.anchor_features,
                    "reference_notes": character.reference_notes,
                }
                for character in payload.characters
            ],
        }

        headers = {
            "Authorization": f"Bearer {self.settings.qwen_api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.settings.qwen_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
            ],
            "temperature": 0.5,
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(
                    f"{self.settings.qwen_api_base_url}/chat/completions",
                    headers=headers,
                    json=body,
                )
                response.raise_for_status()
                data = response.json()
                message = data["choices"][0]["message"]["content"]
                parsed = json.loads(message)
                return ContinuityDraftResponse(
                    prompt=parsed["prompt"],
                    scene_summary=parsed["scene_summary"],
                    shot_type=parsed["shot_type"],
                    style_notes=parsed["style_notes"],
                    continuity_hints=parsed.get("continuity_hints", []),
                )
        except Exception:
            return fallback

    def _fallback_preview(self, payload: PromptPreviewRequest) -> PromptPreviewResponse:
        workflow_prefix = payload.workflow.prompt_prefix if payload.workflow else ""
        character_line = " | ".join(
            f"{character.name}: {character.appearance}; {character.wardrobe}; anchors={', '.join(character.consistency.anchor_features)}"
            for character in payload.characters
        )
        continuity_hints = [
            payload.panel.prompt.scene_summary or "Carry over the current scene and emotional tone.",
            f"Shot type: {payload.panel.prompt.shot_type}"
            if payload.panel.prompt.shot_type
            else "Keep a readable manga composition.",
            f"Style anchor: {payload.panel.prompt.style_notes}"
            if payload.panel.prompt.style_notes
            else "Preserve workflow style anchors.",
            (
                "Avoid identity drift: "
                + "; ".join(
                    f"{character.name} -> {', '.join(character.consistency.forbidden_drift)}"
                    for character in payload.characters
                )
            )
            if payload.characters
            else "Keep identity anchors stable across the scene.",
        ]
        optimized_prompt = ", ".join(
            part
            for part in [
                workflow_prefix,
                payload.panel.prompt.prompt,
                f"Character anchors: {character_line}" if character_line else "",
                "Maintain silhouette clarity and preserve identity traits.",
            ]
            if part
        )

        return PromptPreviewResponse(
            user_prompt=payload.panel.prompt.prompt,
            optimized_prompt=optimized_prompt,
            continuity_hints=continuity_hints,
            scene_state=payload.panel.prompt.scene_summary or "No scene summary yet.",
        )

    def _fallback_continuity_draft(
        self, payload: ContinuityDraftRequest
    ) -> ContinuityDraftResponse:
        previous_prompt = payload.previous_panel.prompt.prompt if payload.previous_panel else ""
        previous_scene = (
            payload.previous_scene_memory.continuity_notes
            if payload.previous_scene_memory
            else payload.previous_panel.prompt.scene_summary if payload.previous_panel else ""
        )
        current_scene_bits = []
        if payload.current_scene_memory:
            current_scene_bits.extend(
                [
                    payload.current_scene_memory.location,
                    payload.current_scene_memory.weather,
                    payload.current_scene_memory.lighting,
                    payload.current_scene_memory.mood,
                ]
            )
        character_names = ", ".join(character.name for character in payload.characters)
        shot_type = (
            "reaction shot"
            if payload.previous_panel and payload.previous_panel.prompt.shot_type == "close-up"
            else "medium shot"
        )
        style_notes = payload.current_panel.prompt.style_notes or (
            payload.previous_panel.prompt.style_notes if payload.previous_panel else ""
        )
        prompt = ", ".join(
            part
            for part in [
                f"Continue from previous panel: {previous_prompt}" if previous_prompt else "",
                f"Keep the scene in {', '.join(bit for bit in current_scene_bits if bit)}"
                if current_scene_bits
                else "",
                f"Focus on {character_names}" if character_names else "",
                "Advance the action by one readable beat and preserve panel-to-panel continuity.",
            ]
            if part
        )
        continuity_hints = [
            previous_scene or "Carry the environment and emotional tone forward.",
            "Avoid abrupt costume or lighting changes.",
            "Keep the next panel composition readable and narratively adjacent to the previous beat.",
        ]
        scene_summary = (
            payload.current_scene_memory.continuity_notes
            if payload.current_scene_memory
            else previous_scene or "Continue the current scene state."
        )

        return ContinuityDraftResponse(
            prompt=prompt,
            scene_summary=scene_summary,
            shot_type=shot_type,
            style_notes=style_notes or "Match the previous panel style anchors.",
            continuity_hints=continuity_hints,
        )


qwen_prompt_service = QwenPromptService()
