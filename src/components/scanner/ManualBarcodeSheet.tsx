"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { parsePastedBarcode } from "@/hooks/useBarcodeWedge";
import type { LicenseScanResult } from "@/lib/types/documents";

interface ManualBarcodeSheetProps {
  open: boolean;
  onClose: () => void;
  onParsed: (result: LicenseScanResult) => void;
}

export function ManualBarcodeSheet({ open, onClose, onParsed }: ManualBarcodeSheetProps) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const parsed = parsePastedBarcode(raw);
    if (!parsed) {
      setError("Texto no reconocido. Pega la salida completa del lector PDF417.");
      return;
    }

    setError("");
    setRaw("");
    onParsed(parsed);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Pegar código de barras">
      <div className="space-y-4">
        <p className="text-sm text-zinc-600">
          Escanea con tu lector USB/Bluetooth (PDF417) o pega aquí el texto que imprime. Es la forma
          más confiable de leer nombre y CUI.
        </p>

        <textarea
          value={raw}
          onChange={(event) => {
            setRaw(event.target.value);
            setError("");
          }}
          rows={6}
          placeholder="Pega aquí el contenido del código PDF417..."
          className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white active:scale-[0.98]"
        >
          Procesar código
        </button>
      </div>
    </BottomSheet>
  );
}
