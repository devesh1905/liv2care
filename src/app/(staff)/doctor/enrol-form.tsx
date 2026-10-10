"use client";

import { FileUp, FlaskConical, UserPlus } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { CheckRow, Field, FormMessage, Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { enrolPatient, type EnrolState } from "./actions";

type Route = "order_tests" | "existing_report";

function RouteOption({
  checked,
  onSelect,
  value,
  icon,
  title,
  text,
}: {
  checked: boolean;
  onSelect: () => void;
  value: Route;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
        checked ? "border-primary bg-secondary/60" : "hover:bg-muted/50",
      )}
    >
      <input type="radio" name="route" value={value} checked={checked} onChange={onSelect} className="sr-only" />
      <span aria-hidden="true" className={cn("grid size-10 shrink-0 place-items-center rounded-lg", checked ? "bg-primary text-primary-foreground" : "bg-secondary text-primary")}>
        {icon}
      </span>
      <span>
        <span className="block font-heading font-extrabold">{title}</span>
        <span className="block text-sm text-muted-foreground">{text}</span>
      </span>
    </label>
  );
}

export function EnrolForm() {
  const [route, setRoute] = useState<Route>("order_tests");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<EnrolState, FormData>(async (prev, data) => {
    const result = await enrolPatient(prev, data);
    if (result.success) formRef.current?.reset();
    return result;
  }, {});

  return (
    <Card aria-labelledby="enrol-title">
      <form ref={formRef} action={action} className="flex flex-col gap-6">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
            <UserPlus className="size-5" />
          </span>
          <div>
            <CardTitle id="enrol-title">Identify a patient</CardTitle>
            <CardDescription>Fake patients only. Enrolment needs the patient&apos;s consent.</CardDescription>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-6">
          <Field label="Patient name" className="sm:col-span-3">
            <Input name="name" required maxLength={80} autoComplete="off" />
          </Field>
          <Field label="Age" className="sm:col-span-1">
            <Input name="age" type="number" required min={18} max={120} inputMode="numeric" />
          </Field>
          <Field label="Phone, last 4 digits" hint="Optional" className="sm:col-span-2">
            <Input name="phone" inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="off" />
          </Field>
          <Field label="Message language" className="sm:col-span-3">
            <Select name="language" defaultValue="en">
              <option value="en">English</option>
              <option value="hi">Hindi</option>
            </Select>
          </Field>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold">How should the patient start?</legend>
          <div className="grid gap-3 md:grid-cols-2">
            <RouteOption
              value="order_tests"
              checked={route === "order_tests"}
              onSelect={() => setRoute("order_tests")}
              icon={<FlaskConical className="size-5" />}
              title="Option 2: order the tests"
              text="Approve the preset CBC + ALT + AST. The patient books the lab."
            />
            <RouteOption
              value="existing_report"
              checked={route === "existing_report"}
              onSelect={() => setRoute("existing_report")}
              icon={<FileUp className="size-5" />}
              title="Option 1: use an existing report"
              text="Upload a lab report the patient already has. No repeat lab test."
            />
          </div>
        </fieldset>

        {route === "order_tests" ? (
          <CheckRow name="ultrasound">Also order an ultrasound</CheckRow>
        ) : (
          <Field label="Existing lab report" hint="PDF, up to 5 MB">
            <input
              name="report"
              type="file"
              accept="application/pdf"
              required
              className="text-sm file:mr-3 file:h-10 file:rounded-lg file:border file:bg-card file:px-4 file:font-heading file:font-semibold"
            />
          </Field>
        )}

        <CheckRow name="consent" required className="rounded-xl bg-secondary/60 p-4 font-semibold">
          The patient has given consent to this pathway and to sharing their reports with the platform clinician.
        </CheckRow>

        <FormMessage error={state.error} success={state.success} />

        <Button type="submit" size="lg" disabled={pending} className="self-start">
          {pending ? "Enrolling…" : "Enrol patient"}
        </Button>
      </form>
    </Card>
  );
}
