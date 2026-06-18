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
import {
  mergeLicenseResults,
  parseGuatemalaLicense,
} from "@/lib/parsers/guatemalaLicenseParser";
import type { LicenseScanResult } from "@/lib/types/documents";
import { scanLicenseVisibleText } from "@/lib/scanner/licenseOcr";
import {
  cropLicensePdf417,
  cropLicenseQr,
  cropRegion,
  downscaleCanvas,
  enhanceForBarcode,
  LICENSE_LOWER_HALF_REGION,
  LICENSE_PDF417_REGION,
  LICENSE_QR_REGION,
  LICENSE_TOP_BARCODE_REGION,
  upscaleCanvas,
  upscaleCanvasTo,
} from "@/lib/utils/imageProcessing";
import type { NormalizedRegion } from "@/lib/utils/objectCover";

function decodeCanvasWithFormats(
  canvas: HTMLCanvasElement,
  formats: BarcodeFormat[],
): string | null {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
  hints.set(DecodeHintType.TRY_HARDER, true);

  const attempts = [
    [HybridBinarizer, false],
    [GlobalHistogramBinarizer, false],
    [HybridBinarizer, true],
    [GlobalHistogramBinarizer, true],
  ] as const;

  for (const [Binarizer, invert] of attempts) {
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

function processCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement[] {
  return [
    enhanceForBarcode(upscaleCanvasTo(canvas, 1400)),
    enhanceForBarcode(upscaleCanvas(canvas, 1100)),
    enhanceForBarcode(canvas),
    upscaleCanvasTo(canvas, 1200),
    canvas,
    downscaleCanvas(enhanceForBarcode(canvas), 960),
  ];
}

interface ScanTarget {
  region: NormalizedRegion;
  formats: BarcodeFormat[];
}

const SCAN_TARGETS: ScanTarget[] = [
  { region: LICENSE_PDF417_REGION, formats: [BarcodeFormat.PDF_417] },
  { region: LICENSE_QR_REGION, formats: [BarcodeFormat.QR_CODE] },
  { region: LICENSE_LOWER_HALF_REGION, formats: [BarcodeFormat.PDF_417, BarcodeFormat.QR_CODE] },
  { region: LICENSE_TOP_BARCODE_REGION, formats: [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39] },
];

function scanBarcodesOnCanvas(canvas: HTMLCanvasElement): LicenseScanResult | null {
  let merged: LicenseScanResult | null = null;

  for (const target of SCAN_TARGETS) {
    const cropped = cropRegion(canvas, target.region);

    for (const processed of processCanvas(cropped)) {
      const raw = decodeCanvasWithFormats(processed, target.formats);
      if (!raw) {
        continue;
      }

      const parsed = parseGuatemalaLicense(raw);
      if (!parsed) {
        continue;
      }

      merged = merged ? mergeLicenseResults(merged, parsed) : parsed;
    }
  }

  const pdf417Only = cropLicensePdf417(canvas);
  for (const processed of processCanvas(pdf417Only)) {
    const raw = decodeCanvasWithFormats(processed, [BarcodeFormat.PDF_417]);
    if (raw) {
      const parsed = parseGuatemalaLicense(raw);
      if (parsed) {
        merged = merged ? mergeLicenseResults(merged, parsed) : parsed;
      }
    }
  }

  const qrOnly = cropLicenseQr(canvas);
  for (const processed of processCanvas(qrOnly)) {
    const raw = decodeCanvasWithFormats(processed, [BarcodeFormat.QR_CODE]);
    if (raw) {
      const parsed = parseGuatemalaLicense(raw);
      if (parsed) {
        merged = merged ? mergeLicenseResults(merged, parsed) : parsed;
      }
    }
  }

  return merged;
}

export async function scanLicenseFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<LicenseScanResult | null> {
  const barcodeResult = scanBarcodesOnCanvas(canvas);

  if (barcodeResult?.cui && barcodeResult.nombres && barcodeResult.apellidos) {
    return barcodeResult;
  }

  const ocrResult = await scanLicenseVisibleText(canvas);

  if (barcodeResult && ocrResult) {
    return mergeLicenseResults(barcodeResult, ocrResult);
  }

  return barcodeResult ?? ocrResult;
}

export async function scanLicenseFromRegion(
  captureFrame: (region?: NormalizedRegion) => HTMLCanvasElement | null,
): Promise<LicenseScanResult | null> {
  const regions: Array<NormalizedRegion | undefined> = [
    undefined,
    LICENSE_PDF417_REGION,
    LICENSE_LOWER_HALF_REGION,
  ];

  let merged: LicenseScanResult | null = null;

  for (const region of regions) {
    const canvas = captureFrame(region);
    if (!canvas) {
      continue;
    }

    const result = await scanLicenseFromCanvas(canvas);
    if (!result) {
      continue;
    }

    merged = merged ? mergeLicenseResults(merged, result) : result;

    if (merged.cui && (merged.nombres || merged.fechaNacimiento)) {
      return merged;
    }
  }

  return merged;
}
