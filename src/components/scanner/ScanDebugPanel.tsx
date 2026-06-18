"use client";

import type { LicenseScanDebug } from "@/lib/types/scanDebug";

interface ScanDebugPanelProps {
  debug: LicenseScanDebug | null;
}

export function ScanDebugPanel({ debug }: ScanDebugPanelProps) {
  if (!debug) {
    return null;
  }

  return (
    <details className="rounded-xl bg-zinc-900/90 px-3 py-2 text-[10px] text-zinc-300 backdrop-blur-sm">
      <summary className="cursor-pointer font-semibold text-emerald-400">
        Debug escaneo ({debug.decodeAttempts} intentos, {debug.regionsScanned} regiones)
      </summary>
      <div className="mt-2 space-y-1 break-all font-mono">
        <p>Fuente: {debug.source}</p>
        <p>PDF417: {debug.pdf417Raw ?? "—"}</p>
        <p>Top barcode: {debug.topBarcodeRaw ?? "—"}</p>
        <p>QR: {debug.qrRaw ?? "—"}</p>
        <p>Nativo: {debug.nativeBarcodeRaw ?? "—"}</p>
      </div>
    </details>
  );
}
