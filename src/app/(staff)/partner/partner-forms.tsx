"use client";

import { CalendarPlus, Check, Trash2, Upload, X } from "lucide-react";
import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CheckRow, Field, FormMessage, Input, Select } from "@/components/ui/field";
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
  waitUntil,
}: {
  journeyId: string;
  action: Action;
  variant?: "outline";
  icon: React.ReactNode;
  children: string;
  /** When set, the button is greyed out and this explains when it opens (for example "in 2 days 3 h"). */
  waitUntil?: string | null;
}) {
  const [state, formAction, pending] = useActionState<PartnerState, FormData>(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="journeyId" value={journeyId} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant={variant} disabled={pending || !!waitUntil} className="self-start">
          {icon}
          {children}
        </Button>
        {waitUntil && <span className="text-sm text-muted-foreground">Opens when the slot starts, {waitUntil}.</span>}
      </div>
      <FormMessage error={state.error} success={state.success} />
    </form>
  );
}

export const MissedButton = ({ journeyId, waitUntil }: { journeyId: string; waitUntil?: string | null }) => (
  <ButtonForm journeyId={journeyId} action={markMissed} variant="outline" icon={<X aria-hidden="true" />} waitUntil={waitUntil}>
    Mark missed
  </ButtonForm>
);

export const AttendedButton = ({ journeyId, waitUntil }: { journeyId: string; waitUntil?: string | null }) => (
  <ButtonForm journeyId={journeyId} action={markAttended} icon={<Check aria-hidden="true" />} waitUntil={waitUntil}>
    Mark attended
  </ButtonForm>
);

export function AddSlotForm({ canHome = false }: { canHome?: boolean }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<PartnerState, FormData>(async (prev, data) => {
    const result = await addSlot(prev, data);
    if (result.success) ref.current?.reset();
    return result;
  }, {});
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3" aria-label="New slot, India time">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Date" className="min-w-40 flex-1">
          <Input name="date" type="date" required />
        </Field>
        <Field label="Hour" className="w-24">
          <Select name="hour" required defaultValue="10">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Minute" className="w-24">
          <Select name="minute" required defaultValue="00">
            {["00", "15", "30", "45"].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="AM or PM" className="w-28">
          <Select name="period" required defaultValue="AM">
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </Select>
        </Field>
        <Button type="submit" disabled={pending}>
          <CalendarPlus aria-hidden="true" />
          Add slot
        </Button>
      </div>
      {canHome && <CheckRow name="home">Home visit slot: a collector goes to the patient&apos;s address at this time</CheckRow>}
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
