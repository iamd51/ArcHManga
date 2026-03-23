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
- node-level workflow mapping also supports regeneration-oriented sources such as `source_image_url` and `denoise`
- per-panel generation settings such as seed, steps, CFG, sampler, and scene memory
- continuity drafting from the previous panel into the current panel prompt fields
- a character bible with consistency anchors, adapter settings, and reference image uploads
- workflow mapping can target multi-character slots such as slot 1 / slot 2 for adapter inputs
- scene memory can be edited and persisted independently of panel prompts
- default SDXL workflow presets now include adapter nodes that receive reference image and weight bindings
- the editor can poll ComfyUI status and sync real model lists from a running ComfyUI server
- the editor can inspect ComfyUI queue state, sample node info, and cancel the active generation job
- imported or selected workflows can be validated against live ComfyUI `object_info` before use
- workflow validation now reports unknown node types, missing custom nodes, and recommended binding gaps
- page, panel, and whole-project snapshots can now be saved and reloaded through FastAPI
- character references can be edited, marked for adapter use, promoted to primary, and deleted from the inspector
- the editor can export the current page as a clean PNG or PDF render
- the editor now includes an AI director console that turns natural-language requests into panel drafts and storyboard beats
- director requests now include working memory from the selected panel, previous beat, scene continuity, and the last director response
- the AI director can now apply the latest panel draft and submit that panel directly into the ComfyUI generation flow
- panel prompts now carry structured revision intent such as keep composition, keep background, and edit priority
- the inspector and director flow now support conversational regeneration controls like "only change expression" while preserving continuity locks
- img2img-capable workflows can now bind the current panel render back into ComfyUI and receive a computed regeneration denoise
- panels now support a persisted rectangular inpaint mask, and inpaint-capable workflows can bind it as `mask_image_url`
- the page canvas now lets you visually drag and resize the active inpaint mask instead of only editing numeric percentages
- the AI director and inspector now share reusable mask templates such as face focus, half body, and detail spot
- director mask suggestions now bias those templates using shot type plus left/right/center prompt cues
- the project now ships with dedicated black-and-white and color regeneration presets, and bootstrap data will backfill them into older saved projects
- prompt preview now computes a panel-level consistency plan with readiness score, selected references, and drift warnings
- workflow payloads now resolve shot-aware character references automatically instead of always taking the first adapter image
- workflow mappings can now target explicit role-based references such as face, full-body, outfit, and expression anchors
- the inspector now surfaces a consistency preflight state so weak character anchors are visible before you submit a render
- built-in SDXL workflows now chain multiple adapter stages so face, body, and outfit anchors can all participate in one generation pass
- successful renders now write a panel continuity snapshot so later beats can carry forward character state instead of relying only on the raw prompt
- prompt preview, preflight, and workflow payloads now pull forward the previous panel continuity snapshot so character outfit, expression, and framing locks influence the next render before generation starts
- the inspector now exposes carry-forward continuity locks so you can explicitly apply previous-panel outfit, expression, and framing state before generating the next panel
- new panels, new pages, and storyboard-applied beats now auto-seed continuity defaults from the previous beat so the first draft starts closer to a stable character state
- panels now expose explicit continuity toggles for appearance, wardrobe, expression, and camera framing so the artist can decide exactly what should persist across beats
- built-in workflows now map face/body/outfit adapter weights to continuity-aware sources so those panel locks affect the actual ComfyUI payload, not only the prompt text
- continuity-aware adapter weights are now resolved per character slot, so multi-character panels can keep different appearance, wardrobe, and expression lock strengths in the same workflow
- director and inspector can now assign continuity overrides per character, so one character can keep wardrobe locked while another is allowed to change expression in the same panel
- continuity suggestions and new-panel defaults now carry forward those character-specific overrides into add-panel, add-page, and storyboard flows
- inspector character cards now include one-click continuity presets such as full lock, allow expression, keep look plus outfit, and identity plus camera
- director fallback parsing now understands more natural multi-character commands such as full lock, allow-expression-only, and camera-stays-fixed phrasing
- inspector now exposes one-tap repair actions for expression, pose, camera, and lighting passes so local redraw setup does not require toggling every control manually
- those repair actions now also offer immediate regenerate shortcuts, making the shortest local-redraw path closer to one click after selecting the panel
- director drafts now emit an explicit quick-repair recipe so natural requests like expression fixes or camera restaging can jump straight into the matching regeneration flow
- director quick-repair drafts can now also name repair targets, and the suggested mask will bias toward the intended character in multi-character panels
- director repair targeting also understands positional phrasing such as left-side or right-side character cues when the user does not name the character directly
- director repair targeting now also carries frame cues such as foreground or background so mask suggestions can bias vertically even when no explicit character name is available
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
- shot-aware character consistency planning
- black-and-white or color generation modes

The current product focus is a conversational manga-director workflow:

- talk to the AI in natural language instead of filling every field manually
- let the director turn dialogue into panel prompts, scene updates, and storyboard beats
- preserve continuity automatically across adjacent panels and recurring characters
- move directly from a director draft into panel generation through ComfyUI
- keep explicit regeneration locks for composition, background, identity, and edit priority between turns
- automatically prefer regeneration workflows when a panel already has a render and the current request is a revision rather than a fresh draw
- use simple inpaint masks to constrain local redraws such as face-only or hand-only fixes
- adjust the inpaint area directly on the canvas while keeping the underlying panel layout intact
- let the director suggest a sensible mask template automatically for expression, pose, lighting, and prop-level fixes
- feed previous-panel continuity snapshots back into prompt planning and workflow binding so adjacent panels inherit proven character state instead of starting from raw references each time
- let the artist explicitly accept suggested continuity locks instead of hiding all carry-forward behavior behind automatic prompt assembly
- automatically backfill adjacent panels with the last known stable continuity state while still letting the artist override those locks explicitly
- keep continuity decisions legible and local to each panel instead of burying them inside only prompt text or hidden workflow state
- make continuity locks materially influence generation strength by routing them into adapter-weight decisions and regeneration denoise policy
- let multi-character panels keep separate continuity weight profiles per slot instead of forcing every character through one shared adapter-strength setting
- let the artist or director override continuity per character instead of only at panel level, which keeps ensemble scenes flexible without giving up identity stability
- keep those character-specific overrides alive when the next beat is created, so continuity rules do not silently reset between adjacent panels

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
Full project/page/panel state is snapshot-saved under `apps/api/storage/project.json`.

## Verification

Verified locally in this workspace:

- `npm run build:web`
- `npm run lint:web`
- FastAPI bootstrap, prompt preview, generation submit, and polling via `TestClient`
- workflow import and character reference upload via `TestClient`
- character profile persistence and multi-character slot mapping via `TestClient`
- scene memory persistence and default adapter-node payload binding via `TestClient`
- continuity draft endpoint plus previous-panel carryover via `TestClient`
- ComfyUI status and model sync routes via `TestClient`
- ComfyUI queue/object-info routes and generation cancel flow via `TestClient`
- workflow validation against sample `object_info`, recommended mappings, and missing custom nodes via `TestClient`
- full project persistence roundtrip via `PUT /api/projects/{projectId}` and `storage/project.json`
- character reference upload, metadata patch, and delete flow via `TestClient`
- director draft requests with structured continuity memory via `TestClient`
- director draft quick-repair recipe detection for natural repair phrasing via `TestClient`
- director quick-repair target detection for named characters via `TestClient`
- director quick-repair target detection for positional character phrasing via `TestClient`
- director quick-repair frame-cue detection for foreground/background phrasing via `TestClient`
- revision-intent prompt preview and director parsing checks via `TestClient`
- workflow regeneration bindings for `source_image_url` and computed `denoise` via Python checks
- bootstrap migration checks for newly added regeneration presets via `TestClient`
- rectangular inpaint-mask payload generation via Python checks
- previous-panel continuity snapshot carry-forward now affects preflight, prompt preview, and workflow payload generation
- continuity-lock suggestions can now be applied from the inspector and are also echoed into workflow `meta` for debugging downstream ComfyUI runs
- add-panel, add-page, and storyboard flows now prefill continuity-aware prompt, scene, shot, and lock defaults before generation
- explicit appearance/wardrobe/expression/camera toggles now flow through TypeScript models, FastAPI schemas, prompt preview, and director fallback hints
- workflow presets and imported binding recommendations now understand continuity-aware adapter weight sources such as appearance, wardrobe, and expression strength
- multi-character workflow payload checks now confirm slot 1 and slot 2 can receive different continuity-aware adapter weights in the same generation
- director fallback parsing and workflow payload checks now confirm per-character locks can change slot-specific continuity weights
