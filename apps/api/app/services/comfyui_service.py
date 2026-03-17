from uuid import uuid4

import httpx

from app.core.config import get_settings


class ComfyUIService:
    def __init__(self) -> None:
        self.settings = get_settings()

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
                return response.json()
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


comfyui_service = ComfyUIService()

