from app.schemas.comic import (
    WorkflowNodeBinding,
    WorkflowValidationIssue,
    WorkflowValidationResponse,
    WorkflowValidationSummary,
)
from app.services.workflow_introspection import guess_bindings, summarize_nodes


ADAPTER_PROVIDER_HINTS = {
    "ip-adapter": ("ipadapter", "ip_adapter"),
    "instantid": ("instantid",),
}

CUSTOM_NODE_HINTS = {
    "IPAdapter": ("ipadapter", "ip_adapter"),
    "InstantID": ("instantid",),
}


def validate_workflow(
    workflow_json: dict,
    object_info: dict | None,
    node_bindings: list[WorkflowNodeBinding],
) -> WorkflowValidationResponse:
    issues: list[WorkflowValidationIssue] = []
    object_info = object_info or {}
    detected_nodes = summarize_nodes(workflow_json)
    recommended_bindings = guess_bindings(workflow_json)
    unknown_node_types: set[str] = set()

    for node_id, node in workflow_json.items():
        if not isinstance(node, dict):
            issues.append(
                WorkflowValidationIssue(
                    level="warning",
                    code="invalid_node_shape",
                    message="Node is not a valid object.",
                    node_id=str(node_id),
                )
            )
            continue

        node_type = str(node.get("class_type", ""))
        if not node_type:
            issues.append(
                WorkflowValidationIssue(
                    level="error",
                    code="missing_class_type",
                    message="Node is missing class_type.",
                    node_id=str(node_id),
                )
            )
            continue

        if object_info and node_type not in object_info:
            unknown_node_types.add(node_type)
            issues.append(
                WorkflowValidationIssue(
                    level="error",
                    code="unknown_node_type",
                    message=f"Node type '{node_type}' is not available in the connected ComfyUI instance.",
                    node_id=str(node_id),
                    node_type=node_type,
                )
            )

    for binding in node_bindings:
        node = workflow_json.get(binding.node_id)
        node_type = str(node.get("class_type", "")) if isinstance(node, dict) else None
        if not isinstance(node, dict):
            issues.append(
                WorkflowValidationIssue(
                    level="error",
                    code="binding_missing_node",
                    message="Binding points to a missing node.",
                    node_id=binding.node_id,
                    input_name=binding.input_name,
                )
            )
            continue

        inputs = node.get("inputs", {})
        if binding.input_name not in inputs:
            issues.append(
                WorkflowValidationIssue(
                    level="error",
                    code="binding_missing_input",
                    message=f"Input '{binding.input_name}' does not exist on node {binding.node_id}.",
                    node_id=binding.node_id,
                    node_type=node_type,
                    input_name=binding.input_name,
                )
            )

        if object_info and node_type in object_info:
            known_inputs = _extract_known_inputs(object_info[node_type])
            if binding.input_name not in known_inputs:
                issues.append(
                    WorkflowValidationIssue(
                        level="warning",
                        code="binding_input_not_in_object_info",
                        message=(
                            f"Input '{binding.input_name}' is not listed for node type '{node_type}' "
                            "in object_info."
                        ),
                        node_id=binding.node_id,
                        node_type=node_type,
                        input_name=binding.input_name,
                    )
                )

        if binding.source in {
            "reference_image_url",
            "primary_reference_image_url",
            "face_reference_image_url",
            "full_body_reference_image_url",
            "outfit_reference_image_url",
            "expression_reference_image_url",
            "adapter_weight",
            "appearance_adapter_weight",
            "wardrobe_adapter_weight",
            "expression_adapter_weight",
        } and binding.provider:
            provider_hints = ADAPTER_PROVIDER_HINTS.get(binding.provider, ())
            normalized_node_type = (node_type or "").lower()
            if provider_hints and not any(hint in normalized_node_type for hint in provider_hints):
                issues.append(
                    WorkflowValidationIssue(
                        level="warning",
                        code="adapter_provider_mismatch",
                        message=(
                            f"Binding provider '{binding.provider}' may not match node type '{node_type}'."
                        ),
                        node_id=binding.node_id,
                        node_type=node_type,
                        input_name=binding.input_name,
                    )
                )

    actual_binding_keys = {_binding_key(binding) for binding in node_bindings}
    for binding in recommended_bindings:
        if _binding_key(binding) in actual_binding_keys:
            continue
        issues.append(
            WorkflowValidationIssue(
                level="warning",
                code="missing_recommended_binding",
                message=(
                    f"Recommended binding for source '{binding.source}' is missing on "
                    f"node {binding.node_id} input '{binding.input_name}'."
                ),
                node_id=binding.node_id,
                input_name=binding.input_name,
            )
        )

    mapped_sources = sorted({binding.source for binding in node_bindings})
    unmapped_recommended_sources = sorted(
        {binding.source for binding in recommended_bindings if _binding_key(binding) not in actual_binding_keys}
    )
    missing_custom_nodes = _detect_missing_custom_nodes(unknown_node_types)
    valid = not any(issue.level == "error" for issue in issues)
    return WorkflowValidationResponse(
        valid=valid,
        issues=issues,
        summary=WorkflowValidationSummary(
            error_count=sum(1 for issue in issues if issue.level == "error"),
            warning_count=sum(1 for issue in issues if issue.level == "warning"),
            unknown_node_types=sorted(unknown_node_types),
            missing_custom_nodes=missing_custom_nodes,
            mapped_sources=mapped_sources,
            unmapped_recommended_sources=unmapped_recommended_sources,
        ),
        recommended_bindings=recommended_bindings,
        detected_nodes=detected_nodes,
        checked_nodes=len(workflow_json),
        checked_bindings=len(node_bindings),
    )


def _binding_key(binding: WorkflowNodeBinding) -> tuple[str, str, str, str, int]:
    return (
        binding.node_id,
        binding.input_name,
        binding.source,
        binding.provider or "generic",
        binding.character_index,
    )


def _detect_missing_custom_nodes(unknown_node_types: set[str]) -> list[str]:
    missing: list[str] = []
    normalized_types = [node_type.lower() for node_type in unknown_node_types]
    for label, hints in CUSTOM_NODE_HINTS.items():
        if any(any(hint in node_type for hint in hints) for node_type in normalized_types):
            missing.append(label)
    return missing


def _extract_known_inputs(node_definition: dict) -> set[str]:
    if not isinstance(node_definition, dict):
        return set()
    inputs = node_definition.get("input", {})
    if not isinstance(inputs, dict):
        return set()
    required = inputs.get("required", {})
    optional = inputs.get("optional", {})
    hidden = inputs.get("hidden", {})
    names: set[str] = set()
    for bucket in (required, optional, hidden):
        if isinstance(bucket, dict):
            names.update(str(key) for key in bucket.keys())
    return names
