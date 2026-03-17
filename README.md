# ArcHManga

ArcHManga is a manga creation workspace built around three ideas:

- a page editor with draggable comic panels
- a generation orchestrator that can target ComfyUI workflows
- a prompt service that can use Qwen to keep scene and character context consistent

## Ordered Roadmap

These next five items are fixed in priority order and should be implemented sequentially:

1. `scene continuity draft`
2. `real ComfyUI workflow integration`
3. `panel/page/project persistence`
4. `character reference management UI`
5. `PNG/PDF export`

## Current Prototype Scope

The workspace already includes:

- a Next.js comic page editor with draggable and resizable panels
- workflow preset switching for black-and-white and color SDXL pipelines
- workflow import from ComfyUI API-format JSON
- node-level workflow mapping for prompt, seed, reference image, and adapter weight inputs
- per-panel generation settings such as seed, steps, CFG, sampler, and scene memory
- continuity drafting from the previous panel into the current panel prompt fields
- a character bible with consistency anchors, adapter settings, and reference image uploads
- workflow mapping can target multi-character slots such as slot 1 / slot 2 for adapter inputs
- scene memory can be edited and persisted independently of panel prompts
- default SDXL workflow presets now include adapter nodes that receive reference image and weight bindings
- FastAPI endpoints for bootstrap project data, prompt preview, generation submit, and job polling
- a mock ComfyUI completion path so the end-to-end UX can be tested before a real worker is connected

## Workspace Layout

- `apps/web`: Next.js editor UI
- `apps/api`: FastAPI orchestration service
- `packages/shared`: shared TypeScript models for the editor

## Product Direction

The editor treats each panel as an independent generation surface with:

- model and workflow selection
- panel-level prompt and negative prompt
- scene continuation helpers
- character consistency hooks
- black-and-white or color generation modes

## Getting Started

### 1. Frontend

```bash
npm install
npm run dev:web
```

### 2. API

```bash
cd apps/api
pip install -e .
uvicorn app.main:app --reload
```

The frontend expects the API at `http://127.0.0.1:8000/api` by default. Override it with
`NEXT_PUBLIC_API_BASE_URL` if needed.

## Environment

Copy `apps/api/.env.example` to `apps/api/.env` and set:

- `COMFYUI_BASE_URL`
- `COMFYUI_CLIENT_ID`
- `QWEN_API_BASE_URL`
- `QWEN_API_KEY`
- `QWEN_MODEL`

If those are not configured, the API still works in local mock mode so the editor flow can be built first.

## Storage

The API writes imported workflow JSON files and uploaded character references into `apps/api/storage/`.
Uploaded references are served back under `/static/...`.
Imported and edited workflow presets are snapshot-saved under `apps/api/storage/workflows/`.
Character metadata and adapter settings are snapshot-saved under `apps/api/storage/characters.json`.
Scene memories are snapshot-saved under `apps/api/storage/scene-memories.json`.

## Verification

Verified locally in this workspace:

- `npm run build:web`
- `npm run lint:web`
- FastAPI bootstrap, prompt preview, generation submit, and polling via `TestClient`
- workflow import and character reference upload via `TestClient`
- character profile persistence and multi-character slot mapping via `TestClient`
- scene memory persistence and default adapter-node payload binding via `TestClient`
- continuity draft endpoint plus previous-panel carryover via `TestClient`
