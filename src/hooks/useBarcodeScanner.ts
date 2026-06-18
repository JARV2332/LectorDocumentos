"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  BarcodeFormat,
  BrowserMultiFormatReader,
  DecodeHintType,
  NotFoundException,
} from "@zxing/library";
import { parseAamvaBarcode } from "@/lib/parsers/aamvaParser";
import type { LicenseScanResult } from "@/lib/types/documents";

interface UseBarcodeScannerOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  onDetected: (result: LicenseScanResult) => void;
}

export function useBarcodeScanner({
  videoRef,
  enabled,
  onDetected,
}: UseBarcodeScannerOptions): void {
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const detectedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  const stopScanning = useCallback(() => {
    readerRef.current?.reset();
    readerRef.current = null;
  }, []);

  useEffect(() => {
    detectedRef.current = false;

    if (!enabled) {
      stopScanning();
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.PDF_417]);
    hints.set(DecodeHintType.TRY_HARDER, true);

    const reader = new BrowserMultiFormatReader(hints, 500);
    readerRef.current = reader;

    void reader.decodeFromVideoElementContinuously(video, (result, error) => {
      if (detectedRef.current) {
        return;
      }

      if (error && !(error instanceof NotFoundException)) {
        return;
      }

      if (!result) {
        return;
      }

      const parsed = parseAamvaBarcode(result.getText());
      if (!parsed) {
        return;
      }

      detectedRef.current = true;
      stopScanning();
      onDetectedRef.current(parsed);
    });

    return () => {
      stopScanning();
    };
  }, [enabled, stopScanning, videoRef]);
}
