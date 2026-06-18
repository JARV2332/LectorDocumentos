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

export function cropRegion(
  source: HTMLCanvasElement,
  region: { x: number; y: number; width: number; height: number },
): HTMLCanvasElement {
  const x = Math.max(0, Math.floor(source.width * region.x));
  const y = Math.max(0, Math.floor(source.height * region.y));
  const width = Math.min(source.width - x, Math.floor(source.width * region.width));
  const height = Math.min(source.height - y, Math.floor(source.height * region.height));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return source;
  }

  context.drawImage(source, x, y, width, height, 0, 0, width, height);
  return canvas;
}

export function cropMrzRegion(source: HTMLCanvasElement): HTMLCanvasElement {
  return cropRegion(source, { x: 0.04, y: 0.58, width: 0.92, height: 0.34 });
}

export function cropBarcodeRegion(source: HTMLCanvasElement): HTMLCanvasElement {
  return cropRegion(source, { x: 0.06, y: 0.3, width: 0.88, height: 0.34 });
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
  canvas.height = Math.floor(source.height * scale);

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return source;
  }

  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}
