function seededNoise(x, y, frame) {
  const v = Math.sin(x * 12.9898 + y * 78.233 + frame * 19.17) * 43758.5453;
  return v - Math.floor(v);
}

export class CRTRenderer {
  constructor() {
    this.sourceCanvas = document.createElement("canvas");
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

    const pixels = wctx.getImageData(0, 0, width, height);
    const data = pixels.data;

    const scan = params.scanlineStrength;
    const maskStrength = params.phosphorMask;
    const flickerWave = Math.sin((frameIndex / fps) * Math.PI * 2 * 2.1) * 0.5 + 0.5;
    const flicker = params.flicker * (0.35 + flickerWave * 0.65);

    for (let y = 0; y < height; y++) {
      const scanGain = 1 - scan * (y % 2 === 0 ? 0.62 : 0.2);
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
        if (luma <= 2.2) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
          data[i + 3] = 255;
          continue;
        }

        const column = x % 3;
        const channelBoost = 1 + maskStrength * 0.9;
        const channelBase = 1 - maskStrength * 0.2;
        const rMask = column === 0 ? channelBoost : channelBase;
        const gMask = column === 1 ? channelBoost : channelBase;
        const bMask = column === 2 ? channelBoost : channelBase;

        const brightnessLift = 1.14 + params.bloom * 0.22;
        const noise = (seededNoise(x * 2, y * 1.7 + seconds * 60, frameIndex) - 0.5) * 36 * params.noise;
        const flickerGain = 1 + flicker * 0.32;

        r = r * scanGain * rMask * brightnessLift * flickerGain + noise;
        g = g * scanGain * gMask * brightnessLift * flickerGain + noise;
        b = b * scanGain * bMask * brightnessLift * flickerGain + noise;

        data[i] = Math.min(255, Math.max(0, r));
        data[i + 1] = Math.min(255, Math.max(0, g));
        data[i + 2] = Math.min(255, Math.max(0, b));
        data[i + 3] = 255;
      }
    }

    wctx.putImageData(pixels, 0, 0);

    outCtx.drawImage(this.workCanvas, 0, 0);

    const bloom = params.bloom;
    if (bloom > 0) {
      outCtx.save();
      outCtx.globalCompositeOperation = "screen";
      outCtx.globalAlpha = bloom * 0.42;
      outCtx.filter = `blur(${1 + bloom * 5}px)`;
      outCtx.drawImage(this.workCanvas, 0, 0);
      outCtx.restore();
    }
  }
}
