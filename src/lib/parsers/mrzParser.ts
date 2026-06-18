import type { DpiScanResult } from "@/lib/types/documents";

const MRZ_LINE_LENGTH = 30;
const MRZ_CHAR_PATTERN = /[A-Z0-9<]/;

function normalizeMrzText(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9<\n]/g, "")
    .replace(/\s+/g, "");
}

function extractMrzLines(text: string): string[] {
  const normalized = normalizeMrzText(text);
  const directLines = normalized
    .split("\n")
    .map((line) => line.replace(/[^A-Z0-9<]/g, ""))
    .filter((line) => line.includes("IDGTM") || line.startsWith("IDGT"));

  if (directLines.length >= 3) {
    return directLines.slice(0, 3).map(padMrzLine);
  }

  const compact = normalized.replace(/\n/g, "");
  const startIndex = compact.indexOf("IDGTM");

  if (startIndex === -1) {
    return [];
  }

  const block = compact.slice(startIndex, startIndex + MRZ_LINE_LENGTH * 3);
  const lines: string[] = [];

  for (let i = 0; i < 3; i += 1) {
    lines.push(padMrzLine(block.slice(i * MRZ_LINE_LENGTH, (i + 1) * MRZ_LINE_LENGTH)));
  }

  return lines;
}

function padMrzLine(line: string): string {
  const cleaned = line.replace(/[^A-Z0-9<]/g, "");
  return cleaned.padEnd(MRZ_LINE_LENGTH, "<").slice(0, MRZ_LINE_LENGTH);
}

function parseDate(yymmdd: string): string {
  if (!/^\d{6}$/.test(yymmdd)) {
    return "";
  }

  const year = Number.parseInt(yymmdd.slice(0, 2), 10);
  const month = yymmdd.slice(2, 4);
  const day = yymmdd.slice(4, 6);
  const fullYear = year >= 30 ? 1900 + year : 2000 + year;

  return `${fullYear}-${month}-${day}`;
}

function parseNames(line3: string): { apellidos: string; nombres: string } {
  const nameSection = line3.replace(/<+$/, "");
  const [surnamePart, givenPart = ""] = nameSection.split("<<");

  const formatSegment = (segment: string) =>
    segment
      .split("<")
      .filter(Boolean)
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(" ");

  return {
    apellidos: formatSegment(surnamePart),
    nombres: formatSegment(givenPart),
  };
}

function extractCui(line1: string): string {
  const afterCountry = line1.slice(5);
  const digits = afterCountry.replace(/[^0-9]/g, "");
  const cuiMatch = digits.match(/\d{13}/);
  return cuiMatch?.[0] ?? "";
}

export function parseDpiMrz(rawText: string): DpiScanResult | null {
  const lines = extractMrzLines(rawText);

  if (lines.length < 3 || !lines[0].startsWith("IDGTM")) {
    return null;
  }

  const [line1, line2, line3] = lines;
  const cui = extractCui(line1);
  const birthDateRaw = line2.slice(0, 6);
  const fechaNacimiento = parseDate(birthDateRaw);
  const { apellidos, nombres } = parseNames(line3);

  if (!cui && !apellidos && !nombres) {
    return null;
  }

  return {
    type: "dpi",
    cui,
    nombres,
    apellidos,
    fechaNacimiento,
    rawMrz: lines,
  };
}

export function isLikelyMrzLine(line: string): boolean {
  if (line.length < 20) {
    return false;
  }

  const validChars = line.split("").filter((char) => MRZ_CHAR_PATTERN.test(char)).length;
  return validChars / line.length >= 0.85;
}
