"use client";

import { Check, RotateCcw, Send, X } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Select } from "@/components/ui/field";
import { DECLINE_REASONS } from "@/lib/journey/types";
import { cn } from "@/lib/utils";
import {
  approveFibroscan,
  chooseNextStep,
  declineFibroscan,
  recordFollowUp,
  requestRereview,
  type DecisionState,
} from "./decision-actions";

type Action = (prev: DecisionState, form: FormData) => Promise<DecisionState>;

function Hidden({ journeyId }: { journeyId: string }) {
  return <input type="hidden" name="journeyId" value={journeyId} />;
}

/** One button that runs one action for one patient. */
function OneButton({
  journeyId,
  action,
  variant,
  icon,
  children,
  extra,
}: {
  journeyId: string;
  action: Action;
  variant?: "outline" | "secondary";
  icon: React.ReactNode;
  children: string;
  extra?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<DecisionState, FormData>(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Hidden journeyId={journeyId} />
      {Object.entries(extra ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Button type="submit" variant={variant} disabled={pending}>
        {icon}
        {children}
      </Button>
      <FormMessage error={state.error} />
    </form>
  );
}

export const ApproveButton = ({ journeyId }: { journeyId: string }) => (
  <OneButton journeyId={journeyId} action={approveFibroscan} icon={<Check aria-hidden="true" />}>
    Approve FibroScan
  </OneButton>
);

export const RereviewButton = ({ journeyId }: { journeyId: string }) => (
  <OneButton journeyId={journeyId} action={requestRereview} variant="outline" icon={<RotateCcw aria-hidden="true" />}>
    Ask for re-review
  </OneButton>
);

export function DeclineForm({ journeyId }: { journeyId: string }) {
  const [state, action, pending] = useActionState<DecisionState, FormData>(declineFibroscan, {});
  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl bg-secondary/60 p-4">
      <Hidden journeyId={journeyId} />
      <Field label="Or decline FibroScan, with a reason">
        <Select name="reason" defaultValue="" required>
          <option value="" disabled>
            Choose a reason
          </option>
          {DECLINE_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </Field>
      <FormMessage error={state.error} />
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        <X aria-hidden="true" />
        Decline FibroScan
      </Button>
    </form>
  );
}

const STEPS = [
  { value: "routine", title: "Routine follow-up", text: "Booked at your clinic straight away." },
  { value: "eval", title: "Further evaluation", text: "The patient books an extra investigation." },
  { value: "specialist", title: "Specialist referral", text: "The patient books the specialist visit." },
] as const;

export function NextStepForm({ journeyId }: { journeyId: string }) {
  const [step, setStep] = useState<string>("routine");
  const [state, action, pending] = useActionState<DecisionState, FormData>(chooseNextStep, {});
  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl bg-secondary/60 p-4">
      <Hidden journeyId={journeyId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Next step</legend>
        {STEPS.map((s) => (
          <label
            key={s.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
              step === s.value && "border-primary",
            )}
          >
            <input type="radio" name="step" value={s.value} checked={step === s.value} onChange={() => setStep(s.value)} className="mt-1 size-4 accent-primary" />
            <span>
              <span className="block font-heading font-bold">{s.title}</span>
              <span className="block text-sm text-muted-foreground">{s.text}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {step === "routine" && (
        <Field label="Follow-up in">
          <Select name="months" defaultValue="12">
            <option value="3">3 months</option>
            <option value="6">6 months</option>
            <option value="12">12 months</option>
            <option value="24">24 months</option>
          </Select>
        </Field>
      )}
      <FormMessage error={state.error} />
      <Button type="submit" disabled={pending} className="self-start">
        <Send aria-hidden="true" />
        Record next step
      </Button>
    </form>
  );
}

export function FollowUpButtons({ journeyId, canMiss }: { journeyId: string; canMiss: boolean }) {
  return (
    <div className="flex flex-wrap gap-3">
      <OneButton journeyId={journeyId} action={recordFollowUp} icon={<Check aria-hidden="true" />} extra={{ outcome: "attended" }}>
        Mark visit attended
      </OneButton>
      {canMiss && (
        <OneButton journeyId={journeyId} action={recordFollowUp} variant="outline" icon={<X aria-hidden="true" />} extra={{ outcome: "missed" }}>
          Mark missed
        </OneButton>
      )}
    </div>
  );
}
