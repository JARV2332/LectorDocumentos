"use client";

import { useCallback, useEffect, useRef } from "react";
import { parseDpiMrz } from "@/lib/parsers/mrzParser";
import type { DpiScanResult } from "@/lib/types/documents";

interface UseMrzOcrOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  captureFrame: () => HTMLCanvasElement | null;
  enabled: boolean;
  onDetected: (result: DpiScanResult) => void;
}

const SCAN_INTERVAL_MS = 1200;

export function useMrzOcr({
  videoRef,
  captureFrame,
  enabled,
  onDetected,
}: UseMrzOcrOptions): void {
  const processingRef = useRef(false);
  const detectedRef = useRef(false);
  const onDetectedRef = useRef(onDetected);
  const workerRef = useRef<Awaited<
    ReturnType<typeof import("tesseract.js")["createWorker"]>
  > | null>(null);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  const stopWorker = useCallback(async () => {
    if (workerRef.current) {
      await workerRef.current.terminate();
      workerRef.current = null;
    }
  }, []);

  useEffect(() => {
    detectedRef.current = false;

    if (!enabled) {
      void stopWorker();
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const bootstrap = async () => {
      const { createWorker, PSM } = await import("tesseract.js");
      if (cancelled) {
        return;
      }

      const worker = await createWorker("eng", 1, {
        logger: () => undefined,
      });

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
      });

      workerRef.current = worker;

      intervalId = setInterval(async () => {
        if (
          cancelled ||
          detectedRef.current ||
          processingRef.current ||
          !videoRef.current ||
          videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
        ) {
          return;
        }

        const canvas = captureFrame();
        if (!canvas) {
          return;
        }

        processingRef.current = true;

        try {
          const cropped = cropMrzRegion(canvas);
          const { data } = await worker.recognize(cropped);
          const parsed = parseDpiMrz(data.text);

          if (parsed) {
            detectedRef.current = true;
            onDetectedRef.current(parsed);
          }
        } catch {
          // OCR frame failures are expected during live scanning.
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
      void stopWorker();
    };
  }, [captureFrame, enabled, stopWorker, videoRef]);
}

function cropMrzRegion(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const cropHeight = Math.floor(source.height * 0.35);
  const cropY = source.height - cropHeight;

  canvas.width = source.width;
  canvas.height = cropHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    return source;
  }

  context.drawImage(
    source,
    0,
    cropY,
    source.width,
    cropHeight,
    0,
    0,
    source.width,
    cropHeight,
  );

  context.filter = "contrast(1.4) brightness(1.05)";
  context.drawImage(canvas, 0, 0);

  return canvas;
}
