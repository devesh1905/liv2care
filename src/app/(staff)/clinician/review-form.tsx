"use client";

import { Send } from "lucide-react";
import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CheckRow, Field, FormMessage, Input, Textarea } from "@/components/ui/field";
import { submitReview, type ReviewState } from "./actions";
import { Fib4Calculator } from "./fib4-calculator";

export function ReviewForm({ journeyId }: { journeyId: string }) {
  const fib4Box = useRef<HTMLInputElement>(null);
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
      <Fib4Calculator
        onUse={(value) => {
          if (fib4Box.current) {
            fib4Box.current.value = value;
            fib4Box.current.focus();
          }
        }}
      />
      <Field label="FIB-4" hint="Type it, or use the calculator above and check the result. You decide the value sent.">
        <Input ref={fib4Box} name="fib4" required maxLength={40} autoComplete="off" defaultValue={state.typed?.fib4} />
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
