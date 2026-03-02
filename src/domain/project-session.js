export const SUPPORTED_CONTAINER = "mp4";

/**
 * @typedef {Object} OverlayLayer
 * @property {string} id
 * @property {"text"|"image"|"shape"} type
 * @property {number} startTime
 * @property {number} endTime
 * @property {Record<string, unknown>} props
 */

/**
 * @typedef {Object} ProjectSession
 * @property {string} id
 * @property {string} videoId
 * @property {number} duration
 * @property {OverlayLayer[]} overlays
 * @property {{fps:number,width:number,height:number,codec:string}} renderSettings
 * @property {string} templateId
 */

export function createOverlayLayer(partial = {}) {
  return {
    id: partial.id ?? crypto.randomUUID(),
    type: partial.type ?? "text",
    startTime: partial.startTime ?? 0,
    endTime: partial.endTime ?? 3,
    props: partial.props ?? {},
  };
}

export function createProjectSession(input) {
  if (!input?.videoId) {
    throw new Error("ProjectSession requires a videoId");
  }
  return {
    id: input.id ?? crypto.randomUUID(),
    videoId: input.videoId,
    duration: Math.max(0, Number(input.duration) || 0),
    overlays: (input.overlays ?? []).map((overlay) => createOverlayLayer(overlay)),
    renderSettings: {
      fps: Number(input.renderSettings?.fps) || 60,
      width: Number(input.renderSettings?.width) || 1920,
      height: Number(input.renderSettings?.height) || 1080,
      codec: input.renderSettings?.codec || "avc1.42E01E",
    },
    templateId: input.templateId || "ranked-highlight",
  };
}
