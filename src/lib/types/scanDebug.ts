export interface LicenseScanDebug {
  pdf417Raw: string | null;
  topBarcodeRaw: string | null;
  qrRaw: string | null;
  nativeBarcodeRaw: string | null;
  regionsScanned: number;
  decodeAttempts: number;
  source: string;
}

export const EMPTY_SCAN_DEBUG: LicenseScanDebug = {
  pdf417Raw: null,
  topBarcodeRaw: null,
  qrRaw: null,
  nativeBarcodeRaw: null,
  regionsScanned: 0,
  decodeAttempts: 0,
  source: "none",
};
