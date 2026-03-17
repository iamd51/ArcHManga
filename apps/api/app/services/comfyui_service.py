from uuid import uuid4

import httpx

from app.core.config import get_settings
from app.schemas.comic import ComfyObjectInfoSummary, ComfyQueue, ComfyStatus, ModelOption


MODEL_ENDPOINTS = {
    "checkpoint": "checkpoints",
    "lora": "loras",
    "controlnet": "controlnet",
    "embedding": "embeddings",
}


class ComfyUIService:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def get_status(self) -> ComfyStatus:
        available_endpoints: list[str] = []
        model_counts: dict[str, int] = {}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                for kind, endpoint in MODEL_ENDPOINTS.items():
                    response = await client.get(f"{self.settings.comfyui_base_url}/models/{endpoint}")
                    if response.is_success:
                        available_endpoints.append(f"/models/{endpoint}")
                        payload = response.json()
                        if isinstance(payload, list):
                            model_counts[kind] = len(payload)
                        elif isinstance(payload, dict):
                            model_counts[kind] = len(payload.keys())
                object_info = await client.get(f"{self.settings.comfyui_base_url}/object_info")
                if object_info.is_success:
                    available_endpoints.append("/object_info")
                return ComfyStatus(
                    connected=True,
                    base_url=self.settings.comfyui_base_url,
                    available_endpoints=available_endpoints,
                    model_counts=model_counts,
                    detail="Connected to ComfyUI.",
                )
        except Exception as exc:
            return ComfyStatus(
                connected=False,
                base_url=self.settings.comfyui_base_url,
                detail=f"ComfyUI unavailable: {exc}",
            )

    async def get_available_models(self) -> list[ModelOption]:
        synced_models: list[ModelOption] = []
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                for kind, endpoint in MODEL_ENDPOINTS.items():
                    response = await client.get(f"{self.settings.comfyui_base_url}/models/{endpoint}")
                    response.raise_for_status()
                    payload = response.json()
                    names: list[str]
                    if isinstance(payload, list):
                        names = [str(item) for item in payload]
                    elif isinstance(payload, dict):
                        names = [str(item) for item in payload.keys()]
                    else:
                        names = []
                    for name in names:
                        synced_models.append(
                            ModelOption(
                                id=name,
                                label=name,
                                kind=kind,
                                tags=[endpoint, "comfyui-sync"],
                            )
                        )
        except Exception:
            return []
        return synced_models

    async def get_queue(self) -> ComfyQueue:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.settings.comfyui_base_url}/queue")
                response.raise_for_status()
                payload = response.json()
                running = payload.get("queue_running", []) if isinstance(payload, dict) else []
                pending = payload.get("queue_pending", []) if isinstance(payload, dict) else []
                return ComfyQueue(
                    running_count=len(running),
                    pending_count=len(pending),
                    running_prompt_ids=[str(item[1]) for item in running if isinstance(item, list) and len(item) > 1],
                    pending_prompt_ids=[str(item[1]) for item in pending if isinstance(item, list) and len(item) > 1],
                    detail="Fetched ComfyUI queue state.",
                )
        except Exception as exc:
            return ComfyQueue(detail=f"Queue unavailable: {exc}")

    async def get_object_info_summary(self) -> ComfyObjectInfoSummary:
        try:
            payload = await self.get_object_info()
            if not isinstance(payload, dict):
                return ComfyObjectInfoSummary()
            node_names = sorted(str(name) for name in payload.keys())
            sample_inputs: dict[str, list[str]] = {}
            for node_name in node_names[:8]:
                node = payload.get(node_name, {})
                inputs = node.get("input", {}) if isinstance(node, dict) else {}
                required = inputs.get("required", {}) if isinstance(inputs, dict) else {}
                optional = inputs.get("optional", {}) if isinstance(inputs, dict) else {}
                input_names = list(required.keys()) + list(optional.keys())
                sample_inputs[node_name] = input_names[:8]
            return ComfyObjectInfoSummary(
                node_count=len(node_names),
                node_names=node_names[:64],
                sample_inputs=sample_inputs,
            )
        except Exception:
            return ComfyObjectInfoSummary()

    async def get_object_info(self) -> dict:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(f"{self.settings.comfyui_base_url}/object_info")
                response.raise_for_status()
                payload = response.json()
                return payload if isinstance(payload, dict) else {}
        except Exception:
            return {}

    async def interrupt(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(f"{self.settings.comfyui_base_url}/interrupt")
                response.raise_for_status()
                return True
        except Exception:
            return False

    async def submit_prompt(self, workflow_payload: dict) -> dict:
        body = {
            "prompt": workflow_payload,
            "client_id": self.settings.comfyui_client_id,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.settings.comfyui_base_url}/prompt",
                    json=body,
                )
                response.raise_for_status()
                payload = response.json()
                payload["mode"] = "comfyui"
                return payload
        except Exception:
            return {
                "prompt_id": f"mock-{uuid4()}",
                "number": 0,
                "node_errors": {},
                "mode": "mock",
            }

    async def get_history(self, prompt_id: str) -> dict:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{self.settings.comfyui_base_url}/history/{prompt_id}"
                )
                response.raise_for_status()
                return response.json()
        except Exception:
            return {"prompt_id": prompt_id, "outputs": [], "mode": "mock"}

    def build_view_url(self, filename: str, subfolder: str = "", image_type: str = "output") -> str:
        base = self.settings.comfyui_base_url.rstrip("/")
        return f"{base}/view?filename={filename}&subfolder={subfolder}&type={image_type}"


comfyui_service = ComfyUIService()
