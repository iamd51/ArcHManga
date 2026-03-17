import json
from copy import deepcopy
from pathlib import Path
from uuid import uuid4

from app.schemas.comic import (
    CharacterProfile,
    CharacterReferenceImage,
    CharacterReferenceUploadResponse,
    CharacterUpdateRequest,
    ComicProject,
    SceneMemory,
    SceneMemoryUpdateRequest,
    WorkflowImportRequest,
    WorkflowNodeBinding,
    WorkflowParameter,
    WorkflowPreset,
    WorkflowUpdateRequest,
)
from app.services.mock_data import get_mock_project


class CatalogService:
    def __init__(self) -> None:
        self.project = get_mock_project()
        self.storage_dir = Path("storage")
        self.workflow_dir = self.storage_dir / "workflows"
        self.reference_dir = self.storage_dir / "character-references"
        self.character_file = self.storage_dir / "characters.json"
        self.scene_memory_file = self.storage_dir / "scene-memories.json"
        self.workflow_dir.mkdir(parents=True, exist_ok=True)
        self.reference_dir.mkdir(parents=True, exist_ok=True)
        self._load_saved_characters()
        self._load_saved_scene_memories()
        self._load_saved_workflows()

    def get_project(self) -> ComicProject:
        return deepcopy(self.project)

    def list_models(self):
        return deepcopy(self.project.models)

    def list_workflows(self):
        return deepcopy(self.project.workflows)

    def import_workflow(self, payload: WorkflowImportRequest) -> WorkflowPreset:
        workflow = WorkflowPreset(
            id=f"wf-{uuid4().hex[:8]}",
            name=payload.name,
            description=payload.description,
            mode=payload.mode,
            prompt_prefix=payload.prompt_prefix,
            template_key=payload.template_key,
            controls=self._detect_controls(payload.workflow_json),
            parameters=[
                WorkflowParameter(key="steps", label="Steps", type="number", default_value=28),
                WorkflowParameter(key="cfg", label="CFG", type="number", default_value=6.5),
                WorkflowParameter(
                    key="sampler",
                    label="Sampler",
                    type="select",
                    default_value="euler",
                    options=["euler", "dpmpp_2m", "dpmpp_sde"],
                ),
            ],
            node_bindings=self._guess_bindings(payload.workflow_json),
            workflow_json=payload.workflow_json,
        )
        self.project.workflows.append(workflow)
        self._save_workflow_snapshot(workflow)
        return workflow

    def update_workflow(self, workflow_id: str, payload: WorkflowUpdateRequest) -> WorkflowPreset:
        workflow = next((item for item in self.project.workflows if item.id == workflow_id), None)
        if workflow is None:
            raise ValueError("Workflow not found.")

        if payload.prompt_prefix is not None:
            workflow.prompt_prefix = payload.prompt_prefix
        if payload.node_bindings is not None:
            workflow.node_bindings = payload.node_bindings

        self._save_workflow_snapshot(workflow)
        return workflow

    def add_character_reference(
        self,
        character_id: str,
        filename: str,
        label: str,
        angle: str,
        notes: str,
        content: bytes,
    ) -> CharacterReferenceUploadResponse:
        character = next((item for item in self.project.characters if item.id == character_id), None)
        if character is None:
            raise ValueError("Character not found.")

        safe_ext = Path(filename).suffix or ".png"
        reference_id = f"ref-{uuid4().hex[:8]}"
        saved_path = self.reference_dir / f"{reference_id}{safe_ext}"
        saved_path.write_bytes(content)

        reference = CharacterReferenceImage(
            id=reference_id,
            label=label,
            url=f"/static/character-references/{saved_path.name}",
            angle=angle,
            notes=notes,
        )
        character.references.append(reference)
        if reference.id not in character.adapter.reference_image_ids:
            character.adapter.reference_image_ids.append(reference.id)
        self._save_characters()

        return CharacterReferenceUploadResponse(character_id=character_id, reference=reference)

    def update_character(self, character_id: str, payload: CharacterUpdateRequest) -> CharacterProfile:
        character = next((item for item in self.project.characters if item.id == character_id), None)
        if character is None:
            raise ValueError("Character not found.")

        if payload.reference_notes is not None:
            character.reference_notes = payload.reference_notes
        if payload.negative_prompt is not None:
            character.negative_prompt = payload.negative_prompt
        if payload.consistency is not None:
            character.consistency = payload.consistency
        if payload.adapter is not None:
            character.adapter = payload.adapter

        self._save_characters()
        return character

    def update_scene_memory(self, scene_memory_id: str, payload: SceneMemoryUpdateRequest) -> SceneMemory:
        scene_memory = next(
            (item for item in self.project.scene_memories if item.id == scene_memory_id),
            None,
        )
        if scene_memory is None:
            raise ValueError("Scene memory not found.")

        for field in [
            "location",
            "time_of_day",
            "weather",
            "lighting",
            "mood",
            "continuity_notes",
        ]:
            value = getattr(payload, field)
            if value is not None:
                setattr(scene_memory, field, value)

        self._save_scene_memories()
        return scene_memory

    def _detect_controls(self, workflow_json: dict) -> list[str]:
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

    def _guess_bindings(self, workflow_json: dict) -> list[WorkflowNodeBinding]:
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
                        node_id=node_id,
                        input_name="ckpt_name",
                        source="model",
                    )
                )
            if "cliptextencode" in class_type and "text" in inputs:
                source = "positive_prompt" if not bindings or all(
                    item.source != "positive_prompt" for item in bindings
                ) else "negative_prompt"
                bindings.append(
                    WorkflowNodeBinding(
                        id=f"{node_id}-text-{source}",
                        node_id=node_id,
                        input_name="text",
                        source=source,
                    )
                )
            if "emptylatentimage" in class_type:
                if "width" in inputs:
                    bindings.append(
                        WorkflowNodeBinding(
                            id=f"{node_id}-width",
                            node_id=node_id,
                            input_name="width",
                            source="width",
                        )
                    )
                if "height" in inputs:
                    bindings.append(
                        WorkflowNodeBinding(
                            id=f"{node_id}-height",
                            node_id=node_id,
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
                                node_id=node_id,
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
                                node_id=node_id,
                                input_name=input_name,
                                source=source,
                                provider=provider,
                                character_index=0,
                            )
                        )
        return bindings

    def _workflow_snapshot_path(self, workflow_id: str) -> Path:
        return self.workflow_dir / f"{workflow_id}.json"

    def _save_workflow_snapshot(self, workflow: WorkflowPreset) -> None:
        path = self._workflow_snapshot_path(workflow.id)
        path.write_text(json.dumps(workflow.model_dump(by_alias=True), ensure_ascii=False, indent=2), encoding="utf-8")

    def _load_saved_workflows(self) -> None:
        for path in self.workflow_dir.glob("*.json"):
            try:
                workflow = WorkflowPreset.model_validate_json(path.read_text(encoding="utf-8"))
            except Exception:
                continue
            existing_index = next(
                (index for index, item in enumerate(self.project.workflows) if item.id == workflow.id),
                None,
            )
            if existing_index is None:
                self.project.workflows.append(workflow)
            else:
                self.project.workflows[existing_index] = workflow

    def _save_characters(self) -> None:
        payload = [character.model_dump(by_alias=True) for character in self.project.characters]
        self.character_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def _load_saved_characters(self) -> None:
        if not self.character_file.exists():
            return
        try:
            raw = json.loads(self.character_file.read_text(encoding="utf-8"))
        except Exception:
            return

        saved_characters = []
        for item in raw:
            try:
                saved_characters.append(CharacterProfile.model_validate(item))
            except Exception:
                continue

        for saved in saved_characters:
            existing_index = next(
                (index for index, item in enumerate(self.project.characters) if item.id == saved.id),
                None,
            )
            if existing_index is None:
                self.project.characters.append(saved)
            else:
                self.project.characters[existing_index] = saved

    def _save_scene_memories(self) -> None:
        payload = [scene.model_dump(by_alias=True) for scene in self.project.scene_memories]
        self.scene_memory_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def _load_saved_scene_memories(self) -> None:
        if not self.scene_memory_file.exists():
            return
        try:
            raw = json.loads(self.scene_memory_file.read_text(encoding="utf-8"))
        except Exception:
            return

        saved_scene_memories = []
        for item in raw:
            try:
                saved_scene_memories.append(SceneMemory.model_validate(item))
            except Exception:
                continue

        for saved in saved_scene_memories:
            existing_index = next(
                (index for index, item in enumerate(self.project.scene_memories) if item.id == saved.id),
                None,
            )
            if existing_index is None:
                self.project.scene_memories.append(saved)
            else:
                self.project.scene_memories[existing_index] = saved


catalog_service = CatalogService()
