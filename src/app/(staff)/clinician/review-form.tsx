"use client";

import { Send } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { CheckRow, Field, FormMessage, Input, Textarea } from "@/components/ui/field";
import { submitReview, type ReviewState } from "./actions";

export function ReviewForm({ journeyId }: { journeyId: string }) {
  const [state, action] = useActionState<ReviewState, FormData>(async (prev, data) => {
    const result = await submitReview(prev, data);
    // keep what the clinician typed when the server refuses the review
    if (result.error) {
      return { ...result, typed: { fib4: String(data.get("fib4") ?? ""), summary: String(data.get("summary") ?? ""), recommends: data.get("recommends") === "on" } };
    }
    return result;
  }, {});
  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl bg-secondary/60 p-4">
      <input type="hidden" name="journeyId" value={journeyId} />
      <Field label="FIB-4" hint="Type the value yourself. The app never calculates it.">
        <Input name="fib4" required maxLength={40} autoComplete="off" defaultValue={state.typed?.fib4} />
      </Field>
      <Field label="Clinical summary" hint="Goes to the treating doctor with the original report.">
        <Textarea name="summary" required maxLength={4000} defaultValue={state.typed?.summary} />
      </Field>
      <CheckRow name="recommends" defaultChecked={state.typed?.recommends}>I recommend that the treating doctor considers a FibroScan.</CheckRow>
      <FormMessage error={state.error} />
      <Button type="submit" className="self-start">
        <Send aria-hidden="true" />
        Send to the treating doctor
      </Button>
    </form>
  );
}
