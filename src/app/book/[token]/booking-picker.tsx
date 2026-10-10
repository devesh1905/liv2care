"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatSlot } from "@/lib/booking/format";
import { t, type Lang } from "@/lib/i18n/patient";
import type { Preference, SlotOption } from "@/lib/logistics/types";
import { bookSlot, suggestSlot, type BookState } from "./actions";

const PREFS: Preference[] = ["nearest", "earliest", "morning"];

export function BookingPicker({ token, lang, options }: { token: string; lang: Lang; options: SlotOption[] }) {
  const [chosen, setChosen] = useState<{ partnerId: string; slotId: string } | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [state, action, booking] = useActionState<BookState, FormData>(bookSlot, {});

  const partners = [...new Map(options.map((o) => [o.partnerId, o])).values()];

  function ask(pref: Preference) {
    startTransition(async () => {
      const s = await suggestSlot(token, pref, lang);
      if (s) {
        setChosen({ partnerId: s.partnerId, slotId: s.slotId });
        setReason(s.reason);
      }
    });
  }

  if (options.length === 0) return <p className="text-muted-foreground">{t(lang, "noSlots")}</p>;

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="partnerId" value={chosen?.partnerId ?? ""} />
      <input type="hidden" name="slotId" value={chosen?.slotId ?? ""} />

      <section aria-labelledby="helper" className="flex flex-col gap-3 rounded-lg bg-secondary p-4">
        <h2 id="helper" className="text-sm font-semibold">
          {t(lang, "helper")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {PREFS.map((p) => (
            <Button key={p} type="button" variant="outline" disabled={pending} onClick={() => ask(p)}>
              {t(lang, p)}
            </Button>
          ))}
        </div>
        {reason && (
          <p role="status" className="text-sm">
            {reason}. {t(lang, "use")}.
          </p>
        )}
      </section>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-2 font-semibold">{t(lang, "pick")}</legend>
        {partners.map((p) => (
          <div key={p.partnerId} className="flex flex-col gap-2">
            <h3 className="font-extrabold">
              {p.partnerName} <span className="text-sm font-normal text-muted-foreground">{p.area} · {p.distanceKm} {t(lang, "away")}</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {options
                .filter((o) => o.partnerId === p.partnerId)
                .map((o) => {
                  const selected = chosen?.slotId === o.slotId;
                  return (
                    <label
                      key={o.slotId}
                      className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-semibold has-focus-visible:ring-2 has-focus-visible:ring-ring ${selected ? "border-primary bg-primary text-primary-foreground" : ""}`}
                    >
                      <input
                        type="radio"
                        name="choice"
                        className="sr-only"
                        checked={selected}
                        onChange={() => {
                          setChosen({ partnerId: o.partnerId, slotId: o.slotId });
                          setReason(null);
                        }}
                      />
                      {formatSlot(o.startsAt)}
                    </label>
                  );
                })}
            </div>
          </div>
        ))}
      </fieldset>

      {state.error && (
        <p role="alert" className="font-semibold text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={!chosen || booking} className="self-start">
        {t(lang, "confirm")}
      </Button>
    </form>
  );
}
