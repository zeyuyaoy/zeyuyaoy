type ExportValue = string | number | boolean;

export function neutralizeSpreadsheetFormula(value: ExportValue): string {
  const text = String(value);
  return /^[\s\t\r\n]*[=+\-@]/.test(text) ? `'${text}` : text;
}

export function csvCell(value: ExportValue): string {
  const safe = neutralizeSpreadsheetFormula(value);
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
