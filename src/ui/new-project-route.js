const API_BASE = "http://localhost:8787";

import { createProjectSession } from "../domain/project-session.js";
import { addOverlayLayer } from "../composer/timeline-service.js";

const state = {
  uploadResult: null,
  projectSession: null,
};

function setStatus(message) {
  const status = document.getElementById("newProjectStatus");
  if (status) status.textContent = message;
}

async function uploadMp4(file) {
  const response = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    headers: {
      "content-type": "video/mp4",
      "x-video-duration": "10",
      "x-video-width": "1920",
      "x-video-height": "1080",
    },
    body: await file.arrayBuffer(),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Upload failed");
  }

  return response.json();
}

async function createSessionFromUpload(uploadResult) {
  const payload = createProjectSession({
    videoId: uploadResult.videoId,
    duration: uploadResult.metadata.duration,
    overlays: [],
    renderSettings: {
      fps: 60,
      width: uploadResult.metadata.width,
      height: uploadResult.metadata.height,
      codec: uploadResult.codec,
    },
  });

  const response = await fetch(`${API_BASE}/api/project-sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Could not create project session");
  }
  return response.json();
}

function renderEditorShell() {
  const target = document.getElementById("editorShell");
  if (!target || !state.projectSession) return;

  const withStarterLayer = addOverlayLayer(state.projectSession, {
    type: "text",
    startTime: 0,
    endTime: 4,
    props: { text: "New OverlayLayer", style: "headline" },
  });

  target.innerHTML = `
    <h3>Editor Shell</h3>
    <p><strong>ProjectSession:</strong> ${withStarterLayer.id}</p>
    <p>Video ID: ${withStarterLayer.videoId}</p>
    <p>Duration: ${withStarterLayer.duration}s</p>
    <p>OverlayLayer count: ${withStarterLayer.overlays.length}</p>
    <div class="editor-grid">
      <div class="panel">Timeline panel placeholder</div>
      <div class="panel">Overlay controls placeholder</div>
      <div class="panel">Render settings placeholder</div>
    </div>
  `;
}

export function setupNewProjectRoute() {
  const form = document.getElementById("newProjectForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fileInput = document.getElementById("projectVideoInput");
    const file = fileInput?.files?.[0];
    if (!file) {
      setStatus("Choose an MP4 file first.");
      return;
    }

    try {
      setStatus("Uploading MP4...");
      state.uploadResult = await uploadMp4(file);
      setStatus("Creating ProjectSession...");
      state.projectSession = await createSessionFromUpload(state.uploadResult);
      setStatus("Project ready. Editor shell loaded.");
      renderEditorShell();
    } catch (error) {
      setStatus(`New Project failed: ${error.message}`);
    }
  });
}
