"use client";

import { Calculator } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { fib4 } from "@/lib/clinical/fib4";

const FIELDS = [
  { key: "age", label: "Age", unit: "years" },
  { key: "ast", label: "AST", unit: "U/L" },
  { key: "alt", label: "ALT", unit: "U/L" },
  { key: "platelets", label: "Platelets", unit: "×10⁹/L" },
] as const;

/**
 * Works out FIB-4 from four values the clinician types from the report. It shows the number only: no threshold, no
 * interpretation. The clinician checks it and puts it in the FIB-4 box. The values are not saved or sent (no names, so the
 * form does not submit them).
 */
export function Fib4Calculator({ onUse, defaultOpen = false }: { onUse?: (value: string) => void; defaultOpen?: boolean }) {
  const [values, setValues] = useState<Record<string, string>>({ age: "", ast: "", alt: "", platelets: "" });
  const result = fib4({ age: Number(values.age), ast: Number(values.ast), alt: Number(values.alt), platelets: Number(values.platelets) });
  const filled = Object.values(values).every((v) => v.trim() !== "");

  return (
    <details open={defaultOpen || undefined} className="rounded-xl border bg-card p-4">
      <summary className="flex cursor-pointer items-center gap-2 font-heading font-bold">
        <Calculator className="size-4 text-primary" aria-hidden="true" />
        FIB-4 calculator
      </summary>
      <div className="mt-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold">
                {f.label} <span className="font-normal text-muted-foreground">({f.unit})</span>
              </span>
              <Input
                inputMode="decimal"
                autoComplete="off"
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <p role="status" className="text-sm">
          {result !== null ? (
            <>
              FIB-4: <span className="font-heading text-lg font-extrabold">{result.toFixed(2)}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{filled ? "Check the values: one is missing or out of range." : "Type the four values from the report."}</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">(Age × AST) ÷ (platelets × √ALT). Check the result against the report before you use it.</p>
        {onUse && (
          <Button type="button" variant="outline" disabled={result === null} onClick={() => result !== null && onUse(result.toFixed(2))} className="self-start">
            Put {result !== null ? result.toFixed(2) : "it"} in the FIB-4 box
          </Button>
        )}
      </div>
    </details>
  );
}
