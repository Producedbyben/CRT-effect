const queue = [];

export function enqueueRenderJob(projectSessionId, renderSettings) {
  const job = {
    id: crypto.randomUUID(),
    projectSessionId,
    renderSettings,
    status: "queued",
    createdAt: new Date().toISOString(),
  };
  queue.push(job);
  return job;
}

export function listRenderJobs() {
  return [...queue];
}
