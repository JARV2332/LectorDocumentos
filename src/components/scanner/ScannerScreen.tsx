"use client";

import { useCallback, useRef, useState } from "react";
import { CameraView } from "@/components/camera/CameraView";
import { BottomNav } from "@/components/ui/BottomNav";
import { ResultSheet } from "@/components/scanner/ResultSheet";
import { useCamera } from "@/hooks/useCamera";
import { scanLicenseNow, useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { scanDpiNow, useMrzOcr } from "@/hooks/useMrzOcr";
import { scanDpiFromCanvas } from "@/lib/scanner/dpiScanner";
import { scanLicenseFromCanvas } from "@/lib/scanner/licenseScanner";
import type { CameraStatus, ScanMode, ScanResult } from "@/lib/types/documents";
import { imageToCanvas, loadImageFromFile } from "@/lib/utils/videoReady";

const SUCCESS_DELAY_MS = 900;

export function ScannerScreen() {
  const [mode, setMode] = useState<ScanMode>("license");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Abriendo cámara...");
  const [isManualScanning, setIsManualScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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
        setIsManualScanning(false);
      }, SUCCESS_DELAY_MS);
    },
    [stop],
  );

  useBarcodeScanner({
    videoRef,
    captureFrame,
    enabled: cameraEnabled && mode === "license" && status === "active" && !sheetOpen,
    onDetected: handleDetected,
    onStatus: setStatusMessage,
  });

  useMrzOcr({
    videoRef,
    captureFrame,
    enabled: cameraEnabled && mode === "dpi" && status === "active" && !sheetOpen,
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
    setCameraEnabled(true);
    setStatusMessage("Cambiando modo de escaneo...");
  };

  const handleScanAgain = () => {
    setScanResult(null);
    setSheetOpen(false);
    setShowSuccess(false);
    setCameraEnabled(true);
    setStatusMessage("Preparando cámara...");
    void start();
  };

  const handleManualScan = async () => {
    if (isManualScanning || status !== "active") {
      return;
    }

    setIsManualScanning(true);
    setStatusMessage("Leyendo código de abajo...");

    try {
      const result =
        mode === "dpi" ? await scanDpiNow(captureFrame) : await scanLicenseNow(captureFrame);

      if (result) {
        handleDetected(result);
        return;
      }

      setStatusMessage(
        mode === "dpi"
          ? "No se leyó el MRZ. Enfoca el reverso del DPI o sube una foto."
          : "No se leyó el PDF417 de abajo. Acércalo más o sube una foto.",
      );
    } finally {
      setIsManualScanning(false);
    }
  };

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsManualScanning(true);
    setStatusMessage("Procesando foto del reverso...");

    try {
      const image = await loadImageFromFile(file);
      const canvas = imageToCanvas(image);
      const result =
        mode === "dpi"
          ? await scanDpiFromCanvas(canvas)
          : await scanLicenseFromCanvas(canvas);

      if (result) {
        handleDetected(result);
        return;
      }

      setStatusMessage("No se detectó el código. Foto del reverso, buena luz, código de abajo visible.");
    } catch {
      setStatusMessage("Error al procesar la imagen.");
    } finally {
      setIsManualScanning(false);
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

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleManualScan()}
              disabled={status !== "active" || isManualScanning}
              className="flex-1 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white disabled:opacity-50 active:scale-[0.98]"
            >
              {isManualScanning ? "Procesando..." : "Capturar ahora"}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isManualScanning}
              className="rounded-xl bg-white/15 px-3 py-3 text-sm font-semibold text-white backdrop-blur-sm disabled:opacity-50 active:scale-[0.98]"
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
        capture="environment"
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
