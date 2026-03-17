from uuid import uuid4

from app.schemas.comic import CharacterProfile
from app.schemas.generation import (
    GenerationJobRequest,
    GenerationJobResponse,
    GenerationJobStatus,
    PromptPreviewRequest,
)
from app.services.comfyui_service import comfyui_service
from app.services.qwen_service import qwen_prompt_service
from app.services.workflow_builder import build_workflow_payload


class GenerationOrchestrator:
    def __init__(self) -> None:
        self.jobs: dict[str, dict] = {}

    async def create_job(self, payload: GenerationJobRequest) -> GenerationJobResponse:
        preview = await qwen_prompt_service.build_prompt_preview(
            PromptPreviewRequest(
                panel=payload.panel,
                workflow=payload.workflow,
                characters=payload.characters,
            )
        )

        workflow_payload = build_workflow_payload(
            payload.project_id,
            payload.page_id,
            payload.panel,
            payload.workflow,
            preview.optimized_prompt,
            payload.characters,
        )
        provider_response = await comfyui_service.submit_prompt(workflow_payload)

        job_id = str(uuid4())
        self.jobs[job_id] = {
            "job": GenerationJobStatus(
                job_id=job_id,
                status="queued",
                panel_id=payload.panel.id,
                prompt_id=provider_response.get("prompt_id"),
                detail="Submitted to ComfyUI queue.",
            ),
            "polls": 0,
            "panel_id": payload.panel.id,
            "mock": provider_response.get("mode") == "mock",
        }

        return GenerationJobResponse(
            job_id=job_id,
            status="queued",
            prompt_preview=preview,
            workflow_payload=workflow_payload,
            provider_response=provider_response,
        )

    async def get_job(self, job_id: str) -> GenerationJobStatus:
        entry = self.jobs.get(job_id)
        if entry is None:
            return GenerationJobStatus(job_id=job_id, status="missing", detail="Unknown job id.")

        job = entry["job"]
        entry["polls"] += 1

        if entry["mock"]:
            if entry["polls"] == 1:
                job.status = "running"
                job.detail = "Mock worker is rendering the selected panel."
            else:
                job.status = "complete"
                job.detail = "Mock render completed."
                job.image_urls = [self._mock_image(entry["panel_id"])]
            return job

        if job.prompt_id:
            history = await comfyui_service.get_history(job.prompt_id)
            outputs = history.get(job.prompt_id, {}).get("outputs", {}) if isinstance(history, dict) else {}
            images = self._collect_history_images(outputs)
            if images:
                job.status = "complete"
                job.detail = "ComfyUI render completed."
                job.image_urls = images
            else:
                job.status = "running"
                job.detail = "Waiting for ComfyUI outputs."
        return job

    def _collect_history_images(self, outputs: dict) -> list[str]:
        image_urls: list[str] = []
        for output in outputs.values():
            for image in output.get("images", []):
                filename = image.get("filename")
                subfolder = image.get("subfolder", "")
                image_type = image.get("type", "output")
                if filename:
                    image_urls.append(
                        f"/view?filename={filename}&subfolder={subfolder}&type={image_type}"
                    )
        return image_urls

    def _mock_image(self, panel_id: str) -> str:
        svg = f"""
        <svg xmlns='http://www.w3.org/2000/svg' width='720' height='420'>
          <rect width='100%' height='100%' fill='#f8f3ea'/>
          <rect x='24' y='24' width='672' height='372' fill='none' stroke='#171412' stroke-width='6'/>
          <text x='48' y='92' font-size='32' font-family='Arial' fill='#171412'>Mock Render Ready</text>
          <text x='48' y='144' font-size='20' font-family='Arial' fill='#6f665d'>Panel {panel_id}</text>
          <text x='48' y='190' font-size='18' font-family='Arial' fill='#6f665d'>Replace this with ComfyUI output when the worker is connected.</text>
        </svg>
        """.strip()
        return "data:image/svg+xml;utf8," + svg.replace("\n", "").replace("  ", " ")


generation_orchestrator = GenerationOrchestrator()
