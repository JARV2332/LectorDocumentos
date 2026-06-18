"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { FormField } from "@/components/ui/FormField";
import type { ScanResult } from "@/lib/types/documents";

interface ResultSheetProps {
  result: ScanResult | null;
  open: boolean;
  onClose: () => void;
  onScanAgain: () => void;
}

function resultToFormData(result: ScanResult): Record<string, string> {
  if (result.type === "dpi") {
    return {
      cui: result.cui,
      nombres: result.nombres,
      apellidos: result.apellidos,
      fechaNacimiento: result.fechaNacimiento,
    };
  }

  return {
    numeroLicencia: result.numeroLicencia,
    cui: result.cui,
    nombres: result.nombres,
    apellidos: result.apellidos,
    tipoLicencia: result.tipoLicencia,
    fechaNacimiento: result.fechaNacimiento,
    restricciones: result.restricciones,
    tipoSangre: result.tipoSangre,
  };
}

function ResultForm({
  result,
  onClose,
  onScanAgain,
}: {
  result: ScanResult;
  onClose: () => void;
  onScanAgain: () => void;
}) {
  const [formData, setFormData] = useState(() => resultToFormData(result));

  const updateField = (key: string, value: string) => {
    setFormData((current) => ({ ...current, [key]: value }));
  };

  const licenseHasPartialData =
    result.type === "license" &&
    !result.nombres &&
    !result.apellidos &&
    (result.fechaNacimiento || result.numeroLicencia || result.tipoLicencia);

  return (
    <div className="space-y-4">
      {result.type === "dpi" ? (
        <>
          <FormField
            label="CUI"
            value={formData.cui ?? ""}
            onChange={(value) => updateField("cui", value)}
            placeholder="13 dígitos"
            inputMode="numeric"
          />
          <FormField
            label="Nombres"
            value={formData.nombres ?? ""}
            onChange={(value) => updateField("nombres", value)}
          />
          <FormField
            label="Apellidos"
            value={formData.apellidos ?? ""}
            onChange={(value) => updateField("apellidos", value)}
          />
          <FormField
            label="Fecha de nacimiento"
            value={formData.fechaNacimiento ?? ""}
            onChange={(value) => updateField("fechaNacimiento", value)}
            placeholder="YYYY-MM-DD"
          />
        </>
      ) : (
        <>
          {licenseHasPartialData && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Faltan nombre o CUI: la foto no leyó el PDF417. Escanea con lector USB el código grande
              de la izquierda, usa &quot;Pegar código&quot;, o completa los campos manualmente.
            </p>
          )}

          <FormField
            label="Número de licencia / serial"
            value={formData.numeroLicencia ?? ""}
            onChange={(value) => updateField("numeroLicencia", value)}
          />
          <FormField
            label="CUI"
            value={formData.cui ?? ""}
            onChange={(value) => updateField("cui", value)}
            placeholder="13 dígitos"
            inputMode="numeric"
          />
          <FormField
            label="Nombres"
            value={formData.nombres ?? ""}
            onChange={(value) => updateField("nombres", value)}
          />
          <FormField
            label="Apellidos"
            value={formData.apellidos ?? ""}
            onChange={(value) => updateField("apellidos", value)}
          />
          <FormField
            label="Tipo de licencia"
            value={formData.tipoLicencia ?? ""}
            onChange={(value) => updateField("tipoLicencia", value)}
          />
          <FormField
            label="Fecha de nacimiento"
            value={formData.fechaNacimiento ?? ""}
            onChange={(value) => updateField("fechaNacimiento", value)}
            placeholder="YYYY-MM-DD"
          />
          <FormField
            label="Restricciones"
            value={formData.restricciones ?? ""}
            onChange={(value) => updateField("restricciones", value)}
          />
          <FormField
            label="Tipo de sangre"
            value={formData.tipoSangre ?? ""}
            onChange={(value) => updateField("tipoSangre", value)}
          />
        </>
      )}

      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
        <button
          type="button"
          onClick={onScanAgain}
          className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 active:scale-[0.98]"
        >
          Escanear de nuevo
        </button>
        <button
          type="button"
          onClick={() => {
            console.info("Datos validados:", formData);
            onClose();
          }}
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white active:scale-[0.98]"
        >
          Confirmar datos
        </button>
      </div>
    </div>
  );
}

export function ResultSheet({ result, open, onClose, onScanAgain }: ResultSheetProps) {
  if (!result) {
    return null;
  }

  const title = result.type === "dpi" ? "Datos del DPI" : "Datos de la Licencia";
  const formKey =
    result.type === "dpi"
      ? `${result.cui}-${result.fechaNacimiento}`
      : `${result.numeroLicencia}-${result.cui}-${result.fechaNacimiento}`;

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <ResultForm key={formKey} result={result} onClose={onClose} onScanAgain={onScanAgain} />
    </BottomSheet>
  );
}
