"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { addSlot, markAttended, markMissed, removeSlot, uploadReport, type PartnerState } from "./actions";

type Action = (prev: PartnerState, form: FormData) => Promise<PartnerState>;

function Feedback({ state }: { state: PartnerState }) {
  if (state.error)
    return (
      <p role="alert" className="text-sm font-semibold text-destructive">
        {state.error}
      </p>
    );
  if (state.success)
    return (
      <p role="status" className="text-sm font-semibold text-green-700 dark:text-green-400">
        {state.success}
      </p>
    );
  return null;
}

export function UploadForm({ journeyId, label }: { journeyId: string; label: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<PartnerState, FormData>(uploadReport, {});
  return (
    <form ref={ref} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="journeyId" value={journeyId} />
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {label} (PDF, up to 5 MB)
        <input name="report" type="file" accept="application/pdf" required className="text-sm font-normal" />
      </label>
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Uploading…" : "Upload report"}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

function ButtonForm({ journeyId, children, action, variant }: { journeyId: string; children: string; action: Action; variant?: "outline" }) {
  const [state, formAction, pending] = useActionState<PartnerState, FormData>(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="journeyId" value={journeyId} />
      <Button type="submit" size="sm" variant={variant} disabled={pending} className="self-start">
        {children}
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export const MissedButton = ({ journeyId }: { journeyId: string }) => (
  <ButtonForm journeyId={journeyId} action={markMissed} variant="outline">
    Mark missed
  </ButtonForm>
);

export const AttendedButton = ({ journeyId }: { journeyId: string }) => (
  <ButtonForm journeyId={journeyId} action={markAttended}>
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
    <form ref={ref} action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        New slot
        <input
          name="startsAt"
          type="datetime-local"
          required
          className="h-11 rounded-lg border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <Button type="submit" disabled={pending}>
        Add slot
      </Button>
      <Feedback state={state} />
    </form>
  );
}

export function RemoveSlotButton({ slotId }: { slotId: string }) {
  const [, action, pending] = useActionState<PartnerState, FormData>(removeSlot, {});
  return (
    <form action={action}>
      <input type="hidden" name="slotId" value={slotId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Remove
      </Button>
    </form>
  );
}
