/** Valida CUI guatemalteco (13 dígitos + verificador módulo 11). */
export function isValidGuatemalaCui(value: string): boolean {
  const cui = value.replace(/\D/g, "");
  if (cui.length !== 13 || !/^\d{13}$/.test(cui)) {
    return false;
  }

  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    sum += Number.parseInt(cui[index], 10) * (index + 2);
  }

  const modulo = sum % 11;
  let verifier = 11 - modulo;

  if (verifier === 11) {
    verifier = 0;
  }

  if (verifier === 10) {
    return false;
  }

  return Number.parseInt(cui[12], 10) === verifier;
}

export function findValidCuiInText(text: string, rejectDate?: string): string {
  const digitsOnly = text.replace(/\D/g, " ");
  const candidates = digitsOnly.match(/\d{13}/g) ?? [];

  for (const candidate of candidates) {
    if (rejectDate && isCuiDerivedFromDate(candidate, rejectDate)) {
      continue;
    }

    if (isValidGuatemalaCui(candidate)) {
      return candidate;
    }
  }

  return "";
}

function isCuiDerivedFromDate(cui: string, isoDate: string): boolean {
  const dateParts = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateParts) {
    return false;
  }

  const [, year, month, day] = dateParts;
  const ddmmyyyy = `${day}${month}${year}`;
  const mmddyyyy = `${month}${day}${year}`;

  return (
    cui.startsWith(ddmmyyyy) ||
    cui.startsWith(mmddyyyy) ||
    cui.includes(ddmmyyyy) ||
    cui.includes(mmddyyyy)
  );
}

export function isValidLicenseNumber(value: string): boolean {
  const cleaned = value.trim().toUpperCase();

  if (cleaned.length < 4 || cleaned.length > 20) {
    return false;
  }

  const blocked = [
    "HTTP",
    "HTTPS",
    "WWW",
    "TRANSITO",
    "GOB",
    "GT",
    "VLTRANSITO",
    "SERVICIOS",
    "MAYCOM",
    "POLICIA",
    "LICENCIA",
    "PARTICULAR",
  ];

  if (blocked.some((word) => cleaned.includes(word))) {
    return false;
  }

  if (/^[A-Z]+$/.test(cleaned)) {
    return false;
  }

  if (/^\d{6,13}$/.test(cleaned)) {
    return true;
  }

  return /^[A-Z0-9-]{4,18}$/.test(cleaned) && /\d/.test(cleaned);
}

export function findLicenseSerialInText(text: string): string {
  const labeled = text.match(
    /(?:SERIAL|SERIE|NO\.?\s*CONTROL|CONTROL)[:\s#]*(\d{6,10})/i,
  )?.[1];

  if (labeled && isValidLicenseNumber(labeled)) {
    return labeled;
  }

  const eightDigitMatches = text.match(/\b(\d{8})\b/g) ?? [];
  for (const match of eightDigitMatches) {
    if (isValidLicenseNumber(match) && !looksLikeDateDigits(match)) {
      return match;
    }
  }

  return "";
}

function looksLikeDateDigits(value: string): boolean {
  if (value.length !== 8) {
    return false;
  }

  const day = Number.parseInt(value.slice(0, 2), 10);
  const month = Number.parseInt(value.slice(2, 4), 10);
  return day >= 1 && day <= 31 && month >= 1 && month <= 12;
}
