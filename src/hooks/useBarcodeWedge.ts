"use client";

import { useEffect, useRef } from "react";
import { parseGuatemalaLicense } from "@/lib/parsers/guatemalaLicenseParser";
import type { LicenseScanResult } from "@/lib/types/documents";

interface UseBarcodeWedgeOptions {
  enabled: boolean;
  onDetected: (result: LicenseScanResult) => void;
  onScanning?: (bufferLength: number) => void;
}

const SCAN_GAP_MS = 120;
const MIN_BARCODE_LENGTH = 15;

/**
 * Lectores USB/Bluetooth de barras actúan como teclado:
 * escriben el texto del PDF417 y terminan con Enter.
 */
export function useBarcodeWedge({
  enabled,
  onDetected,
  onScanning,
}: UseBarcodeWedgeOptions): void {
  const bufferRef = useRef("");
  const lastKeyRef = useRef(0);
  const onDetectedRef = useRef(onDetected);
  const onScanningRef = useRef(onScanning);

  useEffect(() => {
    onDetectedRef.current = onDetected;
    onScanningRef.current = onScanning;
  }, [onDetected, onScanning]);

  useEffect(() => {
    if (!enabled) {
      bufferRef.current = "";
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const now = Date.now();
      if (now - lastKeyRef.current > SCAN_GAP_MS) {
        bufferRef.current = "";
      }
      lastKeyRef.current = now;

      if (event.key === "Enter") {
        const raw = bufferRef.current.trim();
        bufferRef.current = "";

        if (raw.length < MIN_BARCODE_LENGTH) {
          return;
        }

        const parsed = parseGuatemalaLicense(raw);
        if (parsed) {
          event.preventDefault();
          onDetectedRef.current({ ...parsed, rawBarcode: raw });
        }
        return;
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        bufferRef.current += event.key;
        onScanningRef.current?.(bufferRef.current.length);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}

export function parsePastedBarcode(raw: string): LicenseScanResult | null {
  const trimmed = raw.trim();
  if (trimmed.length < MIN_BARCODE_LENGTH) {
    return null;
  }

  return parseGuatemalaLicense(trimmed);
}
