"use client";

import { useCallback, useState } from "react";
import { CameraView } from "@/components/camera/CameraView";
import { BottomNav } from "@/components/ui/BottomNav";
import { ResultSheet } from "@/components/scanner/ResultSheet";
import { useCamera } from "@/hooks/useCamera";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useMrzOcr } from "@/hooks/useMrzOcr";
import type { CameraStatus, ScanMode, ScanResult } from "@/lib/types/documents";

const SUCCESS_DELAY_MS = 900;

export function ScannerScreen() {
  const [mode, setMode] = useState<ScanMode>("dpi");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);

  const { videoRef, status, error, start, stop, captureFrame } = useCamera({
    enabled: cameraEnabled,
  });

  const cameraStatus: CameraStatus = showSuccess ? "success" : status;

  const handleDetected = useCallback(
    (result: ScanResult) => {
      setShowSuccess(true);
      stop();

      window.setTimeout(() => {
        setScanResult(result);
        setSheetOpen(true);
        setCameraEnabled(false);
      }, SUCCESS_DELAY_MS);
    },
    [stop],
  );

  useBarcodeScanner({
    videoRef,
    enabled: cameraEnabled && mode === "license" && status === "active" && !sheetOpen,
    onDetected: handleDetected,
  });

  useMrzOcr({
    videoRef,
    captureFrame,
    enabled: cameraEnabled && mode === "dpi" && status === "active" && !sheetOpen,
    onDetected: handleDetected,
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
  };

  const handleScanAgain = () => {
    setScanResult(null);
    setSheetOpen(false);
    setShowSuccess(false);
    setCameraEnabled(true);
    void start();
  };

  const handleCloseSheet = () => {
    setSheetOpen(false);
  };

  return (
    <div className="relative mx-auto flex h-[100dvh] w-full max-w-lg flex-col bg-zinc-950">
      <header className="absolute left-0 right-0 top-0 z-30 bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
        <h1 className="text-lg font-bold text-white">Lector ID Guatemala</h1>
        <p className="text-xs text-white/75">
          {mode === "dpi"
            ? "Escanea el reverso del DPI (MRZ)"
            : "Escanea el código PDF417 de la licencia"}
        </p>
      </header>

      <main className="relative min-h-0 flex-1 pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
        <CameraView
          videoRef={videoRef}
          mode={mode}
          status={cameraStatus}
          error={error}
          onRetry={() => void start()}
        />

        {status === "active" && !sheetOpen && (
          <div className="absolute bottom-24 left-0 right-0 flex justify-center px-4">
            <div className="rounded-full bg-black/55 px-4 py-2 text-xs font-medium text-white backdrop-blur-sm">
              {mode === "dpi"
                ? "Buscando líneas IDGTM..."
                : "Buscando código PDF417..."}
            </div>
          </div>
        )}
      </main>

      <BottomNav mode={mode} onChange={handleModeChange} />

      <ResultSheet
        result={scanResult}
        open={sheetOpen}
        onClose={handleCloseSheet}
        onScanAgain={handleScanAgain}
      />
    </div>
  );
}
