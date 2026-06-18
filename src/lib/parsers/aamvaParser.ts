import type { LicenseScanResult } from "@/lib/types/documents";

const AAMVA_FIELD_PATTERN =
  /(?:^|\n)([A-Z]{3})([^\n]*?)(?=\n[A-Z]{3}|\n@|\nANSI|$)/g;

const LICENSE_TYPE_FIELDS = ["DCA", "DCB", "DCD", "DDA", "DDB", "DDC"] as const;

function extractFields(raw: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const normalized = raw.replace(/\r\n/g, "\n").trim();

  let match: RegExpExecArray | null;
  AAMVA_FIELD_PATTERN.lastIndex = 0;

  while ((match = AAMVA_FIELD_PATTERN.exec(normalized)) !== null) {
    const [, code, value] = match;
    fields[code] = value.trim();
  }

  if (Object.keys(fields).length === 0) {
    const inlinePattern = /([A-Z]{3})([^A-Z\n@]{1,200})/g;
    let inlineMatch: RegExpExecArray | null;
    while ((inlineMatch = inlinePattern.exec(normalized)) !== null) {
      const [, code, value] = inlineMatch;
      if (!fields[code]) {
        fields[code] = value.trim();
      }
    }
  }

  return fields;
}

function extractCui(fields: Record<string, string>): string {
  const candidates = [
    fields.DAQ,
    fields.DCK,
    fields.DCI,
    fields.ZGT,
    fields.ZGTCUI,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length === 13) {
      return digits;
    }
  }

  const allDigits = Object.values(fields).join(" ").replace(/\D/g, "");
  const cuiMatch = allDigits.match(/\d{13}/);
  return cuiMatch?.[0] ?? "";
}

function extractLicenseType(fields: Record<string, string>): string {
  for (const field of LICENSE_TYPE_FIELDS) {
    if (fields[field]) {
      return fields[field];
    }
  }
  return fields.DCA ?? "";
}

function formatName(value: string): string {
  return value
    .replace(/<+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function parseAamvaBarcode(rawBarcode: string): LicenseScanResult | null {
  if (!rawBarcode || rawBarcode.length < 20) {
    return null;
  }

  const fields = extractFields(rawBarcode);
  const apellidos = formatName(fields.DCS ?? fields.DAB ?? "");
  const nombres = formatName(
    [fields.DAC, fields.DAD].filter(Boolean).join(" ") || fields.DCT || "",
  );
  const numeroLicencia = (fields.DAQ ?? fields.DCK ?? "").replace(/\s+/g, "");
  const cui = extractCui(fields);
  const tipoLicencia = extractLicenseType(fields);

  if (!numeroLicencia && !cui && !apellidos && !nombres) {
    return null;
  }

  return {
    type: "license",
    numeroLicencia,
    cui,
    nombres,
    apellidos,
    tipoLicencia,
    rawBarcode,
  };
}
