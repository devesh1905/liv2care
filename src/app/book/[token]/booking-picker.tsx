"use client";

import { CalendarCheck, Clock, MapPin, Sparkles, Sunrise } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatSlot, formatSlotParts } from "@/lib/format/slot";
import { t, type Lang } from "@/lib/i18n/patient";
import type { Preference, SlotOption } from "@/lib/logistics/types";
import { cn } from "@/lib/utils";
import { bookSlot, suggestSlot, type BookState } from "./actions";

const PREFS: { key: Preference; icon: typeof MapPin }[] = [
  { key: "nearest", icon: MapPin },
  { key: "earliest", icon: Clock },
  { key: "morning", icon: Sunrise },
];

export function BookingPicker({ token, lang, options }: { token: string; lang: Lang; options: SlotOption[] }) {
  const [chosen, setChosen] = useState<{ partnerId: string; slotId: string } | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [state, action, booking] = useActionState<BookState, FormData>(bookSlot, {});

  const partners = [...new Map(options.map((o) => [o.partnerId, o])).values()];
  const selected = options.find((o) => o.slotId === chosen?.slotId);

  function ask(pref: Preference) {
    startTransition(async () => {
      const s = await suggestSlot(token, pref, lang);
      if (s) {
        setChosen({ partnerId: s.partnerId, slotId: s.slotId });
        setReason(s.reason);
      }
    });
  }

  if (options.length === 0) {
    return <p className="rounded-xl border border-dashed bg-card p-6 text-center text-muted-foreground">{t(lang, "noSlots")}</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-6 pb-28">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="partnerId" value={chosen?.partnerId ?? ""} />
      <input type="hidden" name="slotId" value={chosen?.slotId ?? ""} />

      <section aria-labelledby="helper" className="flex flex-col gap-3 rounded-2xl bg-secondary/70 p-4">
        <h2 id="helper" className="flex items-center gap-2 text-sm font-bold text-primary">
          <Sparkles className="size-4" aria-hidden="true" />
          {t(lang, "helper")}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {PREFS.map(({ key, icon: Icon }) => (
            <Button key={key} type="button" variant="outline" disabled={pending} onClick={() => ask(key)} className="h-auto flex-col gap-1 px-2 py-3 text-xs sm:text-sm">
              <Icon className="size-5 text-primary" aria-hidden="true" />
              {t(lang, key)}
            </Button>
          ))}
        </div>
        {reason && (
          <p role="status" className="text-sm font-medium">
            {reason}. <span className="text-muted-foreground">{t(lang, "use")}</span>
          </p>
        )}
      </section>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 font-heading text-lg font-extrabold">{t(lang, "pick")}</legend>
        {partners.map((p) => (
          <div key={p.partnerId} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-card">
            <div>
              <h3 className="font-heading font-extrabold">{p.partnerName}</h3>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden="true" />
                {p.area} · {p.distanceKm} {t(lang, "away")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {options
                .filter((o) => o.partnerId === p.partnerId)
                .map((o) => {
                  const on = chosen?.slotId === o.slotId;
                  return (
                    <label
                      key={o.slotId}
                      className={cn(
                        "flex min-h-14 cursor-pointer items-center justify-center rounded-xl border px-2 py-2 text-center text-sm font-semibold transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/40",
                        on ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-background hover:bg-muted",
                      )}
                    >
                      <input
                        type="radio"
                        name="choice"
                        className="sr-only"
                        checked={on}
                        onChange={() => {
                          setChosen({ partnerId: o.partnerId, slotId: o.slotId });
                          setReason(null);
                        }}
                      />
                      <span className="flex flex-col leading-tight">
                        <span className="text-xs font-medium opacity-80">{formatSlotParts(o.startsAt).day}</span>
                        <span className="whitespace-nowrap text-base">{formatSlotParts(o.startsAt).time}</span>
                      </span>
                    </label>
                  );
                })}
            </div>
          </div>
        ))}
      </fieldset>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-card/95 p-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          {state.error && (
            <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">
              {state.error}
            </p>
          )}
          {selected && (
            <p className="text-sm font-semibold">
              {selected.partnerName} · {formatSlot(selected.startsAt)}
            </p>
          )}
          <Button type="submit" size="lg" disabled={!chosen || booking} className="w-full">
            <CalendarCheck aria-hidden="true" />
            {t(lang, "confirm")}
          </Button>
        </div>
      </div>
    </form>
  );
}
