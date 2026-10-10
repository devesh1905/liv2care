"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { sendBookingLink } from "@/lib/booking/notify";
import { transitionJourney } from "@/lib/journey/server";
import type { Effects } from "@/lib/journey/transition";
import { DECLINE_REASONS, type JourneyEvent, type NextStepType } from "@/lib/journey/types";
import { mockProvider } from "@/lib/messages/provider";
import { templates } from "@/lib/messages/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DecisionState = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MONTHS = [3, 6, 12, 24];

/**
 * Shared start of every doctor action: the signed-in doctor, an up-front revalidate (Next 16.4 fails to re-render the
 * layout after an action that returns without revalidating), and a check that the journey is one of theirs.
 */
async function begin(form: FormData) {
  const doctor = await requireRole("doctor");
  revalidatePath("/doctor");
  const journeyId = String(form.get("journeyId") ?? "");
  if (!UUID.test(journeyId)) return { error: "Unknown patient." } as const;
  const supabase = await createClient();
  const { data: visible } = await supabase.from("journeys").select("id").eq("id", journeyId).maybeSingle();
  if (!visible) return { error: "That patient is not on your list." } as const;
  return { doctor, journeyId, supabase } as const;
}

async function run(journeyId: string, doctorId: string, event: JourneyEvent, detail: Record<string, string | number>, effects: Effects) {
  return transitionJourney(journeyId, event, { id: doctorId, role: "doctor" }, detail, effects);
}

export async function approveFibroscan(_prev: DecisionState, form: FormData): Promise<DecisionState> {
  const ctx = await begin(form);
  if ("error" in ctx) return ctx;
  const result = await run(ctx.journeyId, ctx.doctor.id, { type: "APPROVE_VCTE" }, {}, { decision: { kind: "vcte_approve" } });
  if (!result.ok) return { error: result.error.message };
  await sendBookingLink(createAdminClient(), ctx.journeyId, templates.fibroscanApproved);
  redirect("/doctor?notice=approved");
}

export async function declineFibroscan(_prev: DecisionState, form: FormData): Promise<DecisionState> {
  const ctx = await begin(form);
  if ("error" in ctx) return ctx;
  const reason = String(form.get("reason") ?? "");
  if (!(DECLINE_REASONS as readonly string[]).includes(reason)) return { error: "Choose one of the reasons." };
  const result = await run(ctx.journeyId, ctx.doctor.id, { type: "DECLINE_VCTE", reason }, { reason }, { decision: { kind: "vcte_decline", reason } });
  if (!result.ok) return { error: result.error.message };
  redirect("/doctor?notice=declined");
}

export async function requestRereview(_prev: DecisionState, form: FormData): Promise<DecisionState> {
  const ctx = await begin(form);
  if ("error" in ctx) return ctx;
  const result = await run(ctx.journeyId, ctx.doctor.id, { type: "REQUEST_REREVIEW" }, {}, { decision: { kind: "rereview" } });
  if (!result.ok) return { error: result.error.message };
  redirect("/doctor?notice=rereview");
}

/** Routine follow-up (booked at the doctor's clinic at once), further evaluation, or a specialist referral. */
export async function chooseNextStep(_prev: DecisionState, form: FormData): Promise<DecisionState> {
  const ctx = await begin(form);
  if ("error" in ctx) return ctx;
  const step = String(form.get("step") ?? "") as NextStepType;
  if (!["routine", "eval", "specialist"].includes(step)) return { error: "Choose the next step." };

  const admin = createAdminClient();
  if (step === "routine") {
    const months = Number(form.get("months"));
    if (!MONTHS.includes(months)) return { error: "Choose when the follow-up should be." };
    const { data: clinic } = await ctx.supabase.from("partners").select("id").eq("kind", "routine").limit(1).maybeSingle();
    if (!clinic) return { error: "No follow-up clinic is set up." };
    const result = await run(
      ctx.journeyId,
      ctx.doctor.id,
      { type: "CHOOSE_NEXT_STEP", step },
      { step, months },
      {
        decision: { kind: "next_step", nextStep: step, followUpMonths: months },
        booking: { partnerId: clinic.id, slotId: null, kind: "routine", slotLabel: `In ${months} months` },
      },
    );
    if (!result.ok) return { error: result.error.message };
    await mockProvider(admin).send({ journeyId: ctx.journeyId, channel: "SMS", body: templates.routineFollowUp(months) }).catch(() => undefined);
    redirect("/doctor?notice=routine");
  }

  const result = await run(ctx.journeyId, ctx.doctor.id, { type: "CHOOSE_NEXT_STEP", step }, { step }, { decision: { kind: "next_step", nextStep: step } });
  if (!result.ok) return { error: result.error.message };
  await sendBookingLink(admin, ctx.journeyId, step === "eval" ? templates.furtherEvaluation : templates.specialistReferral);
  redirect(`/doctor?notice=${step}`);
}

/** The follow-up visit happened, or was missed (the patient is sent a link to choose a new time). */
export async function recordFollowUp(_prev: DecisionState, form: FormData): Promise<DecisionState> {
  const ctx = await begin(form);
  if ("error" in ctx) return ctx;
  const outcome = String(form.get("outcome") ?? "");
  if (outcome !== "attended" && outcome !== "missed") return { error: "Unknown outcome." };

  const result = await run(ctx.journeyId, ctx.doctor.id, { type: outcome === "attended" ? "MARK_ATTENDED" : "MARK_MISSED" }, {}, {});
  if (!result.ok) return { error: result.error.message };
  if (outcome === "missed") await sendBookingLink(createAdminClient(), ctx.journeyId, templates.missed, "SMS");
  redirect(`/doctor?notice=${outcome === "attended" ? "attended" : "missed"}`);
}
