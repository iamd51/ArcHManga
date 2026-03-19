from app.schemas.comic import (
    CharacterConsistencySelection,
    CharacterProfile,
    ComicPanel,
    PanelConsistencyPlan,
)


def build_panel_consistency_plan(
    panel: ComicPanel,
    characters: list[CharacterProfile],
) -> PanelConsistencyPlan:
    character_plans = [build_character_consistency_selection(panel, character) for character in characters]
    score = round(sum(item.score for item in character_plans) / len(character_plans)) if character_plans else 0
    readiness = _resolve_readiness(score)
    active_names = ", ".join(item.character_name for item in character_plans) if character_plans else "no active characters"
    reference_count = sum(len(item.selected_reference_ids) for item in character_plans)
    global_hints = [
        "Keep wardrobe and silhouette locked across adjacent panels." if character_plans else "",
        "Prioritize face identity over style drift during redraws."
        if panel.prompt.revision_intent.preserve_character_identity
        else "",
        "Use shot-matched references instead of generic anchors whenever possible."
        if reference_count
        else "Add shot-matched references to improve identity stability.",
        "Do not change costume, eye color, or hair silhouette unless the director explicitly asks for it."
        if character_plans
        else "",
    ]
    summary = (
        f"{readiness.title()} consistency plan for {active_names} with {reference_count} active reference "
        f"{'anchor' if reference_count == 1 else 'anchors'}."
        if character_plans
        else "No active character anchors for this panel yet."
    )
    return PanelConsistencyPlan(
        readiness=readiness,
        score=score,
        summary=summary,
        global_hints=[hint for hint in global_hints if hint],
        character_plans=character_plans,
    )


def build_character_consistency_selection(
    panel: ComicPanel,
    character: CharacterProfile,
) -> CharacterConsistencySelection:
    preferred_roles = _select_preferred_roles(panel)
    references = _select_reference_images(character, preferred_roles)
    selected_reference_ids = [reference.id for reference in references]
    selected_reference_labels = [reference.label for reference in references]
    selected_reference_urls = [reference.url for reference in references]
    prompt_hints = [
        f"{character.name} anchor features: {', '.join(character.consistency.anchor_features)}."
        if character.consistency.anchor_features
        else f"{character.name} appearance lock: {character.appearance}.",
        f"{character.name} wardrobe lock: {character.wardrobe}." if character.wardrobe else "",
        (
            f"{character.name} expression baseline: {', '.join(character.consistency.expression_defaults)}."
            if character.consistency.expression_defaults
            else ""
        ),
        (
            f"{character.name} selected references: {', '.join(selected_reference_labels)}."
            if selected_reference_labels
            else ""
        ),
    ]
    negative_hints = [
        f"Avoid {character.name} drift: {', '.join(character.consistency.forbidden_drift)}."
        if character.consistency.forbidden_drift
        else "",
        character.negative_prompt,
    ]
    warnings = _build_warnings(panel, character, preferred_roles, references)
    score = _score_character_consistency(character, references, panel)
    return CharacterConsistencySelection(
        character_id=character.id,
        character_name=character.name,
        readiness=_resolve_readiness(score),
        score=score,
        anchor_summary=_join_non_empty(
            [", ".join(character.consistency.anchor_features), character.consistency.body_shape, character.appearance]
        ),
        wardrobe_lock=character.wardrobe,
        expression_cue=", ".join(character.consistency.expression_defaults),
        selected_reference_ids=selected_reference_ids,
        selected_reference_labels=selected_reference_labels,
        selected_reference_urls=selected_reference_urls,
        adapter_provider=character.adapter.provider,
        adapter_enabled=character.adapter.enabled,
        adapter_weight=character.adapter.weight,
        prompt_hints=[hint for hint in prompt_hints if hint],
        negative_hints=[hint for hint in negative_hints if hint],
        warnings=warnings,
    )


def _select_preferred_roles(panel: ComicPanel) -> list[str]:
    shot_type = panel.prompt.shot_type.lower()
    edit_priority = panel.prompt.revision_intent.edit_priority
    if any(token in shot_type for token in ["close", "reaction", "portrait"]) or edit_priority == "expression":
        return ["primary", "face", "expression", "support", "full-body", "outfit"]
    if any(token in shot_type for token in ["wide", "long", "full"]) or edit_priority == "pose":
        return ["full-body", "outfit", "primary", "support", "face", "expression"]
    return ["primary", "face", "full-body", "outfit", "expression", "support"]


def _select_reference_images(character: CharacterProfile, preferred_roles: list[str]):
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
    return ranked[:2]


def _build_warnings(panel: ComicPanel, character: CharacterProfile, preferred_roles: list[str], references: list):
    warnings: list[str] = []
    roles = {reference.role for reference in character.references}
    if not character.references:
        warnings.append("No reference images uploaded yet.")
    if character.adapter.enabled and not character.adapter.reference_image_ids:
        warnings.append("Adapter is enabled but no adapter references are selected.")
    if preferred_roles[0] in {"primary", "face", "expression"} and not roles.intersection({"primary", "face", "expression"}):
        warnings.append("Close-up identity references are missing for this shot.")
    if preferred_roles[0] in {"full-body", "outfit"} and not roles.intersection({"full-body", "outfit"}):
        warnings.append("Full-body or outfit anchors are missing for this shot.")
    if panel.prompt.revision_intent.preserve_character_identity and not references:
        warnings.append("Identity lock is enabled, but this panel has no active reference anchors.")
    return warnings


def _score_character_consistency(character: CharacterProfile, references: list, panel: ComicPanel) -> int:
    score = 0
    if character.appearance:
        score += 18
    if character.wardrobe:
        score += 14
    if character.reference_notes:
        score += 8
    if character.consistency.anchor_features:
        score += 18
    if character.consistency.forbidden_drift:
        score += 10
    if character.consistency.expression_defaults:
        score += 6
    if references:
        score += 16
    if character.adapter.enabled and references:
        score += 8
    if panel.prompt.revision_intent.preserve_character_identity:
        score += 6
    return min(score, 100)


def _resolve_readiness(score: int) -> str:
    if score >= 75:
        return "strong"
    if score >= 45:
        return "partial"
    return "weak"


def _join_non_empty(parts: list[str]) -> str:
    return "; ".join(part for part in parts if part)
