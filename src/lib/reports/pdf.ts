export const MAX_REPORT_BYTES = 5 * 1024 * 1024;

export type PdfCheck = { ok: true; safeName: string } | { ok: false; message: string };

/** Accepts only a non-empty PDF within the size limit. Checks the file header, not just the extension. */
export function checkPdf(bytes: Uint8Array, fileName: string): PdfCheck {
  if (bytes.length === 0) return { ok: false, message: "The file is empty." };
  if (bytes.length > MAX_REPORT_BYTES) return { ok: false, message: "The file is larger than 5 MB." };
  const header = String.fromCharCode(...bytes.slice(0, 5));
  if (header !== "%PDF-") return { ok: false, message: "Only PDF files are accepted." };
  return { ok: true, safeName: safeFileName(fileName) };
}

/** A storage- and display-safe file name that always ends in .pdf. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "report";
  const cleaned = base
    .replace(/\.pdf$/i, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[._]+/, "")
    .slice(0, 60);
  return `${cleaned || "report"}.pdf`;
}
