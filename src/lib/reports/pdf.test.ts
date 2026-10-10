import { describe, expect, it } from "vitest";
import { MAX_REPORT_BYTES, checkPdf, safeFileName } from "./pdf";

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
