"use client";

import { useEffect, useRef } from "react";
import { scanLicenseFromRegion } from "@/lib/scanner/licenseScanner";
import type { LicenseScanResult } from "@/lib/types/documents";
import { waitForVideoReady } from "@/lib/utils/videoReady";

interface UseBarcodeScannerOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  captureFrame: (region?: import("@/lib/utils/objectCover").NormalizedRegion) => HTMLCanvasElement | null;
  enabled: boolean;
  onDetected: (result: LicenseScanResult) => void;
  onStatus?: (message: string) => void;
}

const SCAN_INTERVAL_MS = 350;

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

      await waitForVideoReady(video);
      if (cancelled) {
        return;
      }

      onStatusRef.current?.("Enfoca el código GRANDE de abajo (PDF417)...");

      intervalId = setInterval(async () => {
        if (cancelled || detectedRef.current || processingRef.current) {
          return;
        }

        processingRef.current = true;

        try {
          const parsed = await scanLicenseFromRegion(captureFrame);
          if (parsed) {
            detectedRef.current = true;
            onDetectedRef.current(parsed);
          }
        } catch {
          onStatusRef.current?.("Acerca el código grande de abajo dentro del recuadro.");
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
  captureFrame: (region?: import("@/lib/utils/objectCover").NormalizedRegion) => HTMLCanvasElement | null,
): Promise<LicenseScanResult | null> {
  return scanLicenseFromRegion(captureFrame);
}
