import { parseGuatemalaLicenseOcr } from "@/lib/parsers/guatemalaLicenseParser";
import type { LicenseScanResult } from "@/lib/types/documents";
import { cropRegion, enhanceForOcr } from "@/lib/utils/imageProcessing";
import type { NormalizedRegion } from "@/lib/utils/objectCover";

type OcrWorker = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;

let workerPromise: Promise<OcrWorker> | null = null;

async function getLicenseOcrWorker(): Promise<OcrWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, PSM } = await import("tesseract.js");
      const worker = await createWorker("spa+eng", 1, {
        logger: () => undefined,
      });

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      });

      return worker;
    })();
  }

  return workerPromise;
}

const LICENSE_TEXT_REGION: NormalizedRegion = {
  x: 0.08,
  y: 0.12,
  width: 0.84,
  height: 0.78,
};

export async function scanLicenseVisibleText(
  canvas: HTMLCanvasElement,
): Promise<LicenseScanResult | null> {
  const worker = await getLicenseOcrWorker();
  const attempts = [
    enhanceForOcr(cropRegion(canvas, LICENSE_TEXT_REGION)),
    enhanceForOcr(canvas),
    cropRegion(canvas, LICENSE_TEXT_REGION),
  ];

  for (const attempt of attempts) {
    const { data } = await worker.recognize(attempt);
    const parsed = parseGuatemalaLicenseOcr(data.text);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}
