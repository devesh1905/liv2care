"use client";

import { CalendarPlus, Check, Trash2, Upload, X } from "lucide-react";
import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/field";
import { addSlot, markAttended, markMissed, removeSlot, uploadReport, type PartnerState } from "./actions";

type Action = (prev: PartnerState, form: FormData) => Promise<PartnerState>;

export function UploadForm({ journeyId, label }: { journeyId: string; label: string }) {
  const [state, action, pending] = useActionState<PartnerState, FormData>(uploadReport, {});
  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl bg-secondary/60 p-4">
      <input type="hidden" name="journeyId" value={journeyId} />
      <Field label={label} hint="PDF, up to 5 MB">
        <input
          name="report"
          type="file"
          accept="application/pdf"
          required
          className="text-sm file:mr-3 file:h-10 file:rounded-lg file:border file:bg-card file:px-4 file:font-heading file:font-semibold"
        />
      </Field>
      <FormMessage error={state.error} success={state.success} />
      <Button type="submit" disabled={pending} className="self-start">
        <Upload aria-hidden="true" />
        {pending ? "Uploading…" : "Upload report"}
      </Button>
    </form>
  );
}

function ButtonForm({
  journeyId,
  action,
  variant,
  icon,
  children,
}: {
  journeyId: string;
  action: Action;
  variant?: "outline";
  icon: React.ReactNode;
  children: string;
}) {
  const [state, formAction, pending] = useActionState<PartnerState, FormData>(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="journeyId" value={journeyId} />
      <Button type="submit" variant={variant} disabled={pending} className="self-start">
        {icon}
        {children}
      </Button>
      <FormMessage error={state.error} success={state.success} />
    </form>
  );
}

export const MissedButton = ({ journeyId }: { journeyId: string }) => (
  <ButtonForm journeyId={journeyId} action={markMissed} variant="outline" icon={<X aria-hidden="true" />}>
    Mark missed
  </ButtonForm>
);

export const AttendedButton = ({ journeyId }: { journeyId: string }) => (
  <ButtonForm journeyId={journeyId} action={markAttended} icon={<Check aria-hidden="true" />}>
    Mark attended
  </ButtonForm>
);

export function AddSlotForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<PartnerState, FormData>(async (prev, data) => {
    const result = await addSlot(prev, data);
    if (result.success) ref.current?.reset();
    return result;
  }, {});
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="New slot (India time)" className="min-w-56 flex-1">
          <Input name="startsAt" type="datetime-local" required />
        </Field>
        <Button type="submit" disabled={pending}>
          <CalendarPlus aria-hidden="true" />
          Add slot
        </Button>
      </div>
      <FormMessage error={state.error} success={state.success} />
    </form>
  );
}

export function RemoveSlotButton({ slotId }: { slotId: string }) {
  const [, action, pending] = useActionState<PartnerState, FormData>(removeSlot, {});
  return (
    <form action={action}>
      <input type="hidden" name="slotId" value={slotId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending} aria-label="Remove this slot">
        <Trash2 aria-hidden="true" />
        Remove
      </Button>
    </form>
  );
}
