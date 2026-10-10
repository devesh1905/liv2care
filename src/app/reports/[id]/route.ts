import { NextResponse } from "next/server";
import { getStaffUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const notFound = (message: string) =>
  new NextResponse(`<!doctype html><meta charset="utf-8"><title>Report</title><p style="font:16px system-ui;padding:2rem">${message}</p>`, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8" },
  });

/**
 * Opens a report through a short-lived signed link. Row-level security decides who may see the report row; every open
 * is written to the audit trail (who, which report, when) before the redirect.
 */
export async function GET(request: Request, ctx: RouteContext<"/reports/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return notFound("This report does not exist.");

  const user = await getStaffUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const supabase = await createClient();
  const { data: report } = await supabase.from("reports").select("id, journey_id, storage_path").eq("id", id).maybeSingle();
  if (!report) return notFound("This report does not exist, or you are not allowed to open it.");

  const { data: signed } = await supabase.storage.from("reports").createSignedUrl(report.storage_path, 60);
  if (!signed) return notFound("The report file is not available. (Seeded demo reports have no file until you run npm run seed:files.)");

  const { error } = await createAdminClient().rpc("log_journey_event", {
    p_journey: report.journey_id,
    p_event: "REPORT_ACCESSED",
    p_actor: user.id,
    p_actor_role: user.role,
    p_detail: { report_id: report.id },
  });
  if (error) return notFound("The report could not be opened right now.");

  return NextResponse.redirect(signed.signedUrl, { headers: { "cache-control": "no-store" } });
}
