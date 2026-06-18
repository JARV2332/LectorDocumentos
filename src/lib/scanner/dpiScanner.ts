import { parseDpiMrz } from "@/lib/parsers/mrzParser";
import type { DpiScanResult } from "@/lib/types/documents";
import { cropMrzRegion, downscaleCanvas, enhanceForOcr } from "@/lib/utils/imageProcessing";

type OcrWorker = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;

let sharedWorker: OcrWorker | null = null;
let workerPromise: Promise<OcrWorker> | null = null;

export async function getDpiOcrWorker(): Promise<OcrWorker> {
  if (sharedWorker) {
    return sharedWorker;
  }

  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, PSM } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: () => undefined,
      });

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
      });

      sharedWorker = worker;
      return worker;
    })();
  }

  return workerPromise;
}

async function recognizeMrz(
  worker: OcrWorker,
  canvas: HTMLCanvasElement,
): Promise<string> {
  const { data } = await worker.recognize(canvas);
  return data.text;
}

export async function scanDpiFromCanvas(
  canvas: HTMLCanvasElement,
  worker?: OcrWorker,
): Promise<DpiScanResult | null> {
  const ocrWorker = worker ?? (await getDpiOcrWorker());
  const attempts = [
    enhanceForOcr(cropMrzRegion(canvas)),
    enhanceForOcr(downscaleCanvas(cropMrzRegion(canvas))),
    enhanceForOcr(downscaleCanvas(canvas)),
    cropMrzRegion(canvas),
  ];

  for (const attempt of attempts) {
    const text = await recognizeMrz(ocrWorker, attempt);
    const parsed = parseDpiMrz(text);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}
