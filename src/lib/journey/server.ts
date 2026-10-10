import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseJourneyStore, transition, type Effects, type EventDetail, type TransitionResult } from "./transition";
import type { Actor, JourneyEvent } from "./types";

/** journey.transition() wired to the real database. Server Functions call this; nothing else writes the stage. */
export function transitionJourney(
  journeyId: string,
  event: JourneyEvent,
  actor: Actor,
  detail: EventDetail = {},
  effects: Effects = {},
): Promise<TransitionResult> {
  return transition(supabaseJourneyStore(createAdminClient()), journeyId, event, actor, detail, effects);
}
