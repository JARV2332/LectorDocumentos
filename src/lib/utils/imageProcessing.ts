import type { NormalizedRegion } from "@/lib/utils/objectCover";

export function enhanceForOcr(source: HTMLCanvasElement): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = source.width;
  output.height = source.height;

  const context = output.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return source;
  }

  context.filter = "grayscale(1) contrast(1.8) brightness(1.1)";
  context.drawImage(source, 0, 0);

  const imageData = context.getImageData(0, 0, output.width, output.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const value = data[index] > 145 ? 255 : 0;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }

  context.putImageData(imageData, 0, 0);
  return output;
}

export function enhanceForBarcode(source: HTMLCanvasElement): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = source.width;
  output.height = source.height;

  const context = output.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return source;
  }

  context.filter = "grayscale(1) contrast(2.2) brightness(1.05)";
  context.drawImage(source, 0, 0);
  return output;
}

export function cropRegion(
  source: HTMLCanvasElement,
  region: NormalizedRegion,
): HTMLCanvasElement {
  const x = Math.max(0, Math.floor(source.width * region.x));
  const y = Math.max(0, Math.floor(source.height * region.y));
  const width = Math.min(source.width - x, Math.floor(source.width * region.width));
  const height = Math.min(source.height - y, Math.floor(source.height * region.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return source;
  }

  context.drawImage(source, x, y, width, height, 0, 0, width, height);
  return canvas;
}

/** Reverso DPI: 3 líneas MRZ en la parte inferior. */
export function cropMrzRegion(source: HTMLCanvasElement): HTMLCanvasElement {
  return cropRegion(source, { x: 0.04, y: 0.58, width: 0.92, height: 0.34 });
}

/**
 * Licencia GT: PDF417 grande en la parte INFERIOR del reverso.
 * El código pequeño de arriba (Code128) se ignora a propósito.
 */
export const LICENSE_BOTTOM_BARCODE_REGION: NormalizedRegion = {
  x: 0.04,
  y: 0.62,
  width: 0.92,
  height: 0.28,
};

export const LICENSE_LOWER_HALF_REGION: NormalizedRegion = {
  x: 0.03,
  y: 0.48,
  width: 0.94,
  height: 0.48,
};

export function cropLicenseBottomBarcode(source: HTMLCanvasElement): HTMLCanvasElement {
  return cropRegion(source, LICENSE_BOTTOM_BARCODE_REGION);
}

export function downscaleCanvas(
  source: HTMLCanvasElement,
  maxWidth = 1280,
): HTMLCanvasElement {
  if (source.width <= maxWidth) {
    return source;
  }

  const scale = maxWidth / source.width;
  const canvas = document.createElement("canvas");
  canvas.width = maxWidth;
  canvas.height = Math.max(1, Math.floor(source.height * scale));

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return source;
  }

  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function upscaleCanvas(
  source: HTMLCanvasElement,
  minWidth = 900,
): HTMLCanvasElement {
  if (source.width >= minWidth) {
    return source;
  }

  const scale = minWidth / source.width;
  const canvas = document.createElement("canvas");
  canvas.width = minWidth;
  canvas.height = Math.max(1, Math.floor(source.height * scale));

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return source;
  }

  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}
