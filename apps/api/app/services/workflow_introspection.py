from app.schemas.comic import WorkflowNodeBinding, WorkflowNodeSummary


def detect_controls(workflow_json: dict) -> list[str]:
    names = " ".join(
        str(node.get("class_type", "")).lower() for node in workflow_json.values() if isinstance(node, dict)
    )
    controls = []
    if "ipadapter" in names or "ip_adapter" in names:
        controls.append("ip-adapter")
    if "instantid" in names:
        controls.append("instantid")
    if "controlnet" in names:
        controls.append("controlnet")
    if "loadimage" in names or "vaeencode" in names:
        controls.append("img2img")
    if "inpaint" in names or "loadimagemask" in names:
        controls.append("inpaint")
    if "vae" in names:
        controls.append("vae")
    return controls or ["custom-workflow"]


def guess_bindings(workflow_json: dict) -> list[WorkflowNodeBinding]:
    bindings: list[WorkflowNodeBinding] = []
    adapter_image_sequences = {
        "ip-adapter": [
            "face_reference_image_url",
            "full_body_reference_image_url",
            "outfit_reference_image_url",
            "expression_reference_image_url",
        ],
        "instantid": [
            "face_reference_image_url",
            "full_body_reference_image_url",
            "outfit_reference_image_url",
            "expression_reference_image_url",
        ],
    }
    adapter_image_counts = {"ip-adapter": 0, "instantid": 0}
    for node_id, node in workflow_json.items():
        if not isinstance(node, dict):
            continue
        class_type = str(node.get("class_type", "")).lower()
        inputs = node.get("inputs", {})
        if "checkpoint" in class_type and "ckpt_name" in inputs:
            bindings.append(
                WorkflowNodeBinding(
                    id=f"{node_id}-ckpt_name",
                    node_id=str(node_id),
                    input_name="ckpt_name",
                    source="model",
                )
            )
        if "cliptextencode" in class_type and "text" in inputs:
            source = (
                "positive_prompt"
                if all(item.source != "positive_prompt" for item in bindings)
                else "negative_prompt"
            )
            bindings.append(
                WorkflowNodeBinding(
                    id=f"{node_id}-text-{source}",
                    node_id=str(node_id),
                    input_name="text",
                    source=source,
                )
            )
        if "emptylatentimage" in class_type:
            if "width" in inputs:
                bindings.append(
                    WorkflowNodeBinding(
                        id=f"{node_id}-width",
                        node_id=str(node_id),
                        input_name="width",
                        source="width",
                    )
                )
            if "height" in inputs:
                bindings.append(
                    WorkflowNodeBinding(
                        id=f"{node_id}-height",
                        node_id=str(node_id),
                        input_name="height",
                        source="height",
                    )
                )
        if "loadimage" in class_type and "image" in inputs:
            bindings.append(
                WorkflowNodeBinding(
                    id=f"{node_id}-image-source",
                    node_id=str(node_id),
                    input_name="image",
                    source="source_image_url",
                )
            )
        if "loadimagemask" in class_type and "image" in inputs:
            bindings.append(
                WorkflowNodeBinding(
                    id=f"{node_id}-mask-source",
                    node_id=str(node_id),
                    input_name="image",
                    source="mask_image_url",
                )
            )
        if "ksampler" in class_type:
            for input_name, source in [
                ("denoise", "denoise"),
                ("steps", "steps"),
                ("cfg", "cfg"),
                ("sampler_name", "sampler"),
                ("scheduler", "scheduler"),
                ("seed", "seed"),
            ]:
                if input_name in inputs:
                    bindings.append(
                        WorkflowNodeBinding(
                            id=f"{node_id}-{input_name}",
                            node_id=str(node_id),
                            input_name=input_name,
                            source=source,
                        )
                    )
        if "ipadapter" in class_type or "ip_adapter" in class_type or "instantid" in class_type:
            provider = "instantid" if "instantid" in class_type else "ip-adapter"
            for input_name in inputs:
                if input_name in {"weight", "weight_faceidv2"}:
                    bindings.append(
                        WorkflowNodeBinding(
                            id=f"{node_id}-{input_name}",
                            node_id=str(node_id),
                            input_name=input_name,
                            source="adapter_weight",
                            provider=provider,
                            character_index=0,
                        )
                    )
                    continue
                if "image" not in input_name:
                    continue
                lowered_input = input_name.lower()
                if "face" in lowered_input:
                    source = "face_reference_image_url"
                elif "body" in lowered_input or "full" in lowered_input:
                    source = "full_body_reference_image_url"
                elif "outfit" in lowered_input or "cloth" in lowered_input:
                    source = "outfit_reference_image_url"
                elif "expression" in lowered_input or "emotion" in lowered_input:
                    source = "expression_reference_image_url"
                elif "primary" in lowered_input:
                    source = "primary_reference_image_url"
                else:
                    provider_sequence = adapter_image_sequences.get(provider, ["reference_image_url"])
                    sequence_index = min(
                        adapter_image_counts.get(provider, 0),
                        len(provider_sequence) - 1,
                    )
                    source = provider_sequence[sequence_index]
                    adapter_image_counts[provider] = adapter_image_counts.get(provider, 0) + 1
                bindings.append(
                    WorkflowNodeBinding(
                        id=f"{node_id}-{input_name}",
                        node_id=str(node_id),
                        input_name=input_name,
                        source=source,
                        provider=provider,
                        character_index=0,
                    )
                )
    return bindings


def summarize_nodes(workflow_json: dict) -> list[WorkflowNodeSummary]:
    summaries: list[WorkflowNodeSummary] = []
    for node_id, node in workflow_json.items():
        if not isinstance(node, dict):
            continue
        inputs = node.get("inputs", {})
        input_names = list(inputs.keys()) if isinstance(inputs, dict) else []
        summaries.append(
            WorkflowNodeSummary(
                node_id=str(node_id),
                node_type=str(node.get("class_type", "")),
                input_names=input_names,
            )
        )
    return summaries
