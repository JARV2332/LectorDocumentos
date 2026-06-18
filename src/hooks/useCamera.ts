"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraStatus } from "@/lib/types/documents";
import {
  captureVideoFrame,
  getCameraStream,
  waitForVideoReady,
} from "@/lib/utils/videoReady";

interface UseCameraOptions {
  enabled?: boolean;
}

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  captureFrame: () => HTMLCanvasElement | null;
}

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const { enabled = true } = options;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [internalStatus, setInternalStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stop = useCallback(() => {
    stopStream();
    setInternalStatus("idle");
  }, [stopStream]);

  const start = useCallback(async () => {
    if (!enabled) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("La cámara no está disponible en este dispositivo.");
      setInternalStatus("error");
      return;
    }

    try {
      setError(null);
      setInternalStatus("requesting");
      stopStream();

      const stream = await getCameraStream();
      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.muted = true;
        await video.play();
        await waitForVideoReady(video);
      }

      setInternalStatus("active");
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Permiso de cámara denegado. Tócalo en la barra del navegador y elige Permitir."
          : "No se pudo abrir la cámara. Prueba subir una foto del documento.";

      setError(message);
      setInternalStatus("error");
    }
  }, [enabled, stopStream]);

  const captureFrame = useCallback((): HTMLCanvasElement | null => {
    const video = videoRef.current;
    if (!video) {
      return null;
    }

    return captureVideoFrame(video);
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopStream();
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      await start();
      if (cancelled) {
        stopStream();
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [enabled, start, stopStream]);

  const status: CameraStatus = enabled ? internalStatus : "idle";

  return {
    videoRef,
    status,
    error,
    start,
    stop,
    captureFrame,
  };
}
