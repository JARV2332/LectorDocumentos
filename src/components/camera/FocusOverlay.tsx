"use client";

import { cn } from "@/lib/utils/cn";
import type { ScanMode } from "@/lib/types/documents";

interface FocusOverlayProps {
  mode: ScanMode;
  className?: string;
}

export function FocusOverlay({ mode, className }: FocusOverlayProps) {
  const isLicense = mode === "license";

  return (
    <div className={cn("pointer-events-none absolute inset-0", className)} aria-hidden>
      <div className="absolute inset-0 bg-black/45" />

      {isLicense ? (
        <>
          <div className="absolute bottom-[16%] left-[3%] h-[28%] w-[58%] rounded-xl border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
            <span className="absolute -top-9 left-0 right-0 text-center text-[11px] font-semibold text-emerald-300">
              PDF417 grande (izquierda)
            </span>
            <span className="absolute left-2 top-2 h-4 w-4 border-l-2 border-t-2 border-emerald-400" />
            <span className="absolute bottom-2 right-2 h-4 w-4 border-b-2 border-r-2 border-emerald-400" />
          </div>

          <div className="absolute bottom-[16%] right-[3%] h-[22%] w-[30%] rounded-lg border border-white/40 border-dashed opacity-80">
            <span className="absolute -top-7 left-0 right-0 text-center text-[9px] text-white/60">
              QR (opcional)
            </span>
          </div>

          <span className="absolute bottom-[48%] left-0 right-0 text-center text-[10px] text-white/65">
            Ignora el código pequeño de arriba
          </span>
        </>
      ) : (
        <div className="absolute bottom-[14%] left-1/2 h-[28%] w-[92%] -translate-x-1/2 rounded-lg border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
          <span className="absolute -top-9 left-0 right-0 text-center text-xs font-semibold text-emerald-300">
            3 líneas MRZ del reverso (IDGTM)
          </span>
          <span className="absolute left-2 top-2 h-5 w-5 border-l-2 border-t-2 border-emerald-400" />
          <span className="absolute bottom-2 right-2 h-5 w-5 border-b-2 border-r-2 border-emerald-400" />
        </div>
      )}
    </div>
  );
}
