import type { DpiScanResult } from "@/lib/types/documents";

const MRZ_LINE_LENGTH = 30;
const MRZ_CHAR_PATTERN = /[A-Z0-9<]/;

const OCR_CORRECTIONS: Record<string, string> = {
  "0": "O",
  "1": "I",
  "2": "Z",
  "5": "S",
  "8": "B",
  "|": "I",
  " ": "<",
};

function applyOcrCorrections(text: string): string {
  let corrected = text.toUpperCase();

  for (const [from, to] of Object.entries(OCR_CORRECTIONS)) {
    corrected = corrected.replaceAll(from, to);
  }

  return corrected.replace(/[^A-Z0-9<\n]/g, "");
}

function normalizeMrzText(text: string): string {
  return applyOcrCorrections(text).replace(/\s+/g, "");
}

function findMrzStart(text: string): number {
  const patterns = ["IDGTM", "1DGTM", "IDGT", "IDGTN", "IDGTC", "IDGTW"];

  for (const pattern of patterns) {
    const index = text.indexOf(pattern);
    if (index !== -1) {
      return index;
    }
  }

  const fuzzy = text.match(/I[DO0][G6]T[MWN]?/);
  return fuzzy?.index ?? -1;
}

function extractMrzLines(text: string): string[] {
  const normalized = normalizeMrzText(text);
  const directLines = normalized
    .split("\n")
    .map((line) => line.replace(/[^A-Z0-9<]/g, ""))
    .filter((line) => line.length >= 20);

  const idgLine = directLines.find((line) => findMrzStart(line) !== -1);
  if (idgLine) {
    const start = findMrzStart(idgLine);
    const block = directLines.join("").slice(start);
    if (block.length >= MRZ_LINE_LENGTH * 2) {
      return buildLinesFromBlock(block);
    }
  }

  const compact = normalized.replace(/\n/g, "");
  const startIndex = findMrzStart(compact);

  if (startIndex === -1) {
    return [];
  }

  return buildLinesFromBlock(compact.slice(startIndex));
}

function buildLinesFromBlock(block: string): string[] {
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
  const digits = yymmdd.replace(/\D/g, "").slice(0, 6);
  if (digits.length !== 6) {
    return "";
  }

  const year = Number.parseInt(digits.slice(0, 2), 10);
  const month = digits.slice(2, 4);
  const day = digits.slice(4, 6);
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
  const digits = line1.replace(/[^0-9]/g, "");
  const cuiMatch = digits.match(/\d{13}/);
  return cuiMatch?.[0] ?? "";
}

export function parseDpiMrz(rawText: string): DpiScanResult | null {
  const lines = extractMrzLines(rawText);

  if (lines.length < 3) {
    return null;
  }

  const [line1, line2, line3] = lines;

  if (findMrzStart(line1) === -1 && !line1.startsWith("ID")) {
    return null;
  }

  const cui = extractCui(line1);
  const birthDateRaw = line2.replace(/[^0-9]/g, "").slice(0, 6);
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
  return validChars / line.length >= 0.75;
}
