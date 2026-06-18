"use client";

import { useEffect, useRef } from "react";
import { getDpiOcrWorker, scanDpiFromCanvas } from "@/lib/scanner/dpiScanner";
import type { DpiScanResult } from "@/lib/types/documents";
import type { NormalizedRegion } from "@/lib/utils/objectCover";
import { waitForVideoReady } from "@/lib/utils/videoReady";

interface UseMrzOcrOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  captureFrame: (region?: NormalizedRegion) => HTMLCanvasElement | null;
  enabled: boolean;
  onDetected: (result: DpiScanResult) => void;
  onStatus?: (message: string) => void;
}

const DPI_MRZ_REGION: NormalizedRegion = { x: 0.04, y: 0.55, width: 0.92, height: 0.38 };
const SCAN_INTERVAL_MS = 1600;

export function useMrzOcr({
  videoRef,
  captureFrame,
  enabled,
  onDetected,
  onStatus,
}: UseMrzOcrOptions): void {
  const processingRef = useRef(false);
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
      onStatusRef.current?.("Cargando motor OCR (solo la 1ra vez)...");
      const worker = await getDpiOcrWorker();

      const video = videoRef.current;
      if (video) {
        await waitForVideoReady(video);
      }

      if (cancelled) {
        return;
      }

      onStatusRef.current?.("Escaneando líneas IDGTM del reverso...");

      intervalId = setInterval(async () => {
        if (
          cancelled ||
          detectedRef.current ||
          processingRef.current ||
          !videoRef.current ||
          videoRef.current.videoWidth === 0
        ) {
          return;
        }

        const canvas = captureFrame(DPI_MRZ_REGION);
        if (!canvas) {
          return;
        }

        processingRef.current = true;

        try {
          const parsed = await scanDpiFromCanvas(canvas, worker);
          if (parsed) {
            detectedRef.current = true;
            onDetectedRef.current(parsed);
          }
        } catch {
          onStatusRef.current?.("Ajusta la luz y enfoca las 3 líneas inferiores.");
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

export async function scanDpiNow(
  captureFrame: (region?: NormalizedRegion) => HTMLCanvasElement | null,
): Promise<DpiScanResult | null> {
  const canvas = captureFrame(DPI_MRZ_REGION) ?? captureFrame();
  if (!canvas) {
    return null;
  }

  const worker = await getDpiOcrWorker();
  return scanDpiFromCanvas(canvas, worker);
}
