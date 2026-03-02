import { createOverlayLayer } from "../domain/project-session.js";

export function buildTimeline(projectSession) {
  return {
    duration: projectSession.duration,
    tracks: [
      { id: "video-track", kind: "video", sourceId: projectSession.videoId },
      {
        id: "overlay-track",
        kind: "overlay",
        layers: projectSession.overlays.map((overlay) => createOverlayLayer(overlay)),
      },
    ],
  };
}

export function addOverlayLayer(projectSession, overlayInput) {
  const overlay = createOverlayLayer(overlayInput);
  return {
    ...projectSession,
    overlays: [...projectSession.overlays, overlay],
  };
}
