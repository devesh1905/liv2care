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
    .replace(/\.(pdf|jpe?g|png)$/i, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[._]+/, "")
    .slice(0, 60);
  return `${cleaned || "report"}.pdf`;
}

export type ReportFile = { ok: true; bytes: Uint8Array; safeName: string } | { ok: false; message: string };

const isJpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const isPng = (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

/**
 * Accepts a PDF, or a photo (JPEG or PNG) of a paper report, and returns a PDF either way. A photo is placed on one A4
 * page. The file type is read from the file's own bytes, not from its name. Same 5 MB limit as a PDF.
 */
export async function normaliseReport(bytes: Uint8Array, fileName: string): Promise<ReportFile> {
  if (bytes.length === 0) return { ok: false, message: "The file is empty." };
  if (bytes.length > MAX_REPORT_BYTES) return { ok: false, message: "The file is larger than 5 MB." };

  const pdf = checkPdf(bytes, fileName);
  if (pdf.ok) return { ok: true, bytes, safeName: pdf.safeName };
  if (!isJpeg(bytes) && !isPng(bytes)) return { ok: false, message: "Only a PDF or a photo (JPEG or PNG) is accepted." };

  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const image = isJpeg(bytes) ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
    const [pageW, pageH] = [595.28, 841.89]; // A4 in points
    const margin = 24;
    const scale = Math.min((pageW - 2 * margin) / image.width, (pageH - 2 * margin) / image.height, 1);
    const [w, h] = [image.width * scale, image.height * scale];
    const page = doc.addPage([pageW, pageH]);
    page.drawImage(image, { x: (pageW - w) / 2, y: pageH - margin - h, width: w, height: h });
    return { ok: true, bytes: await doc.save(), safeName: safeFileName(fileName) };
  } catch {
    return { ok: false, message: "That photo could not be read. Try another one, or a PDF." };
  }
}
