"use client";

import { BellRing, X } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { markVisitMissed, sendReminder, type OpsState } from "./actions";

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
