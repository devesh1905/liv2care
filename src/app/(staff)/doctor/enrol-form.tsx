"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { enrolPatient, type EnrolState } from "./actions";

const field =
  "h-11 w-full rounded-lg border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";
const option = "flex items-start gap-3 rounded-lg border p-3 has-checked:border-primary has-checked:bg-secondary";

export function EnrolForm() {
  const [route, setRoute] = useState<"order_tests" | "existing_report">("order_tests");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<EnrolState, FormData>(async (prev, data) => {
    const result = await enrolPatient(prev, data);
    if (result.success) formRef.current?.reset();
    return result;
  }, {});

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-5 rounded-lg border p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-extrabold">Identify a patient</h2>
        <p className="text-sm text-muted-foreground">Fake patients only. Enrolment needs the patient&apos;s consent.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm font-semibold sm:col-span-2">
          Patient name
          <input name="name" required maxLength={80} className={field} autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Age
          <input name="age" type="number" required min={18} max={120} inputMode="numeric" className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Phone, last 4 digits
          <input name="phone" inputMode="numeric" pattern="\d{4}" maxLength={4} className={field} autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Message language
          <select name="language" className={field} defaultValue="en">
            <option value="en">English</option>
            <option value="hi">Hindi</option>
          </select>
        </label>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">How should the patient start?</legend>
        <label className={option}>
          <input type="radio" name="route" value="order_tests" checked={route === "order_tests"} onChange={() => setRoute("order_tests")} className="mt-1" />
          <span>
            <span className="font-semibold">Option 2: order the tests</span>
            <span className="block text-sm text-muted-foreground">Approve the preset CBC + ALT + AST. The patient books the lab.</span>
          </span>
        </label>
        <label className={option}>
          <input type="radio" name="route" value="existing_report" checked={route === "existing_report"} onChange={() => setRoute("existing_report")} className="mt-1" />
          <span>
            <span className="font-semibold">Option 1: use an existing lab report</span>
            <span className="block text-sm text-muted-foreground">Upload a report the patient already has. No repeat lab test.</span>
          </span>
        </label>
      </fieldset>

      {route === "order_tests" ? (
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input type="checkbox" name="ultrasound" className="size-5" />
          Also order an ultrasound
        </label>
      ) : (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Existing lab report (PDF, up to 5 MB)
          <input name="report" type="file" accept="application/pdf" required className="text-sm font-normal" />
        </label>
      )}

      <label className="flex items-start gap-3 text-sm font-semibold">
        <input type="checkbox" name="consent" required className="mt-0.5 size-5" />
        The patient has given consent to this pathway and to sharing their reports with the platform clinician.
      </label>

      {state.error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm font-semibold text-green-700 dark:text-green-400">
          {state.success}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "Enrolling…" : "Enrol patient"}
      </Button>
    </form>
  );
}
