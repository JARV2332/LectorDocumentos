import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HTMLCanvasElementLuminanceSource,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
} from "@zxing/library";
import { parseAamvaBarcode } from "@/lib/parsers/aamvaParser";
import type { LicenseScanResult } from "@/lib/types/documents";
import { cropBarcodeRegion, downscaleCanvas } from "@/lib/utils/imageProcessing";

const hints = new Map<DecodeHintType, unknown>();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);
hints.set(DecodeHintType.TRY_HARDER, true);

function decodeCanvas(canvas: HTMLCanvasElement): string | null {
  const reader = new MultiFormatReader();
  reader.setHints(hints);

  try {
    const source = new HTMLCanvasElementLuminanceSource(canvas);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));
    return reader.decode(bitmap).getText();
  } catch (error) {
    if (error instanceof NotFoundException) {
      return null;
    }
    return null;
  } finally {
    reader.reset();
  }
}

export async function scanLicenseFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<LicenseScanResult | null> {
  const attempts = [
    downscaleCanvas(canvas),
    downscaleCanvas(cropBarcodeRegion(canvas)),
    downscaleCanvas(cropBarcodeRegion(canvas), 960),
    cropBarcodeRegion(canvas),
  ];

  for (const attempt of attempts) {
    const raw = decodeCanvas(attempt);
    if (!raw) {
      continue;
    }

    const parsed = parseAamvaBarcode(raw);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

export async function scanLicenseFromVideo(
  video: HTMLVideoElement,
): Promise<LicenseScanResult | null> {
  const { BrowserMultiFormatReader } = await import("@zxing/library");
  const reader = new BrowserMultiFormatReader(hints, 0);

  try {
    const result = await reader.decodeFromVideoElement(video);
    return parseAamvaBarcode(result.getText());
  } catch (error) {
    if (error instanceof NotFoundException) {
      return null;
    }
    return null;
  }
}
