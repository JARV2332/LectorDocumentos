import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HTMLCanvasElementLuminanceSource,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
} from "@zxing/library";
import { parseAamvaBarcode } from "@/lib/parsers/aamvaParser";
import type { LicenseScanResult } from "@/lib/types/documents";
import {
  cropLicenseBottomBarcode,
  cropRegion,
  downscaleCanvas,
  enhanceForBarcode,
  LICENSE_BOTTOM_BARCODE_REGION,
  LICENSE_LOWER_HALF_REGION,
  upscaleCanvas,
} from "@/lib/utils/imageProcessing";
import type { NormalizedRegion } from "@/lib/utils/objectCover";

const hints = new Map<DecodeHintType, unknown>();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);
hints.set(DecodeHintType.TRY_HARDER, true);

type BinarizerFactory = typeof HybridBinarizer | typeof GlobalHistogramBinarizer;

function decodeCanvasWithBinarizer(
  canvas: HTMLCanvasElement,
  Binarizer: BinarizerFactory,
  invert = false,
): string | null {
  const reader = new MultiFormatReader();
  reader.setHints(hints);

  try {
    const source = new HTMLCanvasElementLuminanceSource(canvas, invert);
    const bitmap = new BinaryBitmap(new Binarizer(source));
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

function decodeCanvas(canvas: HTMLCanvasElement): string | null {
  const attempts = [
    [HybridBinarizer, false],
    [GlobalHistogramBinarizer, false],
    [HybridBinarizer, true],
    [GlobalHistogramBinarizer, true],
  ] as const;

  for (const [Binarizer, invert] of attempts) {
    const raw = decodeCanvasWithBinarizer(canvas, Binarizer, invert);
    if (raw) {
      return raw;
    }
  }

  return null;
}

function buildLicenseScanAttempts(canvas: HTMLCanvasElement): HTMLCanvasElement[] {
  const bottom = cropLicenseBottomBarcode(canvas);
  const lowerHalf = cropRegion(canvas, LICENSE_LOWER_HALF_REGION);

  return [
    enhanceForBarcode(upscaleCanvas(bottom, 1100)),
    enhanceForBarcode(bottom),
    upscaleCanvas(bottom, 1000),
    bottom,
    enhanceForBarcode(upscaleCanvas(lowerHalf, 1200)),
    downscaleCanvas(enhanceForBarcode(bottom), 960),
    canvas,
  ];
}

function parseOrFallback(raw: string): LicenseScanResult | null {
  const parsed = parseAamvaBarcode(raw);
  if (parsed) {
    return parsed;
  }

  if (raw.length >= 20) {
    return {
      type: "license",
      numeroLicencia: raw.replace(/[^A-Z0-9]/gi, "").slice(0, 20),
      cui: "",
      nombres: "",
      apellidos: "",
      tipoLicencia: "",
      rawBarcode: raw,
    };
  }

  return null;
}

export async function scanLicenseFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<LicenseScanResult | null> {
  for (const attempt of buildLicenseScanAttempts(canvas)) {
    const raw = decodeCanvas(attempt);
    if (!raw) {
      continue;
    }

    const parsed = parseOrFallback(raw);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

export async function scanLicenseFromRegion(
  captureFrame: (region?: NormalizedRegion) => HTMLCanvasElement | null,
): Promise<LicenseScanResult | null> {
  const attempts: Array<NormalizedRegion | undefined> = [
    LICENSE_BOTTOM_BARCODE_REGION,
    LICENSE_LOWER_HALF_REGION,
    undefined,
  ];

  for (const region of attempts) {
    const canvas = captureFrame(region);
    if (!canvas) {
      continue;
    }

    const result = await scanLicenseFromCanvas(canvas);
    if (result) {
      return result;
    }
  }

  return null;
}
