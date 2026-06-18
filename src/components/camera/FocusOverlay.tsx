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
          "absolute left-1/2 -translate-x-1/2 border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]",
          isLicense
            ? "bottom-[18%] h-[24%] w-[90%] rounded-xl"
            : "bottom-[14%] h-[28%] w-[92%] rounded-lg",
        )}
      >
        <span className="absolute -top-10 left-0 right-0 text-center text-xs font-semibold text-emerald-300">
          {isLicense
            ? "Código GRANDE de abajo (PDF417)"
            : "3 líneas MRZ del reverso (IDGTM)"}
        </span>

        {isLicense && (
          <span className="absolute -top-[4.5rem] left-0 right-0 text-center text-[10px] text-white/70">
            Ignora el código pequeño de arriba
          </span>
        )}

        <span className="absolute left-2 top-2 h-5 w-5 border-l-2 border-t-2 border-emerald-400" />
        <span className="absolute right-2 top-2 h-5 w-5 border-r-2 border-t-2 border-emerald-400" />
        <span className="absolute bottom-2 left-2 h-5 w-5 border-b-2 border-l-2 border-emerald-400" />
        <span className="absolute bottom-2 right-2 h-5 w-5 border-b-2 border-r-2 border-emerald-400" />
      </div>
    </div>
  );
}
