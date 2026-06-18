import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HTMLCanvasElementLuminanceSource,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
  PDF417Reader,
} from "@zxing/library";
import {
  mergeLicenseResults,
  parseGuatemalaLicense,
} from "@/lib/parsers/guatemalaLicenseParser";
import type { LicenseScanResult } from "@/lib/types/documents";
import { scanLicenseVisibleText } from "@/lib/scanner/licenseOcr";
import {
  cropLicensePdf417,
  cropRegion,
  downscaleCanvas,
  enhanceForBarcode,
  LICENSE_LOWER_HALF_REGION,
  LICENSE_PDF417_REGION,
  LICENSE_TOP_BARCODE_REGION,
  upscaleCanvasTo,
} from "@/lib/utils/imageProcessing";
import type { NormalizedRegion } from "@/lib/utils/objectCover";

const PDF417_REGION_VARIANTS: NormalizedRegion[] = [
  { x: 0.0, y: 0.5, width: 0.64, height: 0.44 },
  { x: 0.0, y: 0.52, width: 0.68, height: 0.4 },
  { x: 0.02, y: 0.48, width: 0.6, height: 0.46 },
  { x: 0.0, y: 0.55, width: 0.7, height: 0.38 },
  LICENSE_LOWER_HALF_REGION,
];

function decodePdf417(canvas: HTMLCanvasElement): string | null {
  const reader = new PDF417Reader();
  const binarizers = [
    [HybridBinarizer, false],
    [GlobalHistogramBinarizer, false],
    [HybridBinarizer, true],
    [GlobalHistogramBinarizer, true],
  ] as const;

  for (const [Binarizer, invert] of binarizers) {
    try {
      const source = new HTMLCanvasElementLuminanceSource(canvas, invert);
      const bitmap = new BinaryBitmap(new Binarizer(source));
      return reader.decode(bitmap).getText();
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        continue;
      }
    }
  }

  return null;
}

function decodeWithReader(
  canvas: HTMLCanvasElement,
  formats: BarcodeFormat[],
): string | null {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
  hints.set(DecodeHintType.TRY_HARDER, true);

  const binarizers = [
    [HybridBinarizer, false],
    [GlobalHistogramBinarizer, false],
    [HybridBinarizer, true],
  ] as const;

  for (const [Binarizer, invert] of binarizers) {
    const reader = new MultiFormatReader();
    reader.setHints(hints);

    try {
      const source = new HTMLCanvasElementLuminanceSource(canvas, invert);
      const bitmap = new BinaryBitmap(new Binarizer(source));
      return reader.decode(bitmap).getText();
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        continue;
      }
    } finally {
      reader.reset();
    }
  }

  return null;
}

function buildProcessedVariants(canvas: HTMLCanvasElement): HTMLCanvasElement[] {
  return [
    enhanceForBarcode(upscaleCanvasTo(canvas, 2200)),
    enhanceForBarcode(upscaleCanvasTo(canvas, 1800)),
    enhanceForBarcode(upscaleCanvasTo(canvas, 1400)),
    upscaleCanvasTo(canvas, 1600),
    enhanceForBarcode(canvas),
    canvas,
    downscaleCanvas(enhanceForBarcode(canvas), 1200),
  ];
}

function scanPdf417OnCanvas(canvas: HTMLCanvasElement): LicenseScanResult | null {
  let best: LicenseScanResult | null = null;

  for (const region of PDF417_REGION_VARIANTS) {
    const cropped = cropRegion(canvas, region);

    for (const processed of buildProcessedVariants(cropped)) {
      const raw = decodePdf417(processed) ?? decodeWithReader(processed, [BarcodeFormat.PDF_417]);
      if (!raw) {
        continue;
      }

      const parsed = parseGuatemalaLicense(raw);
      if (!parsed) {
        continue;
      }

      best = best ? mergeLicenseResults(best, parsed) : parsed;

      if (parsed.cui && parsed.nombres && parsed.apellidos) {
        return parsed;
      }
    }
  }

  const direct = cropLicensePdf417(canvas);
  for (const processed of buildProcessedVariants(direct)) {
    const raw = decodePdf417(processed);
    if (!raw) {
      continue;
    }

    const parsed = parseGuatemalaLicense(raw);
    if (parsed) {
      best = best ? mergeLicenseResults(best, parsed) : parsed;
    }
  }

  return best;
}

function scanTopBarcode(canvas: HTMLCanvasElement): LicenseScanResult | null {
  const cropped = cropRegion(canvas, LICENSE_TOP_BARCODE_REGION);

  for (const processed of buildProcessedVariants(cropped)) {
    const raw = decodeWithReader(processed, [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39]);
    if (!raw) {
      continue;
    }

    const parsed = parseGuatemalaLicense(raw);
    if (parsed?.numeroLicencia || parsed?.cui) {
      return parsed;
    }
  }

  return null;
}

function hasIdentityData(result: LicenseScanResult): boolean {
  return Boolean(result.cui || result.nombres || result.apellidos);
}

export async function scanLicenseFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<LicenseScanResult | null> {
  const pdf417Result = scanPdf417OnCanvas(canvas);
  const topBarcodeResult = scanTopBarcode(canvas);

  let barcodeResult: LicenseScanResult | null = pdf417Result;
  if (topBarcodeResult) {
    barcodeResult = barcodeResult
      ? mergeLicenseResults(barcodeResult, topBarcodeResult)
      : topBarcodeResult;
  }

  if (barcodeResult && hasIdentityData(barcodeResult)) {
    const ocrExtras = await scanLicenseVisibleText(canvas);
    return ocrExtras ? mergeLicenseResults(barcodeResult, ocrExtras) : barcodeResult;
  }

  const ocrResult = await scanLicenseVisibleText(canvas);

  if (barcodeResult && ocrResult) {
    return mergeLicenseResults(ocrResult, barcodeResult);
  }

  return barcodeResult ?? ocrResult;
}

export async function scanLicenseFromRegion(
  captureFrame: (region?: NormalizedRegion) => HTMLCanvasElement | null,
): Promise<LicenseScanResult | null> {
  const canvas = captureFrame(undefined) ?? captureFrame(LICENSE_PDF417_REGION);
  if (!canvas) {
    return null;
  }

  return scanLicenseFromCanvas(canvas);
}
