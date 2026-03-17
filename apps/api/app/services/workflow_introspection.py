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
    if "vae" in names:
        controls.append("vae")
    return controls or ["custom-workflow"]


def guess_bindings(workflow_json: dict) -> list[WorkflowNodeBinding]:
    bindings: list[WorkflowNodeBinding] = []
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
        if "ksampler" in class_type:
            for input_name, source in [
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
            for input_name, source in [
                ("image", "reference_image_url"),
                ("weight", "adapter_weight"),
                ("weight_faceidv2", "adapter_weight"),
            ]:
                if input_name in inputs:
                    provider = "instantid" if "instantid" in class_type else "ip-adapter"
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
