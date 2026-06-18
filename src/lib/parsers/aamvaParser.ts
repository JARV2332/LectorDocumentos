import type { LicenseScanResult } from "@/lib/types/documents";
import { findValidCuiInText, isValidGuatemalaCui } from "@/lib/parsers/cuiValidator";

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

function extractBirthDateFromFields(fields: Record<string, string>, raw: string): string {
  const dbd = fields.DBD?.replace(/\D/g, "") ?? "";
  if (/^\d{8}$/.test(dbd)) {
    const month = dbd.slice(0, 2);
    const day = dbd.slice(2, 4);
    const year = dbd.slice(4, 8);
    return `${year}-${month}-${day}`;
  }

  return extractBirthDateFromRaw(raw);
}

function extractCui(
  fields: Record<string, string>,
  raw: string,
  birthDate = "",
): string {
  const customFields = Object.entries(fields).filter(([code]) => code.startsWith("ZG"));
  const candidates = [
    ...customFields.map(([, value]) => value),
    fields.DCI,
    fields.DCK,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length === 13 && isValidGuatemalaCui(digits)) {
      const validated = findValidCuiInText(digits, birthDate);
      if (validated) {
        return validated;
      }
    }
  }

  return findValidCuiInText(raw, birthDate);
}

function extractLicenseType(fields: Record<string, string>): string {
  for (const field of LICENSE_TYPE_FIELDS) {
    if (fields[field]) {
      return fields[field];
    }
  }
  return fields.DCA ?? fields.DAW ?? "";
}

function formatName(value: string): string {
  return value
    .replace(/<+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractFallbackNames(raw: string): { nombres: string; apellidos: string } {
  const nameMatch = raw.match(/(?:DCS|DAB)([A-Z\s<]+)/);
  const givenMatch = raw.match(/(?:DAC|DCT)([A-Z\s<]+)/);

  return {
    apellidos: formatName(nameMatch?.[1] ?? ""),
    nombres: formatName(givenMatch?.[1] ?? ""),
  };
}

export function parseAamvaBarcode(rawBarcode: string): LicenseScanResult | null {
  if (!rawBarcode || rawBarcode.length < 10) {
    return null;
  }

  const fields = extractFields(rawBarcode);
  const fallbackNames = extractFallbackNames(rawBarcode);
  const apellidos = formatName(fields.DCS ?? fields.DAB ?? fallbackNames.apellidos);
  const nombres = formatName(
    [fields.DAC, fields.DAD].filter(Boolean).join(" ") ||
      fields.DCT ||
      fallbackNames.nombres,
  );
  const numeroLicencia = (fields.DAQ ?? fields.DCK ?? "").replace(/\s+/g, "").toUpperCase();
  const fechaNacimiento = extractBirthDateFromFields(fields, rawBarcode);
  const cui = extractCui(fields, rawBarcode, fechaNacimiento);
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
    fechaNacimiento,
    restricciones: "",
    tipoSangre: "",
    rawBarcode,
  };
}

function extractBirthDateFromRaw(raw: string): string {
  const match = raw.match(/\b(\d{2}[\/\-.]\d{2}[\/\-.]\d{4})\b/);
  if (!match) {
    return "";
  }
  const [, value] = match;
  const parts = value.split(/[\/\-.]/);
  if (parts.length !== 3) {
    return "";
  }
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}
