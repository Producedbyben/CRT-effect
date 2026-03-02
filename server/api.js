import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateMp4Upload, extractMetadata } from "../src/ingest/upload-service.js";
import { createProjectSession } from "../src/domain/project-session.js";
import { enqueueRenderJob, listRenderJobs } from "../src/render/render-queue.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageDir = path.join(__dirname, "storage");
const projectStore = new Map();

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function readJson(req) {
  return readRawBody(req).then((buffer) => (buffer.length ? JSON.parse(buffer.toString("utf8")) : {}));
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function handleUpload(req, res) {
  const bytes = await readRawBody(req);
  const contentType = req.headers["content-type"] || "";

  if (!contentType.includes("video/mp4")) {
    return sendJson(res, 415, { error: "Upload API expects content-type video/mp4" });
  }

  const validation = validateMp4Upload(bytes);
  const videoId = crypto.randomUUID();
  const filePath = path.join(storageDir, `${videoId}.mp4`);
  await fs.mkdir(storageDir, { recursive: true });
  await fs.writeFile(filePath, bytes);

  const metadata = extractMetadata(bytes, {
    duration: Number(req.headers["x-video-duration"]) || 0,
    width: Number(req.headers["x-video-width"]) || 1920,
    height: Number(req.headers["x-video-height"]) || 1080,
  });

  return sendJson(res, 201, {
    videoId,
    sourcePath: filePath,
    container: validation.container,
    codec: validation.codec,
    metadata,
  });
}

async function handleProjectSessionCreate(req, res) {
  const payload = await readJson(req);
  const projectSession = createProjectSession(payload);
  projectStore.set(projectSession.id, projectSession);
  return sendJson(res, 201, projectSession);
}

async function handleRenderQueue(req, res) {
  const payload = await readJson(req);
  const job = enqueueRenderJob(payload.projectSessionId, payload.renderSettings || {});
  return sendJson(res, 202, job);
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/upload") return await handleUpload(req, res);
    if (req.method === "POST" && req.url === "/api/project-sessions") return await handleProjectSessionCreate(req, res);
    if (req.method === "POST" && req.url === "/api/render-jobs") return await handleRenderQueue(req, res);
    if (req.method === "GET" && req.url === "/api/render-jobs") return sendJson(res, 200, listRenderJobs());

    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    return sendJson(res, 400, { error: error.message });
  }
});

const port = Number(process.env.PORT || 8787);
server.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
