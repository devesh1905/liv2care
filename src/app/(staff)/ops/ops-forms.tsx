"use client";

import { BellRing, CalendarClock, Send, Sparkles, X } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { markVisitMissed, runOverdueReminders, sendReminder, type OpsState } from "./actions";
import { sendOffer, suggestReschedule, type OfferState, type SuggestState } from "./reschedule-actions";

type Action = (prev: OpsState, form: FormData) => Promise<OpsState>;

function OneButton({ journeyId, action, variant, icon, children }: { journeyId: string; action: Action; variant?: "outline"; icon: React.ReactNode; children: string }) {
  const [state, formAction, pending] = useActionState<OpsState, FormData>(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="journeyId" value={journeyId} />
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {icon}
        {children}
      </Button>
      <FormMessage error={state.error} />
    </form>
  );
}

export const ReminderButton = ({ journeyId }: { journeyId: string }) => (
  <OneButton journeyId={journeyId} action={sendReminder} icon={<BellRing aria-hidden="true" />}>
    Send reminder
  </OneButton>
);

export const MissedButton = ({ journeyId }: { journeyId: string }) => (
  <OneButton journeyId={journeyId} action={markVisitMissed} variant="outline" icon={<X aria-hidden="true" />}>
    Mark missed
  </OneButton>
);

export function RunRemindersButton() {
  const [, formAction, pending] = useActionState<OpsState, FormData>(runOverdueReminders, {});
  return (
    <form action={formAction}>
      <Button type="submit" variant="outline" disabled={pending}>
        <BellRing aria-hidden="true" />
        {pending ? "Sending…" : "Remind everyone overdue"}
      </Button>
    </form>
  );
}

/** For a patient who missed a visit: suggest the earliest open time, then send it to the patient to confirm. */
export function RescheduleOffer({ journeyId }: { journeyId: string }) {
  const [suggestion, setSuggestion] = useState<SuggestState | null>(null);
  const [pending, startTransition] = useTransition();
  const [sendState, sendAction, sending] = useActionState<OfferState, FormData>(sendOffer, {});

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl bg-secondary/60 p-4">
      <Button type="button" variant="outline" size="sm" disabled={pending} className="self-start" onClick={() => startTransition(async () => setSuggestion(await suggestReschedule(journeyId)))}>
        <CalendarClock aria-hidden="true" />
        {pending ? "Looking…" : suggestion?.offer ? "Suggest another time" : "Suggest a new time"}
      </Button>
      {suggestion?.error && <FormMessage error={suggestion.error} />}
      {suggestion?.offer && (
        <form action={sendAction} className="flex flex-col gap-2">
          <input type="hidden" name="journeyId" value={journeyId} />
          <input type="hidden" name="slotId" value={suggestion.offer.slotId} />
          <p className="text-sm">
            <span className="font-semibold">
              {suggestion.offer.place}, {suggestion.offer.slotLabel}
            </span>
            <span className="mt-0.5 flex items-start gap-1.5 text-muted-foreground">
              {suggestion.offer.source === "gemini" && <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-label="Written by the AI helper" />}
              {suggestion.offer.reason}
            </span>
          </p>
          <FormMessage error={sendState.error} />
          <Button type="submit" size="sm" disabled={sending} className="self-start">
            <Send aria-hidden="true" />
            Send offer to the patient
          </Button>
        </form>
      )}
    </div>
  );
}
