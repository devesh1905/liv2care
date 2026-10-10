// Uploads a small placeholder PDF for every seeded report (paths starting "seed/"), so "Open report" works in demos.
// Run after `npx supabase db reset`:  npm run seed:files   (needs .env.local with the local Supabase keys)
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** A one-page PDF saying the file is fake. Built by hand so no PDF library is needed. */
function samplePdf(title) {
  const text = `BT /F1 20 Tf 60 740 Td (${title}) Tj 0 -32 Td /F1 12 Tf (FAKE DEMO DOCUMENT. No real patient data.) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

const { data: reports, error } = await admin.from("reports").select("storage_path, kind, file_name").like("storage_path", "seed/%");
if (error) throw error;
for (const r of reports) {
  const title = r.kind === "fibroscan" ? "Sample FibroScan report" : "Sample lab report";
  const { error: uploadError } = await admin.storage.from("reports").upload(r.storage_path, samplePdf(title), { contentType: "application/pdf", upsert: true });
  if (uploadError) throw uploadError;
}
console.log(`Uploaded ${reports.length} sample report files.`);
