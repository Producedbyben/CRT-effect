# CRT Effect Renderer (Modular App + API Stubs)

This project now includes a modular structure for ingest/composer/render/templates/ui while preserving the original CRT preview/export lab.

## Module structure

- `src/ingest` → MP4 upload validation + metadata extraction helpers.
- `src/composer` → timeline builder and `OverlayLayer` helpers.
- `src/render` → async render queue integration stub.
- `src/templates` → ranking/scoreboard presets.
- `src/ui` → frontend route logic for **New Project** and editor shell.
- `src/domain` → shared `ProjectSession` and `OverlayLayer` model.
- `server/api.js` → upload endpoint, `ProjectSession` creation, render job queue endpoints.

## Run the app

```bash
npm run start:ui
```

Open `http://localhost:8080/#/new-project`.

## Run the API

```bash
npm run start:api
```

API base is `http://localhost:8787` with stubs:

- `POST /api/upload` accepts raw `video/mp4`, validates container/codec hint, stores file.
- `POST /api/project-sessions` creates a `ProjectSession`.
- `POST /api/render-jobs` queues async render job.
- `GET /api/render-jobs` lists queued jobs.

## Notes

- The **New Project** route includes upload + editor shell placeholders for future timeline/overlay tooling.
- CRT image preview/export remains available at `#/crt-lab`.
