let detectorPromise: Promise<BarcodeDetector | null> | null = null;

async function createDetector(): Promise<BarcodeDetector | null> {
  if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
    return null;
  }

  try {
    return new window.BarcodeDetector!({
      formats: ["pdf417", "qr_code", "code_128", "code_39"],
    });
  } catch {
    return null;
  }
}

export async function getBarcodeDetector(): Promise<BarcodeDetector | null> {
  if (!detectorPromise) {
    detectorPromise = createDetector();
  }

  return detectorPromise;
}

export async function detectBarcodesOnCanvas(
  canvas: HTMLCanvasElement,
): Promise<string[]> {
  const detector = await getBarcodeDetector();
  if (!detector) {
    return [];
  }

  try {
    const results = await detector.detect(canvas);
    return results.map((item) => item.rawValue).filter(Boolean) as string[];
  } catch {
    return [];
  }
}
