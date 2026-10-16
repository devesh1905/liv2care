import { describe, expect, it } from "vitest";
import { MAX_REPORT_BYTES, checkPdf, normaliseReport, safeFileName } from "./pdf";

const pdf = (extra = 10) => new Uint8Array([...new TextEncoder().encode("%PDF-1.4"), ...new Array(extra).fill(0)]);

describe("checkPdf", () => {
  it("accepts a PDF", () => {
    expect(checkPdf(pdf(), "Lab Report (1).PDF")).toEqual({ ok: true, safeName: "Lab_Report_1_.pdf" });
  });

  it("rejects empty, oversized and non-PDF files", () => {
    expect(checkPdf(new Uint8Array(), "a.pdf").ok).toBe(false);
    expect(checkPdf(pdf(MAX_REPORT_BYTES), "a.pdf").ok).toBe(false);
    expect(checkPdf(new TextEncoder().encode("<html>"), "a.pdf").ok).toBe(false);
  });
});

describe("safeFileName", () => {
  it("strips paths and odd characters", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd.pdf");
    expect(safeFileName("C:\\x\\.hidden name.pdf")).toBe("hidden_name.pdf");
    expect(safeFileName("")).toBe("report.pdf");
  });
});

describe("normaliseReport", () => {
  // a 1x1 PNG
  const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"));

  it("passes a PDF through unchanged", async () => {
    const r = await normaliseReport(pdf(), "Lab Report.PDF");
    expect(r).toMatchObject({ ok: true, safeName: "Lab_Report.pdf" });
    if (r.ok) expect(r.bytes).toEqual(pdf());
  });

  // the first call loads the PDF library, which can take a few seconds on a busy machine
  it("turns a photo into a one-page PDF", { timeout: 30_000 }, async () => {
    const r = await normaliseReport(png, "photo.png");
    expect(r).toMatchObject({ ok: true, safeName: "photo.pdf" });
    if (r.ok) expect(String.fromCharCode(...r.bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("refuses other files, empty files and very large files", async () => {
    expect(await normaliseReport(new TextEncoder().encode("<html>"), "a.html")).toMatchObject({ ok: false });
    expect(await normaliseReport(new Uint8Array(), "a.pdf")).toMatchObject({ ok: false });
    expect(await normaliseReport(new Uint8Array(MAX_REPORT_BYTES + 1), "a.png")).toMatchObject({ ok: false });
    expect(await normaliseReport(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]), "broken.jpg")).toMatchObject({ ok: false });
  });
});
