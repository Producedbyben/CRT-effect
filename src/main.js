import { CRTRenderer } from "./crt-renderer.js";
import { exportMp4 } from "./exporter.js";
import { PRESETS } from "./presets.js";

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

function setExportAvailability() {
  exportBtn.disabled = !hasLoadedImage;
}

function initializePresets() {
  const names = Object.keys(PRESETS);
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

  const defaultPreset = PRESETS["Consumer TV"] ? "Consumer TV" : names[0];
  presetSelect.value = defaultPreset;
  applyPreset(defaultPreset);
}

function readParams() {
  return Object.fromEntries(controlIds.map((id) => [id, Number(document.getElementById(id).value)]));
}

function applyPreset(name) {
  const values = PRESETS[name];
  if (!values) return;
  for (const id of controlIds) {
    if (typeof values[id] === "number") {
      document.getElementById(id).value = values[id];
    }
  }
}

async function loadImageFromFile(file) {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file);
  }

  const img = new Image();
  img.src = URL.createObjectURL(file);
  try {
    await img.decode();
  } finally {
    URL.revokeObjectURL(img.src);
  }
  return img;
}

presetSelect.addEventListener("change", () => applyPreset(presetSelect.value));
initializePresets();

const fpsInput = document.getElementById("fps");
const durationInput = document.getElementById("duration");
let start = performance.now();

function animate(now) {
  const fps = Math.max(1, Number(fpsInput.value) || 60);
  const elapsed = (now - start) / 1000;
  const frame = Math.floor(elapsed * fps);
  renderer.render(ctx, canvas.width, canvas.height, frame / fps, readParams(), frame, fps);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

const imageInput = document.getElementById("imageInput");
imageInput.addEventListener("change", async () => {
  const file = imageInput.files?.[0];
  if (!file) return;

  statusEl.textContent = `Loading ${file.name}...`;
  try {
    const imageSource = await loadImageFromFile(file);
    renderer.setImage(imageSource);
    if (typeof imageSource.close === "function") imageSource.close();
    hasLoadedImage = true;
    setExportAvailability();
    start = performance.now();
    statusEl.textContent = `Loaded ${file.name}`;
  } catch (error) {
    hasLoadedImage = false;
    setExportAvailability();
    statusEl.textContent = `Couldn't load image: ${error.message}`;
    console.error(error);
  }
});

for (const id of [...controlIds, "fps", "duration"]) {
  document.getElementById(id).addEventListener("input", () => {
    progressEl.value = 0;
  });
}

exportBtn.addEventListener("click", async () => {
  if (!hasLoadedImage) {
    statusEl.textContent = "Load an image before exporting.";
    return;
  }

  try {
    exportBtn.disabled = true;
    progressEl.value = 0;
    statusEl.textContent = "Preparing export...";
    await exportMp4({
      canvas,
      renderer,
      params: readParams(),
      fps: Math.max(1, Number(fpsInput.value) || 60),
      duration: Math.max(0.5, Number(durationInput.value) || 4),
      onProgress: (value, current, total) => {
        progressEl.value = value;
        statusEl.textContent = `Encoding frame ${current}/${total}`;
      },
    });
    statusEl.textContent = "Export finished. Download should begin automatically.";
  } catch (error) {
    statusEl.textContent = `Export failed: ${error.message}`;
    console.error(error);
  } finally {
    setExportAvailability();
  }
});

setExportAvailability();
