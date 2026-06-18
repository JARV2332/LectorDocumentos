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
import {
  EMPTY_SCAN_DEBUG,
  type LicenseScanDebug,
} from "@/lib/types/scanDebug";
import { scanLicenseVisibleText } from "@/lib/scanner/licenseOcr";
import {
  cropRegion,
  downscaleCanvas,
  enhanceForBarcode,
  LICENSE_LOWER_HALF_REGION,
  LICENSE_PDF417_REGION,
  LICENSE_QR_REGION,
  LICENSE_TOP_BARCODE_REGION,
  upscaleCanvasTo,
} from "@/lib/utils/imageProcessing";
import type { NormalizedRegion } from "@/lib/utils/objectCover";

export interface ScanLicenseOptions {
  onProgress?: (message: string) => void;
  exhaustive?: boolean;
}

export interface ScanLicenseOutcome {
  result: LicenseScanResult | null;
  debug: LicenseScanDebug;
}

const PDF417_REGION_VARIANTS: NormalizedRegion[] = [
  LICENSE_PDF417_REGION,
  { x: 0.0, y: 0.5, width: 0.64, height: 0.44 },
  { x: 0.0, y: 0.52, width: 0.68, height: 0.4 },
  { x: 0.02, y: 0.48, width: 0.6, height: 0.46 },
  LICENSE_LOWER_HALF_REGION,
  { x: 0, y: 0, width: 1, height: 1 },
];

function generateGridRegions(columns: number, rows: number, startRow = 0): NormalizedRegion[] {
  const regions: NormalizedRegion[] = [];

  for (let row = startRow; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      regions.push({
        x: col / columns,
        y: row / rows,
        width: 1 / columns,
        height: 1 / rows,
      });
    }
  }

  return regions;
}

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
    enhanceForBarcode(upscaleCanvasTo(canvas, 2600)),
    enhanceForBarcode(upscaleCanvasTo(canvas, 2200)),
    enhanceForBarcode(upscaleCanvasTo(canvas, 1800)),
    enhanceForBarcode(upscaleCanvasTo(canvas, 1400)),
    upscaleCanvasTo(canvas, 1600),
    enhanceForBarcode(canvas),
    canvas,
    downscaleCanvas(enhanceForBarcode(canvas), 1200),
  ];
}

async function decodeWithNativeBarcodeDetector(
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
    return null;
  }

  try {
    const Detector = window.BarcodeDetector!;
    const detector = new Detector({ formats: ["pdf417", "qr_code", "code_128"] });
    const results = await detector.detect(canvas);

    for (const item of results) {
      if (item.rawValue) {
        return item.rawValue;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function tryDecodePdf417(
  canvas: HTMLCanvasElement,
  debug: LicenseScanDebug,
): string | null {
  for (const processed of buildProcessedVariants(canvas)) {
    debug.decodeAttempts += 1;
    const raw =
      decodePdf417(processed) ?? decodeWithReader(processed, [BarcodeFormat.PDF_417]);
    if (raw) {
      return raw;
    }
  }

  return null;
}

function hasIdentityData(result: LicenseScanResult): boolean {
  return Boolean(result.cui || result.nombres || result.apellidos);
}

async function scanPdf417OnCanvas(
  canvas: HTMLCanvasElement,
  debug: LicenseScanDebug,
  exhaustive: boolean,
  onProgress?: (message: string) => void,
): Promise<LicenseScanResult | null> {
  let best: LicenseScanResult | null = null;
  const regions = exhaustive
    ? [...PDF417_REGION_VARIANTS, ...generateGridRegions(4, 4, 1)]
    : PDF417_REGION_VARIANTS;

  for (const region of regions) {
    debug.regionsScanned += 1;
    onProgress?.(`PDF417 región ${debug.regionsScanned}/${regions.length}...`);

    const cropped = cropRegion(canvas, region);
    const raw = tryDecodePdf417(cropped, debug);

    if (!raw) {
      continue;
    }

    debug.pdf417Raw = raw.slice(0, 180);
    debug.source = "pdf417";

    const parsed = parseGuatemalaLicense(raw);
    if (!parsed) {
      continue;
    }

    best = best ? mergeLicenseResults(best, parsed) : parsed;

    if (parsed.cui && (parsed.nombres || parsed.apellidos)) {
      return parsed;
    }
  }

  onProgress?.("Probando detector nativo del navegador...");
  const nativeRaw = await decodeWithNativeBarcodeDetector(canvas);
  if (nativeRaw) {
    debug.nativeBarcodeRaw = nativeRaw.slice(0, 180);
    const parsed = parseGuatemalaLicense(nativeRaw);
    if (parsed) {
      debug.source = "native";
      return best ? mergeLicenseResults(best, parsed) : parsed;
    }
  }

  return best;
}

function scanTopBarcode(canvas: HTMLCanvasElement, debug: LicenseScanDebug): LicenseScanResult | null {
  const cropped = cropRegion(canvas, LICENSE_TOP_BARCODE_REGION);

  for (const processed of buildProcessedVariants(cropped)) {
    debug.decodeAttempts += 1;
    const raw = decodeWithReader(processed, [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39]);
    if (!raw) {
      continue;
    }

    debug.topBarcodeRaw = raw.slice(0, 80);
    const parsed = parseGuatemalaLicense(raw);
    if (parsed?.numeroLicencia || parsed?.cui) {
      return parsed;
    }
  }

  return null;
}

function scanQr(canvas: HTMLCanvasElement, debug: LicenseScanDebug): LicenseScanResult | null {
  const cropped = cropRegion(canvas, LICENSE_QR_REGION);

  for (const processed of buildProcessedVariants(cropped)) {
    debug.decodeAttempts += 1;
    const raw = decodeWithReader(processed, [BarcodeFormat.QR_CODE]);
    if (!raw) {
      continue;
    }

    debug.qrRaw = raw.slice(0, 120);
    const parsed = parseGuatemalaLicense(raw);
    if (parsed && (parsed.cui || parsed.nombres)) {
      return parsed;
    }
  }

  return null;
}

export async function scanLicenseFromCanvasDetailed(
  canvas: HTMLCanvasElement,
  options: ScanLicenseOptions = {},
): Promise<ScanLicenseOutcome> {
  const debug: LicenseScanDebug = { ...EMPTY_SCAN_DEBUG };
  const { onProgress, exhaustive = true } = options;

  onProgress?.("Buscando PDF417 en la imagen...");

  const pdf417Result = await scanPdf417OnCanvas(canvas, debug, exhaustive, onProgress);
  const topBarcodeResult = scanTopBarcode(canvas, debug);
  const qrResult = scanQr(canvas, debug);

  let barcodeResult: LicenseScanResult | null = pdf417Result;

  if (topBarcodeResult) {
    barcodeResult = barcodeResult
      ? mergeLicenseResults(barcodeResult, topBarcodeResult)
      : topBarcodeResult;
  }

  if (qrResult) {
    barcodeResult = barcodeResult ? mergeLicenseResults(barcodeResult, qrResult) : qrResult;
  }

  if (barcodeResult && hasIdentityData(barcodeResult)) {
    onProgress?.("Leyendo texto visible del reverso...");
    const ocrExtras = await scanLicenseVisibleText(canvas);
    return {
      result: ocrExtras ? mergeLicenseResults(barcodeResult, ocrExtras) : barcodeResult,
      debug,
    };
  }

  onProgress?.("PDF417 no completo. Leyendo texto impreso...");
  const ocrResult = await scanLicenseVisibleText(canvas);

  if (barcodeResult && ocrResult) {
    return {
      result: mergeLicenseResults(ocrResult, barcodeResult),
      debug,
    };
  }

  return {
    result: barcodeResult ?? ocrResult,
    debug,
  };
}

export async function scanLicenseFromCanvas(
  canvas: HTMLCanvasElement,
  options?: ScanLicenseOptions,
): Promise<LicenseScanResult | null> {
  const { result } = await scanLicenseFromCanvasDetailed(canvas, options);
  return result;
}

export async function scanLicenseFromRegion(
  captureFrame: (region?: NormalizedRegion) => HTMLCanvasElement | null,
  options?: ScanLicenseOptions,
): Promise<LicenseScanResult | null> {
  const canvas = captureFrame(undefined) ?? captureFrame(LICENSE_PDF417_REGION);
  if (!canvas) {
    return null;
  }

  return scanLicenseFromCanvas(canvas, options);
}
