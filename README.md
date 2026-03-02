# CRT Effect Renderer (Local + Static Hosting)

A lightweight browser tool that loads an image, previews an animated CRT simulation, and exports an MP4 clip.

## Open locally

### Option A: open directly with `file://`
1. Double-click `index.html`.
2. Upload an image.
3. Tune controls and click **Export MP4**.

### Option B: static server (recommended)
```bash
python -m http.server 8080
```
Then open `http://localhost:8080`.

## Browser requirements

- Chromium-based browser recommended (Chrome/Edge 116+ preferred).
- Requires **WebCodecs** (`VideoEncoder`) for MP4 export.
- Requires network access the first time to fetch `mp4-muxer` from jsDelivr CDN.

## Known limitations

- `file://` mode can be stricter depending on browser security policies. If export fails in `file://`, use a local HTTP server.
- H.264 profile/codec support varies by OS/browser build.
- Large resolutions + long durations are CPU-intensive and may freeze the tab while encoding.

## CRT tuning tips

- **Consumer TV look**: increase barrel distortion, bloom, chromatic aberration, and moderate scanlines.
- **PVM/BVM look**: reduce barrel distortion and bloom, increase phosphor mask clarity, keep flicker/noise low.
- For subtle realism, keep noise under `0.2` and flicker under `0.15`.

## Effect pass order

1. Geometry warp (barrel distortion)
2. Shadow mask and scanlines
3. Bloom/glow
4. Temporal flicker and deterministic noise

Export and preview both use deterministic frame timing (`frameIndex / fps`) so visual timing remains consistent.
