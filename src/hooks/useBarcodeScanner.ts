"use client";

import { useEffect, useRef } from "react";
import { NotFoundException } from "@zxing/library";
import { scanLicenseFromCanvas } from "@/lib/scanner/licenseScanner";
import type { LicenseScanResult } from "@/lib/types/documents";
import { waitForVideoReady } from "@/lib/utils/videoReady";

interface UseBarcodeScannerOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  captureFrame: () => HTMLCanvasElement | null;
  enabled: boolean;
  onDetected: (result: LicenseScanResult) => void;
  onStatus?: (message: string) => void;
}

const SCAN_INTERVAL_MS = 450;

export function useBarcodeScanner({
  videoRef,
  captureFrame,
  enabled,
  onDetected,
  onStatus,
}: UseBarcodeScannerOptions): void {
  const detectedRef = useRef(false);
  const processingRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  const onStatusRef = useRef(onStatus);

  useEffect(() => {
    onDetectedRef.current = onDetected;
    onStatusRef.current = onStatus;
  }, [onDetected, onStatus]);

  useEffect(() => {
    detectedRef.current = false;

    if (!enabled) {
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const bootstrap = async () => {
      const video = videoRef.current;
      if (!video) {
        onStatusRef.current?.("Esperando cámara...");
        return;
      }

      const ready = await waitForVideoReady(video);
      if (!ready || cancelled) {
        onStatusRef.current?.("Cámara lista. Acerca el código PDF417.");
        return;
      }

      onStatusRef.current?.("Escaneando código PDF417...");

      intervalId = setInterval(async () => {
        if (cancelled || detectedRef.current || processingRef.current) {
          return;
        }

        const canvas = captureFrame();
        if (!canvas) {
          return;
        }

        processingRef.current = true;

        try {
          const parsed = await scanLicenseFromCanvas(canvas);
          if (parsed) {
            detectedRef.current = true;
            onDetectedRef.current(parsed);
          }
        } catch (error) {
          if (!(error instanceof NotFoundException)) {
            onStatusRef.current?.("Escaneando... mantén el código dentro del recuadro.");
          }
        } finally {
          processingRef.current = false;
        }
      }, SCAN_INTERVAL_MS);
    };

    void bootstrap();

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [captureFrame, enabled, videoRef]);
}

export async function scanLicenseNow(
  captureFrame: () => HTMLCanvasElement | null,
): Promise<LicenseScanResult | null> {
  const canvas = captureFrame();
  if (!canvas) {
    return null;
  }

  return scanLicenseFromCanvas(canvas);
}
