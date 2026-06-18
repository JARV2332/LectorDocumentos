import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HTMLCanvasElementLuminanceSource,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
  PDF417Reader,
} from "@zxing/library";
import { parseGuatemalaLicense } from "@/lib/parsers/guatemalaLicenseParser";
import type { LicenseScanResult } from "@/lib/types/documents";
import {
  cropRegion,
  enhanceForBarcode,
  LICENSE_PDF417_REGION,
  upscaleCanvasTo,
} from "@/lib/utils/imageProcessing";
import type { NormalizedRegion } from "@/lib/utils/objectCover";

/** Escaneo liviano para cámara en vivo — sin OCR, sin grilla, sin bloquear la UI. */
export function scanLicenseLiveFrame(
  captureFrame: (region?: NormalizedRegion) => HTMLCanvasElement | null,
): LicenseScanResult | null {
  const canvas = captureFrame(LICENSE_PDF417_REGION);
  if (!canvas) {
    return null;
  }

  const variants = [
    enhanceForBarcode(upscaleCanvasTo(canvas, 960)),
    enhanceForBarcode(canvas),
  ];

  for (const variant of variants) {
    const raw = decodePdf417Quick(variant);
    if (!raw) {
      continue;
    }

    const parsed = parseGuatemalaLicense(raw);
    if (parsed && (parsed.cui || parsed.nombres || parsed.apellidos)) {
      return parsed;
    }
  }

  return null;
}

function decodePdf417Quick(canvas: HTMLCanvasElement): string | null {
  try {
    const reader = new PDF417Reader();
    const source = new HTMLCanvasElementLuminanceSource(canvas);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));
    return reader.decode(bitmap).getText();
  } catch (error) {
    if (error instanceof NotFoundException) {
      return decodePdf417Multi(canvas);
    }
    return null;
  }
}

function decodePdf417Multi(canvas: HTMLCanvasElement): string | null {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);

  const reader = new MultiFormatReader();
  reader.setHints(hints);

  try {
    const source = new HTMLCanvasElementLuminanceSource(canvas);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));
    return reader.decode(bitmap).getText();
  } catch {
    return null;
  } finally {
    reader.reset();
  }
}

export function scanLicenseLiveFromCanvas(canvas: HTMLCanvasElement): LicenseScanResult | null {
  const cropped = cropRegion(canvas, LICENSE_PDF417_REGION);
  return scanLicenseLiveFrame(() => cropped);
}
