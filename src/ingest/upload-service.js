const FTYP_SIGNATURE = "ftyp";
const KNOWN_VIDEO_CODECS = ["avc1", "hvc1", "hev1", "mp4v"];

function hasFtypBox(bytes) {
  if (bytes.length < 12) return false;
  const marker = String.fromCharCode(...bytes.slice(4, 8));
  return marker === FTYP_SIGNATURE;
}

function detectCodecHint(bytes) {
  const text = new TextDecoder().decode(bytes.slice(0, 512));
  return KNOWN_VIDEO_CODECS.find((codec) => text.includes(codec)) || null;
}

export function validateMp4Upload(file) {
  const bytes = new Uint8Array(file);
  if (!hasFtypBox(bytes)) {
    throw new Error("Invalid container: expected MP4 with ftyp box");
  }

  const codec = detectCodecHint(bytes);
  if (!codec) {
    throw new Error("Unsupported codec hint: expected avc1/hvc1/hev1/mp4v");
  }

  return { container: "mp4", codec };
}

export function extractMetadata(file, fallback = {}) {
  const sizeBytes = file.byteLength ?? 0;
  return {
    duration: Number(fallback.duration) || 0,
    width: Number(fallback.width) || 1920,
    height: Number(fallback.height) || 1080,
    sizeBytes,
  };
}
