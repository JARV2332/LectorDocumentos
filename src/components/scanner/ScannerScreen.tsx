"use client";

import { useCallback, useRef, useState } from "react";
import { CameraView } from "@/components/camera/CameraView";
import { BottomNav } from "@/components/ui/BottomNav";
import { ResultSheet } from "@/components/scanner/ResultSheet";
import { ScanDebugPanel } from "@/components/scanner/ScanDebugPanel";
import { useCamera } from "@/hooks/useCamera";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { scanDpiNow, useMrzOcr } from "@/hooks/useMrzOcr";
import type { CameraStatus, ScanMode, ScanResult } from "@/lib/types/documents";
import type { LicenseScanDebug } from "@/lib/types/scanDebug";
import { yieldToMain } from "@/lib/utils/yieldToMain";
import { imageToCanvas, loadImageFromFile } from "@/lib/utils/videoReady";

const SUCCESS_DELAY_MS = 900;

async function scanLicensePhoto(canvas: HTMLCanvasElement, onProgress: (msg: string) => void) {
  const { scanLicenseFromCanvasDetailed } = await import("@/lib/scanner/licenseScanner");

  onProgress("Escaneo rápido...");
  let outcome = await scanLicenseFromCanvasDetailed(canvas, {
    exhaustive: false,
    onProgress,
  });

  if (outcome.result?.cui && (outcome.result.nombres || outcome.result.apellidos)) {
    return outcome;
  }

  onProgress("Escaneo profundo (puede tardar unos segundos)...");
  await yieldToMain();

  outcome = await scanLicenseFromCanvasDetailed(canvas, {
    exhaustive: true,
    onProgress,
  });

  return outcome;
}

async function scanDpiPhoto(canvas: HTMLCanvasElement) {
  const { scanDpiFromCanvas } = await import("@/lib/scanner/dpiScanner");
  return scanDpiFromCanvas(canvas);
}

export function ScannerScreen() {
  const [mode, setMode] = useState<ScanMode>("license");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Abriendo cámara...");
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [scanDebug, setScanDebug] = useState<LicenseScanDebug | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const scanPaused = isProcessingPhoto || sheetOpen;

  const { videoRef, status, error, start, stop, captureFrame } = useCamera({
    enabled: cameraEnabled,
    containerRef,
  });

  const cameraStatus: CameraStatus = showSuccess ? "success" : status;

  const handleDetected = useCallback(
    (result: ScanResult) => {
      setShowSuccess(true);
      setStatusMessage("Documento detectado.");
      stop();

      window.setTimeout(() => {
        setScanResult(result);
        setSheetOpen(true);
        setCameraEnabled(false);
        setIsProcessingPhoto(false);
      }, SUCCESS_DELAY_MS);
    },
    [stop],
  );

  useBarcodeScanner({
    videoRef,
    captureFrame,
    enabled: cameraEnabled && mode === "license" && status === "active" && !scanPaused,
    onDetected: handleDetected,
    onStatus: setStatusMessage,
  });

  useMrzOcr({
    videoRef,
    captureFrame,
    enabled: cameraEnabled && mode === "dpi" && status === "active" && !scanPaused,
    onDetected: handleDetected,
    onStatus: setStatusMessage,
  });

  const handleModeChange = (nextMode: ScanMode) => {
    if (nextMode === mode) {
      return;
    }

    setMode(nextMode);
    setScanResult(null);
    setSheetOpen(false);
    setShowSuccess(false);
    setScanDebug(null);
    setCameraEnabled(true);
    setStatusMessage("Cambiando modo de escaneo...");
  };

  const handleScanAgain = () => {
    setScanResult(null);
    setSheetOpen(false);
    setShowSuccess(false);
    setScanDebug(null);
    setCameraEnabled(true);
    setStatusMessage("Preparando cámara...");
    void start();
  };

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleManualScan = async () => {
    if (isProcessingPhoto || status !== "active") {
      return;
    }

    setIsProcessingPhoto(true);
    setStatusMessage("Leyendo PDF417...");

    try {
      await yieldToMain();

      if (mode === "dpi") {
        const result = await scanDpiNow(captureFrame);
        if (result) {
          handleDetected(result);
          return;
        }
      } else {
        const canvas = captureFrame(undefined);
        if (canvas) {
          const { result, debug } = await scanLicensePhoto(canvas, setStatusMessage);
          setScanDebug(debug);
          if (result) {
            handleDetected(result);
            return;
          }
        }
      }

      setStatusMessage("No se leyó el código. Revisa Debug o intenta otra foto.");
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsProcessingPhoto(true);
    setStatusMessage("Cargando imagen...");

    try {
      await yieldToMain();
      const image = await loadImageFromFile(file);
      const canvas = imageToCanvas(image);

      if (mode === "dpi") {
        const result = await scanDpiPhoto(canvas);
        if (result) {
          handleDetected(result);
          return;
        }
      } else {
        const { result, debug } = await scanLicensePhoto(canvas, setStatusMessage);
        setScanDebug(debug);

        if (result) {
          handleDetected(result);
          return;
        }
      }

      setStatusMessage("Sin lectura completa. Abre Debug para ver detalles.");
    } catch {
      setStatusMessage("Error al procesar la imagen.");
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  return (
    <div className="relative mx-auto flex h-[100dvh] w-full max-w-lg flex-col bg-zinc-950">
      <header className="absolute left-0 right-0 top-0 z-30 bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
        <h1 className="text-lg font-bold text-white">Lector ID Guatemala</h1>
        <p className="text-xs text-white/75">
          {mode === "dpi"
            ? "Reverso del DPI — 3 líneas con IDGTM"
            : "Reverso licencia — PDF417 izquierda + QR derecha"}
        </p>
      </header>

      <main className="relative min-h-0 flex-1 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
        <CameraView
          containerRef={containerRef}
          videoRef={videoRef}
          mode={mode}
          status={cameraStatus}
          error={error}
          onRetry={() => void start()}
        />

        <div className="absolute bottom-28 left-0 right-0 z-20 space-y-2 px-4">
          <div className="rounded-2xl bg-black/60 px-4 py-2 text-center text-xs font-medium text-white backdrop-blur-sm">
            {statusMessage}
          </div>

          <ScanDebugPanel debug={scanDebug} />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleManualScan()}
              disabled={status !== "active" || isProcessingPhoto}
              className="flex-1 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-50 active:scale-[0.98]"
            >
              {isProcessingPhoto ? "Procesando..." : "Capturar ahora"}
            </button>
            <button
              type="button"
              onClick={handleOpenFilePicker}
              className="rounded-xl bg-white/15 px-3 py-3 text-sm font-semibold text-white backdrop-blur-sm active:scale-[0.98]"
            >
              Subir foto
            </button>
          </div>
        </div>
      </main>

      <BottomNav mode={mode} onChange={handleModeChange} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleFileSelected(event)}
      />

      <ResultSheet
        result={scanResult}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onScanAgain={handleScanAgain}
      />
    </div>
  );
}
