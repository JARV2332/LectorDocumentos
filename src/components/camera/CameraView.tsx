"use client";

import { cn } from "@/lib/utils/cn";
import { FocusOverlay } from "@/components/camera/FocusOverlay";
import { SuccessOverlay } from "@/components/ui/SuccessOverlay";
import type { CameraStatus, ScanMode } from "@/lib/types/documents";

interface CameraViewProps {
  containerRef?: React.RefObject<HTMLDivElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  mode: ScanMode;
  status: CameraStatus;
  error: string | null;
  onRetry: () => void;
}

export function CameraView({
  containerRef,
  videoRef,
  mode,
  status,
  error,
  onRetry,
}: CameraViewProps) {
  const isSuccess = status === "success";
  const isLoading = status === "requesting" || status === "idle";

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black">
      <video
        ref={videoRef}
        className={cn(
          "h-full w-full object-cover",
          (status === "error" || isLoading) && "opacity-30",
        )}
        playsInline
        muted
        autoPlay
      />

      <FocusOverlay mode={mode} />

      {isSuccess && <SuccessOverlay />}

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-white">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <p className="text-sm font-medium">Iniciando cámara...</p>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="max-w-sm rounded-2xl bg-white/95 p-5 text-center shadow-xl">
            <p className="text-sm font-semibold text-zinc-900">Cámara no disponible</p>
            <p className="mt-2 text-sm text-zinc-600">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white active:scale-[0.98]"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
