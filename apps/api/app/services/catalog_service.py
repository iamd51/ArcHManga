import json
from copy import deepcopy
from pathlib import Path
from uuid import uuid4

from app.schemas.comic import (
    CharacterProfile,
    CharacterReferenceImage,
    CharacterReferenceUpdateRequest,
    CharacterReferenceUploadResponse,
    CharacterUpdateRequest,
    ComicProject,
    SceneMemory,
    SceneMemoryUpdateRequest,
    WorkflowImportRequest,
    WorkflowParameter,
    WorkflowPreset,
    WorkflowUpdateRequest,
)
from app.services.mock_data import get_mock_project
from app.services.workflow_introspection import detect_controls, guess_bindings


class CatalogService:
    def __init__(self) -> None:
        self.default_project = get_mock_project()
        self.project = deepcopy(self.default_project)
        self.storage_dir = Path("storage")
        self.workflow_dir = self.storage_dir / "workflows"
        self.reference_dir = self.storage_dir / "character-references"
        self.character_file = self.storage_dir / "characters.json"
        self.scene_memory_file = self.storage_dir / "scene-memories.json"
        self.project_file = self.storage_dir / "project.json"
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.workflow_dir.mkdir(parents=True, exist_ok=True)
        self.reference_dir.mkdir(parents=True, exist_ok=True)
        if not self._load_saved_project():
            self._load_saved_characters()
            self._load_saved_scene_memories()
            self._load_saved_workflows()
        self._ensure_default_catalog_items()

    def get_project(self, project_id: str | None = None) -> ComicProject:
        if project_id and self.project.id != project_id:
            raise ValueError("Project not found.")
        return deepcopy(self.project)

    def save_project(self, project: ComicProject) -> ComicProject:
        if project.id != self.project.id:
            raise ValueError("Project id mismatch.")

        self.project = ComicProject.model_validate(project.model_dump(by_alias=True))
        self._ensure_default_catalog_items()
        self._save_project_snapshot()
        self._save_workflow_snapshots()
        self._save_characters()
        self._save_scene_memories()
        return deepcopy(self.project)

    def list_models(self):
        return deepcopy(self.project.models)

    def sync_models(self, models: list) -> list:
        if models:
            self.project.models = models
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
            controls=detect_controls(payload.workflow_json),
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
            node_bindings=guess_bindings(payload.workflow_json),
            workflow_json=payload.workflow_json,
        )
        self.project.workflows.append(workflow)
        self._save_workflow_snapshot(workflow)
        self._save_project_snapshot()
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
        self._save_project_snapshot()
        return workflow

    def add_character_reference(
        self,
        character_id: str,
        filename: str,
        label: str,
        role: str,
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
            role=role,
            angle=angle,
            notes=notes,
        )
        character.references.append(reference)
        if reference.id not in character.adapter.reference_image_ids:
            character.adapter.reference_image_ids.append(reference.id)
        self._save_characters()
        self._save_project_snapshot()

        return CharacterReferenceUploadResponse(character_id=character_id, reference=reference)

    def update_character_reference(
        self,
        character_id: str,
        reference_id: str,
        payload: CharacterReferenceUpdateRequest,
    ) -> CharacterProfile:
        character = next((item for item in self.project.characters if item.id == character_id), None)
        if character is None:
            raise ValueError("Character not found.")

        reference = next((item for item in character.references if item.id == reference_id), None)
        if reference is None:
            raise ValueError("Reference not found.")

        for field in ["label", "role", "angle", "notes"]:
            value = getattr(payload, field)
            if value is not None:
                setattr(reference, field, value)

        self._save_characters()
        self._save_project_snapshot()
        return character

    def delete_character_reference(self, character_id: str, reference_id: str) -> CharacterProfile:
        character = next((item for item in self.project.characters if item.id == character_id), None)
        if character is None:
            raise ValueError("Character not found.")

        reference = next((item for item in character.references if item.id == reference_id), None)
        if reference is None:
            raise ValueError("Reference not found.")

        character.references = [item for item in character.references if item.id != reference_id]
        character.adapter.reference_image_ids = [
            item for item in character.adapter.reference_image_ids if item != reference_id
        ]

        if reference.url.startswith("/static/character-references/"):
            filename = reference.url.removeprefix("/static/character-references/")
            saved_path = self.reference_dir / filename
            if saved_path.exists():
                saved_path.unlink()

        self._save_characters()
        self._save_project_snapshot()
        return character

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
        self._save_project_snapshot()
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
        self._save_project_snapshot()
        return scene_memory

    def _workflow_snapshot_path(self, workflow_id: str) -> Path:
        return self.workflow_dir / f"{workflow_id}.json"

    def _save_project_snapshot(self) -> None:
        self.project_file.write_text(
            json.dumps(self.project.model_dump(by_alias=True), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _load_saved_project(self) -> bool:
        if not self.project_file.exists():
            return False
        try:
            self.project = ComicProject.model_validate_json(self.project_file.read_text(encoding="utf-8"))
            return True
        except Exception:
            return False

    def _save_workflow_snapshots(self) -> None:
        for workflow in self.project.workflows:
            self._save_workflow_snapshot(workflow)

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

    def _ensure_default_catalog_items(self) -> None:
        self._merge_missing_workflows()
        self._merge_missing_templates()
        self._merge_missing_models()

    def _merge_missing_workflows(self) -> None:
        existing_ids = {workflow.id for workflow in self.project.workflows}
        for workflow in self.default_project.workflows:
            if workflow.id not in existing_ids:
                self.project.workflows.append(deepcopy(workflow))

    def _merge_missing_templates(self) -> None:
        existing_ids = {template.id for template in self.project.templates}
        for template in self.default_project.templates:
            if template.id not in existing_ids:
                self.project.templates.append(deepcopy(template))

    def _merge_missing_models(self) -> None:
        existing_ids = {model.id for model in self.project.models}
        for model in self.default_project.models:
            if model.id not in existing_ids:
                self.project.models.append(deepcopy(model))


catalog_service = CatalogService()
