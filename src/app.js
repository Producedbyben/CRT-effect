const FALLBACK_PRESETS = {
  "Consumer TV": {
    scanlineStrength: 0.45,
    phosphorMask: 0.36,
    barrelDistortion: 0.28,
    bloom: 0.45,
    flicker: 0.1,
    chromaticAberration: 0.3,
    noise: 0.2,
  },
  "PVM/BVM": {
    scanlineStrength: 0.25,
    phosphorMask: 0.6,
    barrelDistortion: 0.08,
    bloom: 0.2,
    flicker: 0.04,
    chromaticAberration: 0.08,
    noise: 0.07,
  },
  Arcade: {
    scanlineStrength: 0.4,
    phosphorMask: 0.45,
    barrelDistortion: 0.22,
    bloom: 0.55,
    flicker: 0.08,
    chromaticAberration: 0.2,
    noise: 0.12,
  },
};

const MP4_MUXER_CDN = "https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.2/build/mp4-muxer.mjs";

function seededNoise(x, y, frame) {
  const v = Math.sin(x * 12.9898 + y * 78.233 + frame * 19.17) * 43758.5453;
  return v - Math.floor(v);
}

class CRTRenderer {
  constructor() {
    this.sourceCanvas = document.createElement("canvas");
    this.workCanvas = document.createElement("canvas");
    this.maskCanvas = document.createElement("canvas");
    this.maskPattern = null;
    this.hasImage = false;
  }

  setImage(img) {
    this.sourceCanvas.width = img.naturalWidth || img.videoWidth || img.width;
    this.sourceCanvas.height = img.naturalHeight || img.videoHeight || img.height;
    const ctx = this.sourceCanvas.getContext("2d");
    ctx.clearRect(0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
    ctx.drawImage(img, 0, 0);
    this.hasImage = true;
  }

  ensureMaskPattern(ctx, strength) {
    this.maskCanvas.width = 3;
    this.maskCanvas.height = 1;
    const mctx = this.maskCanvas.getContext("2d");
    const alpha = Math.min(0.6, strength * 0.8);
    mctx.clearRect(0, 0, 3, 1);
    mctx.fillStyle = `rgba(255, 80, 80, ${alpha})`;
    mctx.fillRect(0, 0, 1, 1);
    mctx.fillStyle = `rgba(80, 255, 80, ${alpha})`;
    mctx.fillRect(1, 0, 1, 1);
    mctx.fillStyle = `rgba(80, 150, 255, ${alpha})`;
    mctx.fillRect(2, 0, 1, 1);
    this.maskPattern = ctx.createPattern(this.maskCanvas, "repeat");
  }

  render(outCtx, width, height, seconds, params, frameIndex, fps) {
    outCtx.clearRect(0, 0, width, height);
    outCtx.fillStyle = "black";
    outCtx.fillRect(0, 0, width, height);
    if (!this.hasImage) return;

    this.workCanvas.width = width;
    this.workCanvas.height = height;
    const wctx = this.workCanvas.getContext("2d", { willReadFrequently: true });
    wctx.clearRect(0, 0, width, height);

    const src = this.sourceCanvas;
    const srcAspect = src.width / src.height;
    const dstAspect = width / height;
    let sw = src.width;
    let sh = src.height;
    let sx = 0;
    let sy = 0;

    if (srcAspect > dstAspect) {
      sw = src.height * dstAspect;
      sx = (src.width - sw) / 2;
    } else {
      sh = src.width / dstAspect;
      sy = (src.height - sh) / 2;
    }

    const barrel = params.barrelDistortion;
    for (let y = 0; y < height; y++) {
      const ny = (y / (height - 1)) * 2 - 1;
      const curve = 1 + barrel * ny * ny;
      const lineW = width / curve;
      const dx = (width - lineW) / 2;
      const srcY = sy + (y / height) * sh;
      wctx.drawImage(src, sx, srcY, sw, sh / height, dx, y, lineW, 1);
    }

    if (params.chromaticAberration > 0) {
      const shift = 1 + params.chromaticAberration * 4;
      wctx.globalCompositeOperation = "screen";
      wctx.globalAlpha = params.chromaticAberration * 0.55;
      wctx.filter = "sepia(1) saturate(6) hue-rotate(-35deg)";
      wctx.drawImage(this.workCanvas, shift, 0);
      wctx.filter = "sepia(1) saturate(6) hue-rotate(180deg)";
      wctx.drawImage(this.workCanvas, -shift, 0);
      wctx.filter = "none";
      wctx.globalCompositeOperation = "source-over";
      wctx.globalAlpha = 1;
    }

    outCtx.drawImage(this.workCanvas, 0, 0);

    const scan = params.scanlineStrength;
    outCtx.fillStyle = `rgba(0,0,0,${0.06 + scan * 0.5})`;
    for (let y = 0; y < height; y += 2) outCtx.fillRect(0, y, width, 1);

    this.ensureMaskPattern(outCtx, params.phosphorMask);
    outCtx.globalAlpha = params.phosphorMask;
    outCtx.fillStyle = this.maskPattern;
    outCtx.fillRect(0, 0, width, height);
    outCtx.globalAlpha = 1;

    const bloom = params.bloom;
    if (bloom > 0) {
      outCtx.save();
      outCtx.globalAlpha = bloom * 0.5;
      outCtx.filter = `blur(${1 + bloom * 6}px) brightness(${1 + bloom * 0.45})`;
      outCtx.drawImage(outCtx.canvas, 0, 0);
      outCtx.restore();
    }

    const flickerWave = Math.sin((frameIndex / fps) * Math.PI * 2 * 2.1) * 0.5 + 0.5;
    const flicker = params.flicker * (0.35 + flickerWave * 0.65);
    outCtx.fillStyle = `rgba(255,255,255,${flicker * 0.12})`;
    outCtx.fillRect(0, 0, width, height);

    if (params.noise > 0) {
      const count = Math.floor(width * height * 0.003 * params.noise);
      for (let i = 0; i < count; i++) {
        const x = Math.floor(seededNoise(i, seconds, frameIndex) * width);
        const y = Math.floor(seededNoise(i * 2, seconds + 3.1, frameIndex) * height);
        const a = seededNoise(x, y, frameIndex) * 0.2 * params.noise;
        outCtx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        outCtx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportMp4({ canvas, renderer, params, fps, duration, onProgress }) {
  if (!("VideoEncoder" in window)) {
    throw new Error("WebCodecs VideoEncoder is unavailable in this browser/context.");
  }

  const { Muxer, ArrayBufferTarget } = await import(MP4_MUXER_CDN);
  const width = canvas.width;
  const height = canvas.height;
  const totalFrames = Math.max(1, Math.floor(duration * fps));
  const ctx = canvas.getContext("2d");

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width, height },
    fastStart: "in-memory",
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      throw err;
    },
  });

  encoder.configure({
    codec: "avc1.42001f",
    width,
    height,
    framerate: fps,
    bitrate: 5_000_000,
    latencyMode: "quality",
  });

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / fps;
    renderer.render(ctx, width, height, t, params, frame, fps);
    const videoFrame = new VideoFrame(canvas, {
      timestamp: Math.round((frame * 1_000_000) / fps),
      duration: Math.round(1_000_000 / fps),
    });
    encoder.encode(videoFrame);
    videoFrame.close();
    onProgress?.((frame + 1) / totalFrames, frame + 1, totalFrames);

    if (frame % 30 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  await encoder.flush();
  muxer.finalize();

  const blob = new Blob([target.buffer], { type: "video/mp4" });
  downloadBlob(blob, `crt-export-${Date.now()}.mp4`);
}

(function boot() {
  const renderer = new CRTRenderer();
  const canvas = document.getElementById("previewCanvas");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const progressEl = document.getElementById("progress");
  const exportBtn = document.getElementById("exportBtn");
  const presetSelect = document.getElementById("presetSelect");

  const controlIds = [
    "scanlineStrength",
    "phosphorMask",
    "barrelDistortion",
    "bloom",
    "flicker",
    "chromaticAberration",
    "noise",
  ];

  let hasLoadedImage = false;
  const presets = { ...FALLBACK_PRESETS };
  let start = performance.now();

  function setStatus(message, mode = "info") {
    statusEl.textContent = message;
    statusEl.dataset.mode = mode;
  }

  function setExportAvailability() {
    exportBtn.disabled = !hasLoadedImage;
  }

  function readParams() {
    return Object.fromEntries(controlIds.map((id) => [id, Number(document.getElementById(id).value)]));
  }

  function applyPreset(name) {
    const values = presets[name];
    if (!values) return;
    for (const id of controlIds) {
      if (typeof values[id] === "number") {
        document.getElementById(id).value = values[id];
      }
    }
  }

  function initializePresets() {
    const names = Object.keys(presets);
    presetSelect.innerHTML = "";

    if (names.length === 0) {
      const opt = document.createElement("option");
      opt.textContent = "No presets available";
      opt.disabled = true;
      opt.selected = true;
      presetSelect.appendChild(opt);
      return;
    }

    for (const name of names) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      presetSelect.appendChild(opt);
    }

    const defaultPreset = presets["Consumer TV"] ? "Consumer TV" : names[0];
    presetSelect.value = defaultPreset;
    applyPreset(defaultPreset);
  }

  async function loadImageFromFile(file) {
    if ("createImageBitmap" in window) {
      try {
        return await createImageBitmap(file);
      } catch (error) {
        console.warn("createImageBitmap failed; falling back to Image.decode", error);
      }
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    try {
      await img.decode();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
    return img;
  }

  function animate(now) {
    const fps = Math.max(1, Number(document.getElementById("fps").value) || 60);
    const elapsed = (now - start) / 1000;
    const frame = Math.floor(elapsed * fps);
    renderer.render(ctx, canvas.width, canvas.height, frame / fps, readParams(), frame, fps);
    requestAnimationFrame(animate);
  }

  document.getElementById("imageInput").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    progressEl.value = 0.05;
    setStatus(`Processing ${file.name} (${Math.round(file.size / 1024)} KB)...`, "info");

    try {
      const imageSource = await loadImageFromFile(file);
      progressEl.value = 0.4;
      renderer.setImage(imageSource);
      if (typeof imageSource.close === "function") imageSource.close();
      progressEl.value = 1;
      hasLoadedImage = true;
      setExportAvailability();
      start = performance.now();
      setStatus(`Loaded ${file.name}. Ready to export.`, "success");
    } catch (error) {
      hasLoadedImage = false;
      progressEl.value = 0;
      setExportAvailability();
      setStatus(`Couldn't load image: ${error.message}`, "error");
      console.error(error);
    }
  });

  presetSelect.addEventListener("change", () => {
    applyPreset(presetSelect.value);
    progressEl.value = 0;
    setStatus(`Preset applied: ${presetSelect.value}`, "success");
  });

  exportBtn.addEventListener("click", async () => {
    if (!hasLoadedImage) {
      setStatus("Load an image before exporting.", "warn");
      return;
    }

    try {
      exportBtn.disabled = true;
      progressEl.value = 0;
      setStatus("Preparing export...", "info");
      await exportMp4({
        canvas,
        renderer,
        params: readParams(),
        fps: Math.max(1, Number(document.getElementById("fps").value) || 60),
        duration: Math.max(0.5, Number(document.getElementById("duration").value) || 4),
        onProgress: (value, current, total) => {
          progressEl.value = value;
          setStatus(`Encoding frame ${current}/${total}`, "info");
        },
      });
      setStatus("Export finished. Download should begin automatically.", "success");
    } catch (error) {
      setStatus(`Export failed: ${error.message}`, "error");
      console.error(error);
    } finally {
      setExportAvailability();
    }
  });

  for (const id of [...controlIds, "fps", "duration"]) {
    document.getElementById(id).addEventListener("input", () => {
      progressEl.value = 0;
    });
  }

  setExportAvailability();
  initializePresets();
  setStatus("Load an image to begin.", "info");
  requestAnimationFrame(animate);
})();
