import { parseAamvaBarcode } from "@/lib/parsers/aamvaParser";
import {
  findLicenseSerialInText,
  findValidCuiInText,
  isValidGuatemalaCui,
  isValidLicenseNumber,
} from "@/lib/parsers/cuiValidator";
import type { LicenseScanResult } from "@/lib/types/documents";

function formatName(value: string): string {
  return value
    .replace(/<+/g, " ")
    .replace(/[_|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(value: string): string {
  const match = value.match(/(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/);
  if (!match) {
    return value;
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function sanitizeCui(value: string, birthDate = ""): string {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length !== 13 || !isValidGuatemalaCui(cleaned)) {
    return "";
  }

  return findValidCuiInText(cleaned, birthDate) || "";
}

function sanitizeLicenseNumber(value: string): string {
  const cleaned = value.replace(/\s+/g, "").toUpperCase();
  return isValidLicenseNumber(cleaned) ? cleaned : "";
}

function extractBirthDate(text: string): string {
  const labeled = text.match(
    /(?:FECHA\s*DE\s*NACIMIENTO|NACIMIENTO|DBB|DOB)[:\s]*(\d{2}[\/\-.]\d{2}[\/\-.]\d{4}|\d{8})/i,
  )?.[1];

  if (!labeled) {
    const loose = text.match(/\b(\d{2}[\/\-.]\d{2}[\/\-.]\d{4})\b/);
    return loose ? formatDate(loose[1]) : "";
  }

  if (/^\d{8}$/.test(labeled)) {
    return formatDate(
      `${labeled.slice(0, 2)}/${labeled.slice(2, 4)}/${labeled.slice(4, 8)}`,
    );
  }

  return formatDate(labeled);
}

function extractLicenseType(text: string): string {
  const match = text.match(
    /LICENCIA\s+(PARTICULAR|MOTOCICLETA|INTERNACIONAL|ESPECIAL)/i,
  );
  return match?.[1]?.trim().toUpperCase() ?? "";
}

function extractRestrictions(text: string): string {
  const match = text.match(/RESTRICCIONES[:\s]*([A-Z0-9]{1,6})/i)?.[1];
  return match?.trim().toUpperCase() ?? "";
}

function extractBloodType(text: string): string {
  return text.match(/(?:TIPO\s*DE\s*SANGRE|SANGRE)[:\s]*([ABO]{1,2}[+-]?)/i)?.[1]?.toUpperCase() ?? "";
}

function extractNames(text: string): { nombres: string; apellidos: string } {
  const labeledApellidos = text.match(/(?:APELLIDOS?|DCS|LAST)[:\s]*([A-ZÁÉÍÓÚÑ\s<,|]+)/i)?.[1];
  const labeledNombres = text.match(/(?:NOMBRES?|NOMBRE|DAC|FIRST)[:\s]*([A-ZÁÉÍÓÚÑ\s<,|]+)/i)?.[1];

  if (labeledApellidos || labeledNombres) {
    return {
      apellidos: formatName(labeledApellidos ?? ""),
      nombres: formatName(labeledNombres ?? ""),
    };
  }

  const aamvaNames = text.match(/DCS([^D\n]{2,40})DAC([^D\n]{2,40})/);
  if (aamvaNames) {
    return {
      apellidos: formatName(aamvaNames[1]),
      nombres: formatName(aamvaNames[2]),
    };
  }

  const pipeParts = text.split(/[|;\n\r]/).map((part) => part.trim()).filter(Boolean);
  for (const part of pipeParts) {
    if (/^[A-ZÁÉÍÓÚÑ\s]{8,}$/.test(part) && part.includes(" ")) {
      const words = part.split(/\s+/);
      if (words.length >= 3) {
        return {
          apellidos: formatName(words.slice(0, 2).join(" ")),
          nombres: formatName(words.slice(2).join(" ")),
        };
      }
    }
  }

  return { nombres: "", apellidos: "" };
}

function parseUrlPayload(raw: string): Partial<LicenseScanResult> | null {
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const patch: Partial<LicenseScanResult> = {};

    url.searchParams.forEach((value, key) => {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey.includes("cui") || normalizedKey.includes("dpi")) {
        patch.cui = sanitizeCui(value);
      }
      if (normalizedKey.includes("nombre")) {
        patch.nombres = formatName(value);
      }
      if (normalizedKey.includes("apellido")) {
        patch.apellidos = formatName(value);
      }
      if (normalizedKey.includes("lic")) {
        patch.numeroLicencia = sanitizeLicenseNumber(value);
      }
    });

    return Object.keys(patch).length > 0 ? patch : null;
  } catch {
    return null;
  }
}

function emptyLicense(rawBarcode: string): LicenseScanResult {
  return {
    type: "license",
    numeroLicencia: "",
    cui: "",
    nombres: "",
    apellidos: "",
    tipoLicencia: "",
    fechaNacimiento: "",
    restricciones: "",
    tipoSangre: "",
    rawBarcode,
  };
}

function sanitizePatch(
  patch: Partial<LicenseScanResult>,
  birthDate = "",
): Partial<LicenseScanResult> {
  return {
    ...patch,
    cui: patch.cui ? sanitizeCui(patch.cui, birthDate) : "",
    numeroLicencia: patch.numeroLicencia ? sanitizeLicenseNumber(patch.numeroLicencia) : "",
    nombres: patch.nombres ? formatName(patch.nombres) : "",
    apellidos: patch.apellidos ? formatName(patch.apellidos) : "",
  };
}

export function mergeLicenseResults(
  base: LicenseScanResult,
  patch: Partial<LicenseScanResult>,
): LicenseScanResult {
  const birthDate = patch.fechaNacimiento || base.fechaNacimiento;
  const clean = sanitizePatch(patch, birthDate);

  return {
    ...base,
    numeroLicencia: clean.numeroLicencia || base.numeroLicencia,
    cui: clean.cui || base.cui,
    nombres: clean.nombres || base.nombres,
    apellidos: clean.apellidos || base.apellidos,
    tipoLicencia: clean.tipoLicencia || base.tipoLicencia,
    fechaNacimiento: clean.fechaNacimiento || base.fechaNacimiento,
    restricciones: clean.restricciones || base.restricciones,
    tipoSangre: clean.tipoSangre || base.tipoSangre,
    rawBarcode: clean.rawBarcode || base.rawBarcode,
  };
}

export function parseGuatemalaLicense(rawBarcode: string): LicenseScanResult | null {
  if (!rawBarcode || rawBarcode.length < 4) {
    return null;
  }

  if (/^https?:\/\//i.test(rawBarcode) || rawBarcode.includes("transito")) {
    const urlPatch = parseUrlPayload(rawBarcode);
    return urlPatch ? mergeLicenseResults(emptyLicense(rawBarcode), urlPatch) : null;
  }

  const aamva = parseAamvaBarcode(rawBarcode);
  if (aamva) {
    const birthDate = extractBirthDate(rawBarcode);
    return mergeLicenseResults(
      { ...aamva, rawBarcode },
      sanitizePatch(
        {
          fechaNacimiento: birthDate,
          restricciones: extractRestrictions(rawBarcode),
          tipoSangre: extractBloodType(rawBarcode),
          cui: sanitizeCui(aamva.cui, birthDate),
          numeroLicencia: sanitizeLicenseNumber(aamva.numeroLicencia),
        },
        birthDate,
      ),
    );
  }

  const birthDate = extractBirthDate(rawBarcode);
  const names = extractNames(rawBarcode);

  const result = mergeLicenseResults(emptyLicense(rawBarcode), {
    cui: findValidCuiInText(rawBarcode, birthDate),
    numeroLicencia: sanitizeLicenseNumber(
      rawBarcode.match(/(?:DAQ|DCK|LIC)[:\s]*([A-Z0-9-]{4,20})/i)?.[1] ?? "",
    ),
    nombres: names.nombres,
    apellidos: names.apellidos,
    tipoLicencia: extractLicenseType(rawBarcode),
    fechaNacimiento: birthDate,
    restricciones: extractRestrictions(rawBarcode),
    tipoSangre: extractBloodType(rawBarcode),
  });

  const hasIdentity = Boolean(result.cui || result.nombres || result.apellidos);
  const hasBarcodePayload = rawBarcode.length > 40 && /[A-Z]{3}[A-Z0-9]/.test(rawBarcode);

  if (hasIdentity || hasBarcodePayload) {
    return result;
  }

  return null;
}

export function parseGuatemalaLicenseOcr(text: string): LicenseScanResult | null {
  const normalized = text.toUpperCase().replace(/\s+/g, " ");
  const birthDate = extractBirthDate(normalized);

  const result = mergeLicenseResults(emptyLicense(normalized), {
    numeroLicencia: findLicenseSerialInText(normalized),
    cui: findValidCuiInText(normalized, birthDate),
    nombres: "",
    apellidos: "",
    tipoLicencia: extractLicenseType(normalized) || "PARTICULAR",
    fechaNacimiento: birthDate,
    restricciones: extractRestrictions(normalized),
    tipoSangre: extractBloodType(normalized),
  });

  const hasVisibleData = Boolean(
    result.fechaNacimiento ||
      result.tipoLicencia ||
      result.restricciones ||
      result.tipoSangre ||
      result.numeroLicencia,
  );

  return hasVisibleData ? result : null;
}
