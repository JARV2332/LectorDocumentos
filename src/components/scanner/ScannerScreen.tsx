"use client";

import { useCallback, useRef, useState } from "react";
import { CameraView } from "@/components/camera/CameraView";
import { BottomNav } from "@/components/ui/BottomNav";
import { ManualBarcodeSheet } from "@/components/scanner/ManualBarcodeSheet";
import { ResultSheet } from "@/components/scanner/ResultSheet";
import { ScanDebugPanel } from "@/components/scanner/ScanDebugPanel";
import { useBarcodeWedge } from "@/hooks/useBarcodeWedge";
import { useCamera } from "@/hooks/useCamera";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { scanDpiNow, useMrzOcr } from "@/hooks/useMrzOcr";
import type { CameraStatus, LicenseScanResult, ScanMode, ScanResult } from "@/lib/types/documents";
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
  const [manualSheetOpen, setManualSheetOpen] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Preparando...");
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [scanDebug, setScanDebug] = useState<LicenseScanDebug | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const scanPaused = isProcessingPhoto || sheetOpen || manualSheetOpen;

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

  const handleLicenseFromBarcode = useCallback(
    (result: LicenseScanResult) => {
      setScanDebug({
        pdf417Raw: result.rawBarcode.slice(0, 180),
        source: "wedge",
        regionsScanned: 0,
        decodeAttempts: 0,
        topBarcodeRaw: "",
        qrRaw: "",
        nativeBarcodeRaw: "",
      });
      handleDetected(result);
    },
    [handleDetected],
  );

  useBarcodeWedge({
    enabled: mode === "license" && !scanPaused,
    onDetected: handleLicenseFromBarcode,
    onScanning: (length) => {
      if (length > 3) {
        setStatusMessage("Recibiendo escaneo del lector...");
      }
    },
  });

  useBarcodeScanner({
    videoRef,
    captureFrame,
    enabled: false,
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
    setManualSheetOpen(false);
    setShowSuccess(false);
    setScanDebug(null);
    setCameraEnabled(true);
    setStatusMessage(
      nextMode === "license"
        ? "Conecta lector USB y escanea el PDF417 (abajo izquierda)"
        : "Cambiando modo de escaneo...",
    );
  };

  const handleScanAgain = () => {
    setScanResult(null);
    setSheetOpen(false);
    setManualSheetOpen(false);
    setShowSuccess(false);
    setScanDebug(null);
    setCameraEnabled(true);
    setStatusMessage(
      mode === "license"
        ? "Conecta lector USB y escanea el PDF417 (abajo izquierda)"
        : "Preparando cámara...",
    );
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

      setStatusMessage("No se leyó el código. Usa lector USB o pega el texto del PDF417.");
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

      setStatusMessage("Sin lectura completa. Usa lector USB o pega el código PDF417.");
    } catch {
      setStatusMessage("Error al procesar la imagen.");
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const licenseStatus =
    statusMessage === "Preparando..." || statusMessage === "Abriendo cámara..."
      ? "Conecta lector USB y escanea el PDF417 (abajo izquierda). También puedes pegar el texto."
      : statusMessage;

  return (
    <div className="relative mx-auto flex h-[100dvh] w-full max-w-lg flex-col bg-zinc-950">
      <header className="absolute left-0 right-0 top-0 z-30 bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
        <h1 className="text-lg font-bold text-white">Lector ID Guatemala</h1>
        <p className="text-xs text-white/75">
          {mode === "dpi"
            ? "Reverso del DPI — 3 líneas con IDGTM"
            : "Licencia — lector USB en PDF417 (izquierda) o pegar código"}
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
            {mode === "license" ? licenseStatus : statusMessage}
          </div>

          {mode === "license" && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/50 px-3 py-2 text-[11px] leading-relaxed text-emerald-100">
              <strong className="text-emerald-300">Más confiable:</strong> lector de barras USB/Bluetooth
              apuntando al PDF417 grande. Si ya lo escaneaste en otra app, usa &quot;Pegar código&quot;.
            </div>
          )}

          <ScanDebugPanel debug={scanDebug} />

          {mode === "license" ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setManualSheetOpen(true)}
                className="w-full rounded-xl bg-emerald-600 px-3 py-3.5 text-sm font-semibold text-white active:scale-[0.98]"
              >
                Pegar código PDF417
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleOpenFilePicker}
                  disabled={isProcessingPhoto}
                  className="flex-1 rounded-xl bg-white/15 px-3 py-3 text-sm font-semibold text-white backdrop-blur-sm disabled:opacity-50 active:scale-[0.98]"
                >
                  Subir foto
                </button>
                <button
                  type="button"
                  onClick={() => void handleManualScan()}
                  disabled={status !== "active" || isProcessingPhoto}
                  className="flex-1 rounded-xl bg-white/10 px-3 py-3 text-sm font-semibold text-white/90 disabled:opacity-50 active:scale-[0.98]"
                >
                  {isProcessingPhoto ? "Procesando..." : "Capturar"}
                </button>
              </div>
            </div>
          ) : (
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
          )}
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

      <ManualBarcodeSheet
        open={manualSheetOpen}
        onClose={() => setManualSheetOpen(false)}
        onParsed={handleLicenseFromBarcode}
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
