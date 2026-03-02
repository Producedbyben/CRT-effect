const FALLBACK_PRESETS = {
  "Consumer TV": {
    scanlineStrength: 0.45,
    phosphorMask: 0.36,
    barrelDistortion: 0.04,
    bloom: 0.45,
    flicker: 0.26,
    chromaticAberration: 0.3,
    noise: 0.34,
  },
  "PVM/BVM": {
    scanlineStrength: 0.25,
    phosphorMask: 0.6,
    barrelDistortion: 0.08,
    bloom: 0.2,
    flicker: 0.12,
    chromaticAberration: 0.08,
    noise: 0.16,
  },
  Arcade: {
    scanlineStrength: 0.4,
    phosphorMask: 0.45,
    barrelDistortion: 0.12,
    bloom: 0.55,
    flicker: 0.2,
    chromaticAberration: 0.2,
    noise: 0.3,
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
    this.fitCanvas = document.createElement("canvas");
    this.workCanvas = document.createElement("canvas");
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

  sampleBilinear(data, width, height, u, v, channel) {
    const x = Math.max(0, Math.min(width - 1, u * (width - 1)));
    const y = Math.max(0, Math.min(height - 1, v * (height - 1)));
    const x0 = Math.floor(x);
    const x1 = Math.min(width - 1, x0 + 1);
    const y0 = Math.floor(y);
    const y1 = Math.min(height - 1, y0 + 1);
    const tx = x - x0;
    const ty = y - y0;

    const i00 = (y0 * width + x0) * 4 + channel;
    const i10 = (y0 * width + x1) * 4 + channel;
    const i01 = (y1 * width + x0) * 4 + channel;
    const i11 = (y1 * width + x1) * 4 + channel;

    const a = data[i00] * (1 - tx) + data[i10] * tx;
    const b = data[i01] * (1 - tx) + data[i11] * tx;
    return a * (1 - ty) + b * ty;
  }

  render(outCtx, width, height, seconds, params, frameIndex, fps) {
    outCtx.clearRect(0, 0, width, height);
    outCtx.fillStyle = "black";
    outCtx.fillRect(0, 0, width, height);
    if (!this.hasImage) return;

    this.fitCanvas.width = width;
    this.fitCanvas.height = height;
    const fitCtx = this.fitCanvas.getContext("2d", { willReadFrequently: true });
    fitCtx.clearRect(0, 0, width, height);
    fitCtx.imageSmoothingEnabled = true;
    fitCtx.imageSmoothingQuality = "high";

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

    fitCtx.drawImage(src, sx, sy, sw, sh, 0, 0, width, height);

    this.workCanvas.width = width;
    this.workCanvas.height = height;
    const wctx = this.workCanvas.getContext("2d", { willReadFrequently: true });
    const srcPixels = fitCtx.getImageData(0, 0, width, height);
    const outPixels = wctx.createImageData(width, height);
    const srcData = srcPixels.data;
    const dstData = outPixels.data;

    const barrel = params.barrelDistortion;
    const ca = params.chromaticAberration;
    const scan = params.scanlineStrength;
    const mask = params.phosphorMask;
    const frameSeconds = frameIndex / fps;
    const flickerWaveA = Math.sin(frameSeconds * Math.PI * 2 * 1.94) * 0.5 + 0.5;
    const flickerWaveB = Math.sin(frameSeconds * Math.PI * 2 * 0.61 + 1.7) * 0.5 + 0.5;
    const globalRefresh = 1 + params.flicker * (0.14 * (0.65 * flickerWaveA + 0.35 * flickerWaveB));
    const retraceY = ((frameSeconds * 1.45) % 1) * height;
    const retraceBand = Math.max(4, Math.floor(height * 0.014));

    for (let y = 0; y < height; y++) {
      const ny = (y / (height - 1)) * 2 - 1;
      const scanPhase = 0.5 + 0.5 * Math.cos((y + 0.5) * Math.PI);
      const scanlineGain = 1 - scan * (0.3 + 0.7 * scanPhase);
      const dyRetrace = (y - retraceY) / retraceBand;
      const retraceGain = 1 + params.flicker * 0.2 * Math.exp(-(dyRetrace * dyRetrace));

      for (let x = 0; x < width; x++) {
        const nx = (x / (width - 1)) * 2 - 1;
        const r2 = nx * nx + ny * ny;
        const warp = 1 + barrel * (0.28 + 0.72 * r2);
        const srcNx = nx / warp;
        const srcNy = ny / warp;
        const u = srcNx * 0.5 + 0.5;
        const v = srcNy * 0.5 + 0.5;

        const outIndex = (y * width + x) * 4;
        if (u < 0 || u > 1 || v < 0 || v > 1) {
          dstData[outIndex] = 0;
          dstData[outIndex + 1] = 0;
          dstData[outIndex + 2] = 0;
          dstData[outIndex + 3] = 255;
          continue;
        }

        const edgeShift = ca * (0.0012 + r2 * 0.0045);
        const ru = u + edgeShift * (0.7 + Math.abs(nx));
        const gu = u;
        const bu = u - edgeShift * (0.7 + Math.abs(nx));

        const red = this.sampleBilinear(srcData, width, height, ru, v, 0);
        const green = this.sampleBilinear(srcData, width, height, gu, v, 1);
        const blue = this.sampleBilinear(srcData, width, height, bu, v, 2);

        const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        const emissive = Math.max(0, (luma - 6) / 249);
        if (emissive <= 0) {
          dstData[outIndex] = 0;
          dstData[outIndex + 1] = 0;
          dstData[outIndex + 2] = 0;
          dstData[outIndex + 3] = 255;
          continue;
        }

        const cellX = (x + (y % 2) * 0.35) % 3;
        const cellY = ((y + 0.5) % 2) - 0.5;
        const sigmaX = 0.34 - mask * 0.1;
        const sigmaY = 0.27 - mask * 0.08;
        const spot = (center) => {
          const dx = cellX - center;
          return Math.exp(-((dx * dx) / (2 * sigmaX * sigmaX) + (cellY * cellY) / (2 * sigmaY * sigmaY)));
        };

        const baseGap = 0.015;
        const rMask = baseGap + (0.32 + mask * 1.05) * spot(0.5);
        const gMask = baseGap + (0.32 + mask * 1.05) * spot(1.5);
        const bMask = baseGap + (0.32 + mask * 1.05) * spot(2.5);

        const localFlutter = 1 + params.flicker * 0.1 * (seededNoise(x * 0.7, y * 1.3, frameIndex) - 0.5);
        const temporalGain = scanlineGain * retraceGain * globalRefresh * localFlutter;

        const grain = (seededNoise(x * 1.9, y * 1.4 + frameSeconds * 60, frameIndex) - 0.5) * 65 * params.noise;
        const gate = Math.min(1, emissive * 1.35);

        dstData[outIndex] = Math.min(255, Math.max(0, red * rMask * temporalGain + grain * gate));
        dstData[outIndex + 1] = Math.min(255, Math.max(0, green * gMask * temporalGain + grain * gate));
        dstData[outIndex + 2] = Math.min(255, Math.max(0, blue * bMask * temporalGain + grain * gate));
        dstData[outIndex + 3] = 255;
      }
    }

    wctx.putImageData(outPixels, 0, 0);
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = "high";
    outCtx.drawImage(this.workCanvas, 0, 0);

    const bloom = params.bloom;
    if (bloom > 0) {
      outCtx.save();
      outCtx.globalAlpha = bloom * 0.38;
      outCtx.filter = `blur(${1 + bloom * 7}px) brightness(${1 + bloom * 0.35})`;
      outCtx.drawImage(outCtx.canvas, 0, 0);
      outCtx.restore();
    }

    const vignette = Math.min(0.35, 0.08 + barrel * 0.22);
    const grad = outCtx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * 0.22,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.6,
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${vignette.toFixed(3)})`);
    outCtx.fillStyle = grad;
    outCtx.fillRect(0, 0, width, height);

    const jitterPx = params.flicker * (seededNoise(frameIndex, seconds, 17) - 0.5) * 1.8;
    if (Math.abs(jitterPx) > 0.01) {
      outCtx.save();
      outCtx.globalAlpha = Math.min(0.1, 0.03 + params.flicker * 0.08);
      outCtx.drawImage(outCtx.canvas, jitterPx, 0);
      outCtx.restore();
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
