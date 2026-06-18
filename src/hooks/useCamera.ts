"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraStatus } from "@/lib/types/documents";

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

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
      }

      setInternalStatus("active");
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Permiso de cámara denegado. Habilítalo en la configuración del navegador."
          : "No se pudo acceder a la cámara trasera.";

      setError(message);
      setInternalStatus("error");
    }
  }, [enabled]);

  const captureFrame = useCallback((): HTMLCanvasElement | null => {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
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
