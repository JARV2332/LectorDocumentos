export interface NormalizedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisibleVideoRect {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
}

/** Mapea el video con object-cover al área visible del contenedor. */
export function getVisibleVideoRect(
  video: HTMLVideoElement,
  container: HTMLElement,
): VisibleVideoRect | null {
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    return null;
  }

  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  if (containerWidth === 0 || containerHeight === 0) {
    return null;
  }

  const videoAspect = video.videoWidth / video.videoHeight;
  const containerAspect = containerWidth / containerHeight;

  if (videoAspect > containerAspect) {
    const sourceWidth = video.videoHeight * containerAspect;
    return {
      sourceX: (video.videoWidth - sourceWidth) / 2,
      sourceY: 0,
      sourceWidth,
      sourceHeight: video.videoHeight,
    };
  }

  const sourceHeight = video.videoWidth / containerAspect;
  return {
    sourceX: 0,
    sourceY: (video.videoHeight - sourceHeight) / 2,
    sourceWidth: video.videoWidth,
    sourceHeight,
  };
}

export function captureVisibleRegion(
  video: HTMLVideoElement,
  container: HTMLElement,
  region: NormalizedRegion = { x: 0, y: 0, width: 1, height: 1 },
): HTMLCanvasElement | null {
  const visible = getVisibleVideoRect(video, container);
  if (!visible) {
    return null;
  }

  const cropX = visible.sourceX + visible.sourceWidth * region.x;
  const cropY = visible.sourceY + visible.sourceHeight * region.y;
  const cropWidth = visible.sourceWidth * region.width;
  const cropHeight = visible.sourceHeight * region.height;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(cropWidth));
  canvas.height = Math.max(1, Math.floor(cropHeight));

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }

  context.drawImage(
    video,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  return canvas;
}

export function captureFullVisibleFrame(
  video: HTMLVideoElement,
  container: HTMLElement,
): HTMLCanvasElement | null {
  return captureVisibleRegion(video, container);
}
