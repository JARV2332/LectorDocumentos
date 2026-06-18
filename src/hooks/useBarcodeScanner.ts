"use client";

import { useEffect, useRef } from "react";
import { scanLicenseLiveFrame } from "@/lib/scanner/licenseScannerLive";
import type { LicenseScanResult } from "@/lib/types/documents";
import type { NormalizedRegion } from "@/lib/utils/objectCover";
import { waitForVideoReady } from "@/lib/utils/videoReady";

interface UseBarcodeScannerOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  captureFrame: (region?: NormalizedRegion) => HTMLCanvasElement | null;
  enabled: boolean;
  onDetected: (result: LicenseScanResult) => void;
  onStatus?: (message: string) => void;
}

const SCAN_INTERVAL_MS = 1100;

export function useBarcodeScanner({
  videoRef,
  captureFrame,
  enabled,
  onDetected,
  onStatus,
}: UseBarcodeScannerOptions): void {
  const detectedRef = useRef(false);
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

      onStatusRef.current?.("Enfoca el PDF417 de la izquierda...");

      intervalId = setInterval(() => {
        if (cancelled || detectedRef.current) {
          return;
        }

        const parsed = scanLicenseLiveFrame(captureFrame);
        if (parsed) {
          detectedRef.current = true;
          onDetectedRef.current(parsed);
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
