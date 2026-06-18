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

      <div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]",
          isLicense
            ? "top-[38%] h-[22%] w-[88%] rounded-xl"
            : "bottom-[14%] h-[28%] w-[92%] rounded-lg",
        )}
      >
        <span className="absolute -top-8 left-0 right-0 text-center text-xs font-medium text-white/90">
          {isLicense
            ? "Alinea el código PDF417 de la licencia"
            : "Enfoca las 3 líneas MRZ del reverso del DPI"}
        </span>

        <span className="absolute left-2 top-2 h-5 w-5 border-l-2 border-t-2 border-emerald-400" />
        <span className="absolute right-2 top-2 h-5 w-5 border-r-2 border-t-2 border-emerald-400" />
        <span className="absolute bottom-2 left-2 h-5 w-5 border-b-2 border-l-2 border-emerald-400" />
        <span className="absolute bottom-2 right-2 h-5 w-5 border-b-2 border-r-2 border-emerald-400" />
      </div>
    </div>
  );
}
