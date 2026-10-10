import type { SupabaseClient } from "@supabase/supabase-js";
import { nextAction } from "./derived";
import { decideStart, type StartRoute } from "./stateMachine";
import type { Actor } from "./types";

export type StartInput = {
  journeyId: string;
  name: string;
  age: number;
  phoneMasked: string;
  language: "en" | "hi";
  route: StartRoute;
  ultrasound: boolean;
  consentScope: string;
  /** Option 1: the uploaded existing lab report (already in private storage). */
  report?: { storagePath: string; fileName: string; labValues?: Record<string, number> };
};

export type StartResult =
  | { ok: true; journeyId: string }
  | { ok: false; error: { code: string; message: string } };

/** Starts a journey (patient, consent, first audit row, first pending action) in one database call. */
export async function startJourney(admin: SupabaseClient, actor: Actor, input: StartInput): Promise<StartResult> {
  const decision = decideStart(input.route, actor);
  if (!decision.ok) return decision;
  if (input.route === "existing_report" && !input.report) {
    return { ok: false, error: { code: "invalid_payload", message: "Upload the existing lab report first" } };
  }
  if (input.route === "order_tests" && input.report) {
    return { ok: false, error: { code: "invalid_payload", message: "A new test order does not take a report" } };
  }

  const first = nextAction(decision.next);
  const { error } = await admin.rpc("start_journey", {
    p_journey_id: input.journeyId,
    p_patient_code: "",
    p_patient_name: input.name,
    p_patient_age: input.age,
    p_phone_masked: input.phoneMasked,
    p_language: input.language,
    p_route: input.route,
    p_ultrasound: input.ultrasound,
    p_actor: actor.id,
    p_consent_scope: input.consentScope,
    p_report: input.report
      ? { storage_path: input.report.storagePath, file_name: input.report.fileName, lab_values: input.report.labValues ?? null }
      : null,
    p_first_task: first ? { owner: first.who, description: first.what, hours: 24 } : null,
  });
  if (error) {
    const code = error.code === "23514" ? "invalid_payload" : "database";
    return { ok: false, error: { code, message: error.message } };
  }
  return { ok: true, journeyId: input.journeyId };
}
