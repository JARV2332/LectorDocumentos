import { parseAamvaBarcode } from "@/lib/parsers/aamvaParser";
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

function extractCui(text: string): string {
  const match = text.replace(/\D/g, " ").match(/\b(\d{13})\b/);
  return match?.[1] ?? "";
}

function extractLicenseNumber(text: string): string {
  const labeled =
    text.match(/(?:LICENCIA|LIC|NO\.?|NUMERO|N[UÚ]MERO)[:\s#]*([A-Z0-9-]{5,20})/i)?.[1] ??
    text.match(/\b(\d{8})\b/)?.[1] ??
    "";

  return labeled.replace(/\s+/g, "").toUpperCase();
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
    /LICENCIA\s+(PARTICULAR|MOTOCICLETA|INTERNACIONAL|ESPECIAL|[A-ZÁÉÍÓÚÑ\s]{4,30})/i,
  );
  return match?.[1]?.trim().toUpperCase() ?? "";
}

function extractRestrictions(text: string): string {
  return (
    text.match(/RESTRICCIONES[:\s]*([A-Z0-9,\s]{1,20})/i)?.[1]?.trim().toUpperCase() ?? ""
  );
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

  const pipeParts = text.split(/[|;\n]/).map((part) => part.trim()).filter(Boolean);
  for (const part of pipeParts) {
    if (/^[A-ZÁÉÍÓÚÑ\s]{8,}$/.test(part) && part.includes(" ")) {
      const words = part.split(/\s+/);
      if (words.length >= 2) {
        return {
          apellidos: formatName(words.slice(0, 2).join(" ")),
          nombres: formatName(words.slice(2).join(" ")),
        };
      }
    }
  }

  return { nombres: "", apellidos: "" };
}

function parseJsonPayload(raw: string): Partial<LicenseScanResult> | null {
  try {
    const data = JSON.parse(raw) as Record<string, string>;
    return {
      numeroLicencia: data.licencia ?? data.numeroLicencia ?? data.license ?? "",
      cui: data.cui ?? data.dpi ?? data.documento ?? "",
      nombres: formatName(data.nombres ?? data.nombre ?? data.firstName ?? ""),
      apellidos: formatName(data.apellidos ?? data.apellido ?? data.lastName ?? ""),
      tipoLicencia: data.tipoLicencia ?? data.tipo ?? "",
      fechaNacimiento: formatDate(data.fechaNacimiento ?? data.nacimiento ?? data.dob ?? ""),
      restricciones: data.restricciones ?? "",
      tipoSangre: data.tipoSangre ?? data.sangre ?? "",
    };
  } catch {
    return null;
  }
}

function parseUrlPayload(raw: string): Partial<LicenseScanResult> | null {
  try {
    const url = new URL(raw);
    const params = url.searchParams;
    const entries = Object.fromEntries(params.entries());
    return parseJsonPayload(JSON.stringify(entries));
  } catch {
    return null;
  }
}

function hasUsefulData(result: LicenseScanResult): boolean {
  return Boolean(
    result.cui ||
      result.numeroLicencia ||
      result.nombres ||
      result.apellidos ||
      result.fechaNacimiento ||
      result.tipoLicencia,
  );
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

export function mergeLicenseResults(
  base: LicenseScanResult,
  patch: Partial<LicenseScanResult>,
): LicenseScanResult {
  return {
    ...base,
    numeroLicencia: patch.numeroLicencia || base.numeroLicencia,
    cui: patch.cui || base.cui,
    nombres: patch.nombres || base.nombres,
    apellidos: patch.apellidos || base.apellidos,
    tipoLicencia: patch.tipoLicencia || base.tipoLicencia,
    fechaNacimiento: patch.fechaNacimiento || base.fechaNacimiento,
    restricciones: patch.restricciones || base.restricciones,
    tipoSangre: patch.tipoSangre || base.tipoSangre,
    rawBarcode: patch.rawBarcode || base.rawBarcode,
  };
}

export function parseGuatemalaLicense(rawBarcode: string): LicenseScanResult | null {
  if (!rawBarcode || rawBarcode.length < 4) {
    return null;
  }

  const aamva = parseAamvaBarcode(rawBarcode);
  if (aamva) {
    return {
      ...aamva,
      fechaNacimiento: extractBirthDate(rawBarcode),
      restricciones: extractRestrictions(rawBarcode),
      tipoSangre: extractBloodType(rawBarcode),
    };
  }

  let result = emptyLicense(rawBarcode);

  const json = parseJsonPayload(rawBarcode);
  if (json) {
    result = mergeLicenseResults(result, json);
  }

  const url = parseUrlPayload(rawBarcode);
  if (url) {
    result = mergeLicenseResults(result, url);
  }

  const names = extractNames(rawBarcode);
  result = mergeLicenseResults(result, {
    cui: extractCui(rawBarcode),
    numeroLicencia: extractLicenseNumber(rawBarcode),
    nombres: names.nombres,
    apellidos: names.apellidos,
    tipoLicencia: extractLicenseType(rawBarcode),
    fechaNacimiento: extractBirthDate(rawBarcode),
    restricciones: extractRestrictions(rawBarcode),
    tipoSangre: extractBloodType(rawBarcode),
  });

  return hasUsefulData(result) ? result : null;
}

export function parseGuatemalaLicenseOcr(text: string): LicenseScanResult | null {
  const normalized = text.toUpperCase().replace(/\s+/g, " ");
  const names = extractNames(normalized);

  const result = mergeLicenseResults(emptyLicense(normalized), {
    numeroLicencia: extractLicenseNumber(normalized),
    cui: extractCui(normalized),
    nombres: names.nombres,
    apellidos: names.apellidos,
    tipoLicencia: extractLicenseType(normalized) || "PARTICULAR",
    fechaNacimiento: extractBirthDate(normalized),
    restricciones: extractRestrictions(normalized),
    tipoSangre: extractBloodType(normalized),
  });

  return hasUsefulData(result) ? result : null;
}
