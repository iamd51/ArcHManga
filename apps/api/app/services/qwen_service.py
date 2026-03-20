import json
import re

import httpx

from app.core.config import get_settings
from app.schemas.comic import CharacterContinuityLock, RevisionIntent
from app.schemas.generation import (
    ContinuityDraftRequest,
    ContinuityDraftResponse,
    DirectorBeat,
    DirectorDraftRequest,
    DirectorDraftResponse,
    DirectorPanelSuggestion,
    DirectorSceneSuggestion,
    PromptPreviewRequest,
    PromptPreviewResponse,
)
from app.services.character_consistency import build_panel_consistency_plan


class QwenPromptService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def build_prompt_preview(
        self, payload: PromptPreviewRequest
    ) -> PromptPreviewResponse:
        consistency_plan = build_panel_consistency_plan(
            payload.panel,
            payload.characters,
            payload.previous_panel,
        )
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
            "revision_intent": payload.panel.prompt.revision_intent.model_dump(by_alias=True),
            "inpaint_mask": payload.panel.inpaint_mask.model_dump(by_alias=True),
            "workflow_prefix": payload.workflow.prompt_prefix if payload.workflow else "",
            "previous_panel_snapshot": payload.previous_panel.continuity_snapshot.model_dump(by_alias=True)
            if payload.previous_panel and payload.previous_panel.continuity_snapshot
            else None,
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
            "consistency_plan": consistency_plan.model_dump(by_alias=True),
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
                    consistency_plan=consistency_plan,
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
            "current_panel_snapshot": payload.current_panel.continuity_snapshot.model_dump(by_alias=True)
            if payload.current_panel.continuity_snapshot
            else None,
            "previous_panel_snapshot": payload.previous_panel.continuity_snapshot.model_dump(by_alias=True)
            if payload.previous_panel and payload.previous_panel.continuity_snapshot
            else None,
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
        consistency_plan = build_panel_consistency_plan(
            payload.panel,
            payload.characters,
            payload.previous_panel,
        )
        workflow_prefix = payload.workflow.prompt_prefix if payload.workflow else ""
        previous_snapshot = (
            payload.previous_panel.continuity_snapshot
            if payload.previous_panel and payload.previous_panel.continuity_snapshot
            else None
        )
        character_line = " | ".join(
            f"{plan.character_name}: {plan.anchor_summary}; wardrobe={plan.wardrobe_lock}"
            for plan in consistency_plan.character_plans
        )
        continuity_hints = [
            payload.panel.prompt.scene_summary or "Carry over the current scene and emotional tone.",
            f"Previous panel lock: {previous_snapshot.continuity_summary}" if previous_snapshot else "",
            f"Shot type: {payload.panel.prompt.shot_type}"
            if payload.panel.prompt.shot_type
            else "Keep a readable manga composition.",
            f"Style anchor: {payload.panel.prompt.style_notes}"
            if payload.panel.prompt.style_notes
            else "Preserve workflow style anchors.",
            *self._revision_intent_hints(payload.panel.prompt.revision_intent),
            "Confine the redraw to the active inpaint mask." if payload.panel.inpaint_mask.enabled else "",
            consistency_plan.summary,
            *consistency_plan.global_hints,
            *[
                hint
                for plan in consistency_plan.character_plans
                for hint in [*plan.prompt_hints[:2], *plan.warnings[:1]]
            ],
        ]
        optimized_prompt = ", ".join(
            part
            for part in [
                workflow_prefix,
                payload.panel.prompt.prompt,
                f"Character anchors: {character_line}" if character_line else "",
                (
                    "Carry forward continuity states: "
                    + " | ".join(
                        f"{state.character_name} expression={state.expression or 'neutral'} wardrobe={state.wardrobe or 'same'} framing={state.framing_cue or 'same'}"
                        for state in previous_snapshot.character_states
                    )
                )
                if previous_snapshot and previous_snapshot.character_states
                else "",
                (
                    "Consistency locks: "
                    + " | ".join(
                        hint
                        for hint in (
                            consistency_plan.global_hints
                            + [plan.anchor_summary for plan in consistency_plan.character_plans]
                        )
                        if hint
                    )
                )
                if consistency_plan.character_plans
                else "",
                "Maintain silhouette clarity and preserve identity traits.",
            ]
            if part
        )

        return PromptPreviewResponse(
            user_prompt=payload.panel.prompt.prompt,
            optimized_prompt=optimized_prompt,
            continuity_hints=continuity_hints,
            scene_state=payload.panel.prompt.scene_summary
            or (previous_snapshot.scene_summary if previous_snapshot else "")
            or "No scene summary yet.",
            consistency_plan=consistency_plan,
        )

    def _fallback_continuity_draft(
        self, payload: ContinuityDraftRequest
    ) -> ContinuityDraftResponse:
        previous_prompt = payload.previous_panel.prompt.prompt if payload.previous_panel else ""
        previous_scene = (
            payload.previous_scene_memory.continuity_notes
            if payload.previous_scene_memory
            else payload.previous_panel.continuity_snapshot.continuity_summary
            if payload.previous_panel and payload.previous_panel.continuity_snapshot
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

    async def build_director_draft(
        self, payload: DirectorDraftRequest
    ) -> DirectorDraftResponse:
        fallback = self._fallback_director_draft(payload)
        if not self.settings.qwen_api_key:
            return fallback

        system_prompt = (
            "You are an AI manga director. Return compact JSON with keys: "
            "assistant_message, continuity_hints, suggested_panel_count, selected_character_ids, "
            "suggested_beats, panel_suggestion, scene_suggestion, quick_repair_recipe_id. "
            "Each beat should contain id, title, description, shot_type, mode, focus_character_ids. "
            "panel_suggestion should contain prompt, scene_summary, shot_type, style_notes, mode, character_ids, revision_intent. "
            "revision_intent may include character_locks so different characters can keep different continuity rules. "
            "quick_repair_recipe_id should be one of expression-fix, pose-cleanup, camera-restage, lighting-polish when the request is a local repair pass. "
            "scene_suggestion should contain location, time_of_day, weather, lighting, mood, continuity_notes."
        )
        user_payload = {
            "user_message": payload.user_message,
            "history": [message.model_dump(by_alias=True) for message in payload.history[-8:]],
            "context_summary": payload.context_summary,
            "selected_panel": payload.selected_panel.model_dump(by_alias=True) if payload.selected_panel else None,
            "selected_panel_snapshot": payload.selected_panel.continuity_snapshot.model_dump(by_alias=True)
            if payload.selected_panel and payload.selected_panel.continuity_snapshot
            else None,
            "current_page": payload.current_page.model_dump(by_alias=True),
            "current_scene_memory": payload.current_scene_memory.model_dump(by_alias=True)
            if payload.current_scene_memory
            else None,
            "previous_panel": payload.previous_panel.model_dump(by_alias=True) if payload.previous_panel else None,
            "previous_panel_snapshot": payload.previous_panel.continuity_snapshot.model_dump(by_alias=True)
            if payload.previous_panel and payload.previous_panel.continuity_snapshot
            else None,
            "previous_scene_memory": payload.previous_scene_memory.model_dump(by_alias=True)
            if payload.previous_scene_memory
            else None,
            "selected_characters": [
                {
                    "id": character.id,
                    "name": character.name,
                    "appearance": character.appearance,
                    "wardrobe": character.wardrobe,
                    "anchor_features": character.consistency.anchor_features,
                    "forbidden_drift": character.consistency.forbidden_drift,
                    "reference_notes": character.reference_notes,
                    "current_character_lock": next(
                        (
                            lock.model_dump(by_alias=True)
                            for lock in payload.selected_panel.prompt.revision_intent.character_locks
                            if lock.character_id == character.id
                        ),
                        None,
                    )
                    if payload.selected_panel
                    else None,
                }
                for character in payload.selected_characters
            ],
            "available_characters": [
                {
                    "id": character.id,
                    "name": character.name,
                    "appearance": character.appearance,
                    "wardrobe": character.wardrobe,
                }
                for character in payload.available_characters
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
            "temperature": 0.6,
        }

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                response = await client.post(
                    f"{self.settings.qwen_api_base_url}/chat/completions",
                    headers=headers,
                    json=body,
                )
                response.raise_for_status()
                data = response.json()
                message = data["choices"][0]["message"]["content"]
                parsed = json.loads(message)
                return DirectorDraftResponse.model_validate(parsed)
        except Exception:
            return fallback

    def _fallback_director_draft(
        self, payload: DirectorDraftRequest
    ) -> DirectorDraftResponse:
        requested_count = self._detect_panel_count(payload.user_message)
        selected_character_ids = self._detect_character_ids(payload)
        mode = self._detect_mode(payload)
        shot_type = self._detect_shot_type(payload.user_message, payload.selected_panel.prompt.shot_type if payload.selected_panel else "")
        style_notes = self._detect_style_notes(payload)
        scene_suggestion = self._build_scene_suggestion(payload)
        panel_count = requested_count or (4 if self._looks_like_storyboard_request(payload.user_message) else 1)
        panel_count = max(1, min(panel_count, 8))

        suggested_beats = self._build_beats(payload, panel_count, mode, selected_character_ids)
        panel_suggestion = self._build_panel_suggestion(
            payload, mode, shot_type, style_notes, selected_character_ids
        )
        quick_repair_recipe_id = self._detect_quick_repair_recipe(
            payload, panel_suggestion.revision_intent
        )

        assistant_lines = [
            f"I suggest {panel_count} panel{'s' if panel_count > 1 else ''} for this beat."
            if panel_count > 1
            else "I refined the selected panel into one cleaner dramatic beat.",
            f"Primary shot: {panel_suggestion.shot_type or shot_type or 'medium shot'}.",
            f"Characters in focus: {', '.join(selected_character_ids) if selected_character_ids else 'keep current cast'}.",
        ]
        if panel_suggestion.revision_intent and panel_suggestion.revision_intent.character_locks:
            assistant_lines.append(
                "Parsed character locks: "
                + " | ".join(
                    self._summarize_character_lock_for_director(lock)
                    for lock in panel_suggestion.revision_intent.character_locks
                )
            )
        if quick_repair_recipe_id:
            assistant_lines.append(
                f"Suggested quick repair: {self._summarize_quick_repair_recipe(quick_repair_recipe_id)}."
            )
        if payload.context_summary:
            assistant_lines.append(f"Working memory: {payload.context_summary}")
        if scene_suggestion.continuity_notes:
            assistant_lines.append(scene_suggestion.continuity_notes)

        continuity_hints = [
            panel_suggestion.scene_summary or "Carry the current scene state forward.",
            "Preserve identity anchors and wardrobe continuity.",
            "Advance only one readable emotional or narrative beat per panel.",
        ]
        if shot_type:
            continuity_hints.append(f"Use {shot_type} to keep the page staging readable.")
        if payload.context_summary:
            continuity_hints.append(payload.context_summary)
        if panel_suggestion.revision_intent:
            continuity_hints.extend(self._revision_intent_hints(panel_suggestion.revision_intent))
        if quick_repair_recipe_id:
            continuity_hints.append(
                f"Preferred repair flow: {self._summarize_quick_repair_recipe(quick_repair_recipe_id)}."
            )

        return DirectorDraftResponse(
            assistant_message=" ".join(assistant_lines),
            continuity_hints=continuity_hints,
            suggested_panel_count=panel_count,
            selected_character_ids=selected_character_ids,
            suggested_beats=suggested_beats,
            panel_suggestion=panel_suggestion,
            scene_suggestion=scene_suggestion,
            quick_repair_recipe_id=quick_repair_recipe_id,
        )

    def _detect_panel_count(self, user_message: str) -> int | None:
        lowered = user_message.lower()
        special_cases = {
            "四格": 4,
            "4格": 4,
            "three panels": 3,
            "two panels": 2,
        }
        for key, value in special_cases.items():
            if key in lowered:
                return value

        digits = []
        current = ""
        for character in user_message:
            if character.isdigit():
                current += character
            else:
                if current:
                    digits.append(current)
                    current = ""
        if current:
            digits.append(current)
        for digit in digits:
            token = int(digit)
            if any(marker in user_message for marker in [f"{digit}格", f"{digit} panel", f"{digit} panels"]):
                return token
        return None

    def _detect_character_ids(self, payload: DirectorDraftRequest) -> list[str]:
        selected: list[str] = []
        lowered = payload.user_message.lower()
        for character in payload.available_characters or payload.selected_characters:
            if character.name.lower() in lowered:
                selected.append(character.id)
        if selected:
            return selected
        if payload.selected_characters:
            return [character.id for character in payload.selected_characters]
        return []

    def _detect_mode(self, payload: DirectorDraftRequest) -> str:
        lowered = payload.user_message.lower()
        if "黑白" in payload.user_message or "bw" in lowered or "manga" in lowered:
            return "bw"
        if "彩色" in payload.user_message or "color" in lowered or "colour" in lowered:
            return "color"
        if payload.selected_panel:
            return payload.selected_panel.mode
        return "bw"

    def _detect_shot_type(self, user_message: str, fallback: str = "") -> str:
        shot_map = {
            "close-up": ["特寫", "close-up", "close up", "近景特寫"],
            "close shot": ["近景", "close shot"],
            "medium shot": ["中景", "medium shot"],
            "wide shot": ["遠景", "wide shot", "全景"],
            "over-shoulder": ["肩後", "over shoulder", "over-the-shoulder"],
            "reaction shot": ["反應", "reaction shot"],
        }
        lowered = user_message.lower()
        for shot_type, tokens in shot_map.items():
            if any(token in user_message or token in lowered for token in tokens):
                return shot_type
        return fallback or "medium shot"

    def _detect_style_notes(self, payload: DirectorDraftRequest) -> str:
        notes = []
        message = payload.user_message
        if "壓抑" in message or "tense" in message.lower():
            notes.append("tense restrained mood")
        if "雨" in message or "rain" in message.lower():
            notes.append("wet reflective surfaces")
        if "安靜" in message or "quiet" in message.lower():
            notes.append("quiet dramatic pacing")
        if payload.selected_panel and payload.selected_panel.prompt.style_notes:
            notes.append(payload.selected_panel.prompt.style_notes)
        return ", ".join(dict.fromkeys(note for note in notes if note))

    def _looks_like_storyboard_request(self, user_message: str) -> bool:
        markers = ["分鏡", "拆", "storyboard", "beats", "幾格", "排成", "page"]
        lowered = user_message.lower()
        return any(marker in user_message or marker in lowered for marker in markers)

    def _build_scene_suggestion(self, payload: DirectorDraftRequest) -> DirectorSceneSuggestion:
        base = payload.current_scene_memory
        location = base.location if base else ""
        time_of_day = base.time_of_day if base else ""
        weather = base.weather if base else ""
        lighting = base.lighting if base else ""
        mood = base.mood if base else ""
        continuity_notes = base.continuity_notes if base else ""
        message = payload.user_message
        lowered = message.lower()
        if "室內" in message or "inside" in lowered:
            location = location or "Interior scene"
        if "便利商店" in message or "store" in lowered:
            location = "Convenience store interior or storefront"
        if "夜" in message or "night" in lowered:
            time_of_day = "late night"
        if "雨" in message or "rain" in lowered:
            weather = "steady rain"
            lighting = lighting or "wet reflections with shaped highlights"
        if "壓抑" in message or "tense" in lowered:
            mood = "tense and restrained"
        if not continuity_notes:
            continuity_notes = "Carry forward wardrobe, camera direction, and emotional continuity."
        return DirectorSceneSuggestion(
            location=location,
            time_of_day=time_of_day,
            weather=weather,
            lighting=lighting,
            mood=mood,
            continuity_notes=continuity_notes,
        )

    def _build_panel_suggestion(
        self,
        payload: DirectorDraftRequest,
        mode: str,
        shot_type: str,
        style_notes: str,
        selected_character_ids: list[str],
    ) -> DirectorPanelSuggestion:
        base_prompt = payload.selected_panel.prompt.prompt if payload.selected_panel else ""
        revision_intent = self._detect_revision_intent(payload)
        scene_summary = (
            payload.current_scene_memory.continuity_notes
            if payload.current_scene_memory
            else payload.selected_panel.prompt.scene_summary if payload.selected_panel else ""
        )
        prompt_parts = [
            payload.user_message.strip(),
            f"Focus on {', '.join(selected_character_ids)}" if selected_character_ids else "",
            "Advance the story by one clear manga beat.",
        ]
        if payload.context_summary:
            prompt_parts.append(f"Director memory: {payload.context_summary}")
        if base_prompt:
            prompt_parts.append(f"Preserve useful anchors from: {base_prompt}")
        prompt_parts.extend(self._revision_intent_hints(revision_intent))
        return DirectorPanelSuggestion(
            prompt=", ".join(part for part in prompt_parts if part),
            scene_summary=scene_summary or "Continue the same scene with controlled continuity.",
            shot_type=shot_type,
            style_notes=style_notes or "clean visual storytelling, readable silhouettes",
            mode=mode,
            character_ids=selected_character_ids,
            revision_intent=revision_intent,
        )

    def _build_beats(
        self,
        payload: DirectorDraftRequest,
        panel_count: int,
        mode: str,
        selected_character_ids: list[str],
    ) -> list[DirectorBeat]:
        phase_labels = [
            ("beat-setup", "Setup", "Establish the scene and emotional baseline."),
            ("beat-move", "Advance", "Move the action or staging forward by one beat."),
            ("beat-reaction", "Reaction", "Show the emotional response or reveal."),
            ("beat-payoff", "Payoff", "Land the final dramatic beat or transition."),
        ]
        beats: list[DirectorBeat] = []
        for index in range(panel_count):
            phase = phase_labels[min(index, len(phase_labels) - 1)]
            beats.append(
                DirectorBeat(
                    id=f"beat-{index + 1}",
                    title=f"{index + 1}. {phase[1]}",
                    description=f"{phase[2]} Direction: {payload.user_message}",
                    shot_type=self._suggest_beat_shot(index, panel_count),
                    mode=mode,
                    focus_character_ids=selected_character_ids,
                )
            )
        return beats

    def _detect_revision_intent(self, payload: DirectorDraftRequest) -> RevisionIntent:
        base = payload.selected_panel.prompt.revision_intent if payload.selected_panel else RevisionIntent()
        lowered = payload.user_message.lower()
        preserve_composition = base.preserve_composition or any(
            token in payload.user_message or token in lowered
            for token in [
                "保留構圖",
                "保持構圖",
                "同構圖",
                "構圖不變",
                "構圖不要變",
                "keep composition",
                "same composition",
            ]
        )
        preserve_background = base.preserve_background or any(
            token in payload.user_message or token in lowered
            for token in ["背景不變", "背景不要變", "保持背景", "same background", "keep background"]
        )
        preserve_character_identity = base.preserve_character_identity or any(
            token in payload.user_message or token in lowered
            for token in ["角色一致", "保留角色", "保留臉", "keep identity", "same character"]
        )
        lock_character_appearance = base.lock_character_appearance or any(
            token in payload.user_message or token in lowered
            for token in ["延續外觀", "保持外觀", "appearance lock", "same appearance", "keep face"]
        )
        lock_character_wardrobe = base.lock_character_wardrobe or any(
            token in payload.user_message or token in lowered
            for token in ["延續服裝", "保持服裝", "same outfit", "keep outfit", "wardrobe lock"]
        )
        lock_character_expression = base.lock_character_expression or any(
            token in payload.user_message or token in lowered
            for token in ["延續表情", "保持表情", "same expression", "keep expression"]
        )
        lock_camera_framing = base.lock_camera_framing or any(
            token in payload.user_message or token in lowered
            for token in [
                "延續鏡頭",
                "保持鏡頭",
                "鏡頭不變",
                "鏡頭不要變",
                "鏡頭維持一樣",
                "same shot",
                "keep framing",
                "camera lock",
            ]
        )
        edit_priority = base.edit_priority
        priority_map = {
            "expression": ["表情", "expression", "眼神"],
            "pose": ["姿勢", "pose", "動作"],
            "camera": ["鏡頭", "構圖", "camera", "shot", "拉遠", "拉近"],
            "lighting": ["光線", "lighting", "光影"],
        }
        for candidate, tokens in priority_map.items():
            if any(token in payload.user_message or token in lowered for token in tokens):
                edit_priority = candidate
                break
        change_instructions = payload.user_message.strip() or base.change_instructions
        character_locks = self._detect_character_locks(payload, base)
        return RevisionIntent(
            preserve_composition=preserve_composition,
            preserve_background=preserve_background,
            preserve_character_identity=preserve_character_identity,
            lock_character_appearance=lock_character_appearance,
            lock_character_wardrobe=lock_character_wardrobe,
            lock_character_expression=lock_character_expression,
            lock_camera_framing=lock_camera_framing,
            edit_priority=edit_priority or "general",
            change_instructions=change_instructions,
            character_locks=character_locks,
        )

    def _detect_quick_repair_recipe(
        self, payload: DirectorDraftRequest, revision_intent: RevisionIntent
    ) -> str | None:
        message = payload.user_message
        lowered = message.lower()
        explicit_map = {
            "expression-fix": [
                "只修表情",
                "修表情",
                "表情修一下",
                "修臉",
                "修眼神",
                "expression fix",
                "face fix",
            ],
            "pose-cleanup": [
                "修姿勢",
                "改姿勢",
                "姿勢修一下",
                "修動作",
                "pose cleanup",
                "pose fix",
            ],
            "camera-restage": [
                "改鏡頭",
                "重拉鏡頭",
                "拉遠鏡頭",
                "拉近鏡頭",
                "改構圖",
                "camera restage",
                "restage camera",
            ],
            "lighting-polish": [
                "修光",
                "修光線",
                "修光影",
                "調光線",
                "lighting polish",
                "light pass",
            ],
        }
        for recipe_id, tokens in explicit_map.items():
            if any(token in message or token in lowered for token in tokens):
                return recipe_id

        if revision_intent.edit_priority == "expression":
            return "expression-fix"
        if revision_intent.edit_priority == "pose":
            return "pose-cleanup"
        if revision_intent.edit_priority == "camera":
            return "camera-restage"
        if revision_intent.edit_priority == "lighting":
            return "lighting-polish"
        return None

    def _revision_intent_hints(self, revision_intent: RevisionIntent) -> list[str]:
        hints: list[str] = []
        if revision_intent.preserve_composition:
            hints.append("Keep composition, panel staging, and camera direction stable.")
        if revision_intent.preserve_background:
            hints.append("Preserve the existing background and environmental layout.")
        if revision_intent.preserve_character_identity:
            hints.append("Do not drift the active character face, silhouette, or outfit.")
        if revision_intent.lock_character_appearance:
            hints.append("Keep the recurring character appearance, face, and silhouette locked.")
        if revision_intent.lock_character_wardrobe:
            hints.append("Keep the previous wardrobe and outfit details locked.")
        if revision_intent.lock_character_expression:
            hints.append("Carry the previous facial expression unless a change is requested.")
        if revision_intent.lock_camera_framing:
            hints.append("Preserve the previous camera framing language where possible.")
        if revision_intent.edit_priority != "general":
            hints.append(f"Revision focus: {revision_intent.edit_priority}.")
        if revision_intent.change_instructions:
            hints.append(f"Requested change: {revision_intent.change_instructions}")
        for character_lock in revision_intent.character_locks:
            lock_summary = ", ".join(
                bit
                for bit in [
                    "appearance" if character_lock.lock_character_appearance else "",
                    "wardrobe" if character_lock.lock_character_wardrobe else "",
                    "expression" if character_lock.lock_character_expression else "",
                    "camera" if character_lock.lock_camera_framing else "",
                    "identity" if character_lock.preserve_character_identity else "",
                    character_lock.note,
                ]
                if bit
            )
            if lock_summary:
                hints.append(f"Character-specific lock for {character_lock.character_id}: {lock_summary}.")
        return hints

    def _detect_character_locks(
        self,
        payload: DirectorDraftRequest,
        base: RevisionIntent,
    ) -> list[CharacterContinuityLock]:
        user_message = payload.user_message
        lowered = user_message.lower()
        character_locks: list[CharacterContinuityLock] = []
        for character in payload.selected_characters or payload.available_characters:
            name_tokens = [character.name, character.name.lower()]
            if not any(token in user_message or token in lowered for token in name_tokens):
                continue
            existing_lock = next(
                (lock for lock in base.character_locks if lock.character_id == character.id),
                None,
            )
            lock = CharacterContinuityLock(
                character_id=character.id,
                preserve_character_identity=(
                    existing_lock.preserve_character_identity
                    if existing_lock and existing_lock.preserve_character_identity is not None
                    else None
                ),
                lock_character_appearance=(
                    existing_lock.lock_character_appearance
                    if existing_lock and existing_lock.lock_character_appearance is not None
                    else None
                ),
                lock_character_wardrobe=(
                    existing_lock.lock_character_wardrobe
                    if existing_lock and existing_lock.lock_character_wardrobe is not None
                    else None
                ),
                lock_character_expression=(
                    existing_lock.lock_character_expression
                    if existing_lock and existing_lock.lock_character_expression is not None
                    else None
                ),
                lock_camera_framing=(
                    existing_lock.lock_camera_framing
                    if existing_lock and existing_lock.lock_camera_framing is not None
                    else None
                ),
                note=existing_lock.note if existing_lock else "",
            )
            segment = self._extract_character_segment(user_message, character.name)
            segment_lowered = segment.lower()
            preset_name = self._detect_character_lock_preset(segment)
            if preset_name:
                preset_values = self._build_character_lock_preset(preset_name, character.name)
                for field_name, value in preset_values.items():
                    setattr(lock, field_name, value)
            positive_specs = [
                ("preserve_character_identity", ["保留角色", "角色一致", "keep identity", "same character"]),
                ("lock_character_appearance", ["延續外觀", "保持外觀", "外觀", "same appearance", "keep face"]),
                ("lock_character_wardrobe", ["延續服裝", "保持服裝", "服裝", "same outfit", "keep outfit"]),
                ("lock_character_expression", ["延續表情", "保持表情", "表情", "same expression", "keep expression"]),
                ("lock_camera_framing", ["延續鏡頭", "保持鏡頭", "鏡頭維持", "鏡頭一樣", "same shot", "keep framing"]),
            ]
            negative_specs = [
                ("lock_character_expression", ["表情可以改", "change expression", "expression can change"]),
                ("lock_character_wardrobe", ["服裝可以改", "change outfit", "outfit can change"]),
                ("lock_character_appearance", ["外觀可以改", "change appearance", "appearance can change"]),
                ("lock_camera_framing", ["鏡頭可以改", "change framing", "camera can change"]),
            ]
            for field_name, tokens in positive_specs:
                if any(
                    token in segment
                    or token in segment_lowered
                    or self._character_token_match(user_message, character.name, token)
                    for token in tokens
                ):
                    setattr(lock, field_name, True)
            for field_name, tokens in negative_specs:
                if any(
                    token in segment
                    or token in segment_lowered
                    or self._character_token_match(user_message, character.name, token)
                    for token in tokens
                ):
                    setattr(lock, field_name, False)
            if self._segment_requests_only_expression_change(segment):
                lock.preserve_character_identity = True
                lock.lock_character_appearance = True
                lock.lock_character_wardrobe = True
                lock.lock_character_expression = False
            if self._segment_requests_only_camera_hold(segment):
                lock.preserve_character_identity = True
                lock.lock_character_appearance = True
                lock.lock_camera_framing = True
            if any(
                getattr(lock, field_name) is not None
                for field_name in [
                    "preserve_character_identity",
                    "lock_character_appearance",
                    "lock_character_wardrobe",
                    "lock_character_expression",
                    "lock_camera_framing",
                ]
            ):
                lock.note = self._build_character_lock_note(character.name, preset_name)
                character_locks.append(lock)
        if not character_locks:
            return base.character_locks
        preserved_locks = [
            lock for lock in base.character_locks if all(lock.character_id != item.character_id for item in character_locks)
        ]
        return [*preserved_locks, *character_locks]

    def _extract_character_segment(self, user_message: str, character_name: str) -> str:
        lowered = user_message.lower()
        name_lowered = character_name.lower()
        start = lowered.find(name_lowered)
        if start == -1:
            return user_message
        stop_tokens = ["，", ",", "；", ";", "。", "."]
        next_positions = [
            user_message.find(token, start + len(character_name))
            for token in stop_tokens
            if user_message.find(token, start + len(character_name)) != -1
        ]
        end = min(next_positions) if next_positions else len(user_message)
        return user_message[start:end]

    def _character_token_match(self, user_message: str, character_name: str, token: str) -> bool:
        clauses = [clause.strip() for clause in re.split(r"[，,；;。.!?]", user_message) if clause.strip()]
        token_lowered = token.lower()
        character_lowered = character_name.lower()
        for clause in clauses:
            lowered_clause = clause.lower()
            if character_name in clause or character_lowered in lowered_clause:
                if token in clause or token_lowered in lowered_clause:
                    return True
        return False

    def _detect_character_lock_preset(self, segment: str) -> str | None:
        lowered = segment.lower()
        presets = {
            "full-lock": ["全鎖", "全部鎖住", "全部鎖定", "完全固定", "full lock", "lock everything"],
            "allow-expression": [
                "只放開表情",
                "只改表情",
                "表情可以改",
                "只讓表情變",
                "allow expression",
            ],
            "keep-look-outfit": [
                "保持外觀和服裝",
                "保留外觀和服裝",
                "外觀和服裝不變",
                "keep look and outfit",
            ],
            "identity-camera": [
                "鏡頭不變",
                "鏡頭維持一樣",
                "保持鏡頭",
                "identity and camera",
            ],
        }
        for preset_name, tokens in presets.items():
            if any(token in segment or token in lowered for token in tokens):
                return preset_name
        return None

    def _build_character_lock_preset(self, preset_name: str, character_name: str) -> dict[str, bool]:
        presets = {
            "full-lock": {
                "preserve_character_identity": True,
                "lock_character_appearance": True,
                "lock_character_wardrobe": True,
                "lock_character_expression": True,
                "lock_camera_framing": True,
            },
            "allow-expression": {
                "preserve_character_identity": True,
                "lock_character_appearance": True,
                "lock_character_wardrobe": True,
                "lock_character_expression": False,
                "lock_camera_framing": False,
            },
            "keep-look-outfit": {
                "preserve_character_identity": True,
                "lock_character_appearance": True,
                "lock_character_wardrobe": True,
                "lock_character_expression": False,
                "lock_camera_framing": False,
            },
            "identity-camera": {
                "preserve_character_identity": True,
                "lock_character_appearance": True,
                "lock_character_wardrobe": False,
                "lock_character_expression": False,
                "lock_camera_framing": True,
            },
        }
        return presets.get(preset_name, {})

    def _segment_requests_only_expression_change(self, segment: str) -> bool:
        lowered = segment.lower()
        return any(
            token in segment or token in lowered
            for token in [
                "只放開表情",
                "只改表情",
                "只讓表情變",
                "表情可以改",
                "只動表情",
                "only expression",
            ]
        )

    def _segment_requests_only_camera_hold(self, segment: str) -> bool:
        lowered = segment.lower()
        return any(
            token in segment or token in lowered
            for token in ["鏡頭不變", "鏡頭維持一樣", "保持鏡頭", "same shot", "keep framing"]
        )

    def _build_character_lock_note(self, character_name: str, preset_name: str | None) -> str:
        if preset_name == "full-lock":
            return f"Director preset for {character_name}: full lock."
        if preset_name == "allow-expression":
            return f"Director preset for {character_name}: allow expression changes."
        if preset_name == "keep-look-outfit":
            return f"Director preset for {character_name}: keep look and outfit."
        if preset_name == "identity-camera":
            return f"Director preset for {character_name}: keep identity and camera."
        return f"Director override from request for {character_name}."

    def _summarize_character_lock_for_director(self, character_lock: CharacterContinuityLock) -> str:
        labels = [
            "identity" if character_lock.preserve_character_identity else "",
            "appearance" if character_lock.lock_character_appearance else "",
            "wardrobe" if character_lock.lock_character_wardrobe else "",
            "expression" if character_lock.lock_character_expression else "",
            "camera" if character_lock.lock_camera_framing else "",
            "expression free" if character_lock.lock_character_expression is False else "",
            "wardrobe free" if character_lock.lock_character_wardrobe is False else "",
            "appearance free" if character_lock.lock_character_appearance is False else "",
            "camera free" if character_lock.lock_camera_framing is False else "",
        ]
        summary = ", ".join(label for label in labels if label)
        return f"{character_lock.character_id}: {summary or 'custom override'}"

    def _summarize_quick_repair_recipe(self, recipe_id: str) -> str:
        labels = {
            "expression-fix": "expression fix",
            "pose-cleanup": "pose cleanup",
            "camera-restage": "camera restage",
            "lighting-polish": "lighting polish",
        }
        return labels.get(recipe_id, recipe_id)

    def _suggest_beat_shot(self, index: int, panel_count: int) -> str:
        if panel_count == 1:
            return "medium shot"
        if index == 0:
            return "wide shot"
        if index == panel_count - 1:
            return "close-up"
        if index == panel_count - 2:
            return "reaction shot"
        return "medium shot"


qwen_prompt_service = QwenPromptService()
