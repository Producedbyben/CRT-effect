import { CRTRenderer } from "./crt-renderer.js";
import { exportMp4 } from "./exporter.js";
import { PRESETS } from "./presets.js";
import { setupNewProjectRoute } from "./ui/new-project-route.js";

function setupRoutes() {
  const routeTitle = document.getElementById("routeTitle");
  const newProjectScreen = document.getElementById("newProjectScreen");
  const crtLabScreen = document.getElementById("crtLabScreen");

  const render = () => {
    const hash = window.location.hash || "#/new-project";
    const isNewProject = hash.startsWith("#/new-project");
    newProjectScreen.hidden = !isNewProject;
    crtLabScreen.hidden = isNewProject;
    routeTitle.textContent = isNewProject ? "New Project" : "CRT Lab";
  };

  window.addEventListener("hashchange", render);
  render();
}

function setupCrtLab() {
  const canvas = document.getElementById("previewCanvas");
  if (!canvas) return;

  const renderer = new CRTRenderer();
  const ctx = canvas.getContext("2d");

  const statusEl = document.getElementById("status");
  const progressEl = document.getElementById("progress");
  const exportBtn = document.getElementById("exportBtn");
  const presetSelect = document.getElementById("presetSelect");

  const controlIds = ["scanlineStrength", "phosphorMask", "barrelDistortion", "bloom", "flicker", "chromaticAberration", "noise"];

  for (const name of Object.keys(PRESETS)) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    presetSelect.appendChild(opt);
  }

  function readParams() {
    return Object.fromEntries(controlIds.map((id) => [id, Number(document.getElementById(id).value)]));
  }

  function applyPreset(name) {
    const values = PRESETS[name];
    if (!values) return;
    for (const id of controlIds) {
      document.getElementById(id).value = values[id];
    }
  }

  presetSelect.addEventListener("change", () => applyPreset(presetSelect.value));
  presetSelect.value = "Consumer TV";
  applyPreset("Consumer TV");

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
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    renderer.setImage(img);
    start = performance.now();
    statusEl.textContent = `Loaded ${file.name}`;
  });

  for (const id of [...controlIds, "fps", "duration"]) {
    document.getElementById(id).addEventListener("input", () => {
      progressEl.value = 0;
    });
  }

  exportBtn.addEventListener("click", async () => {
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
      exportBtn.disabled = false;
    }
  });
}

setupRoutes();
setupNewProjectRoute();
setupCrtLab();
