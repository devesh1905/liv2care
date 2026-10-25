"use client";

import { CalendarCheck, Clock, FlaskConical, House, MapPin, Sparkles, Sunrise } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatSlot, formatSlotParts } from "@/lib/format/slot";
import { t, type Lang } from "@/lib/i18n/patient";
import type { Preference, SlotOption } from "@/lib/logistics/types";
import { cn } from "@/lib/utils";
import { bookSlot, suggestSlot, type BookState } from "./actions";
import { AddressPicker } from "./address-picker";

const PREFS: { key: Preference; icon: typeof MapPin }[] = [
  { key: "nearest", icon: MapPin },
  { key: "earliest", icon: Clock },
  { key: "morning", icon: Sunrise },
];

export function BookingPicker({
  token,
  lang,
  options: labOptions,
  homeOptions = [],
  suggestedSlotId,
}: {
  token: string;
  lang: Lang;
  options: SlotOption[];
  homeOptions?: SlotOption[];
  suggestedSlotId?: string;
}) {
  const offered = [...labOptions, ...homeOptions].find((o) => o.slotId === suggestedSlotId);
  const [home, setHome] = useState((!!offered && homeOptions.some((o) => o.slotId === offered.slotId)) || (labOptions.length === 0 && homeOptions.length > 0));
  const options = home ? homeOptions : labOptions;
  const [chosen, setChosen] = useState<{ partnerId: string; slotId: string } | null>(offered ? { partnerId: offered.partnerId, slotId: offered.slotId } : null);
  const [reason, setReason] = useState<string | null>(offered ? t(lang, "suggestedForYou") : null);
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState<Preference | null>(null);
  const [state, action, booking] = useActionState<BookState, FormData>(bookSlot, {});

  const partners = [...new Map(options.map((o) => [o.partnerId, o])).values()];
  const selected = options.find((o) => o.slotId === chosen?.slotId);

  function ask(pref: Preference) {
    setAsking(pref);
    startTransition(async () => {
      const s = await suggestSlot(token, pref, lang, home);
      if (s) {
        setChosen({ partnerId: s.partnerId, slotId: s.slotId });
        setReason(s.reason);
      }
    });
  }

  function chooseWhere(toHome: boolean) {
    if (toHome === home) return;
    setHome(toHome);
    setChosen(null);
    setReason(null);
  }

  if (labOptions.length === 0 && homeOptions.length === 0) {
    return <p className="rounded-xl border border-dashed bg-card p-6 text-center text-muted-foreground">{t(lang, "noSlots")}</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-6 pb-28">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="partnerId" value={chosen?.partnerId ?? ""} />
      <input type="hidden" name="slotId" value={chosen?.slotId ?? ""} />

      {homeOptions.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-heading text-lg font-extrabold">{t(lang, "whereTitle")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              { toHome: false, label: t(lang, "atLab"), Icon: FlaskConical },
              { toHome: true, label: t(lang, "atHome"), Icon: House },
            ].map(({ toHome, label, Icon }) => (
              <label
                key={label}
                className={cn(
                  "flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/40",
                  home === toHome ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-background hover:bg-muted",
                )}
              >
                <input type="radio" name="where" className="sr-only" checked={home === toHome} onChange={() => chooseWhere(toHome)} />
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </label>
            ))}
          </div>
          {home && <p className="text-sm text-muted-foreground">{t(lang, "homeNote")}</p>}
        </fieldset>
      )}

      <section aria-labelledby="helper" className="flex flex-col gap-3 rounded-2xl bg-secondary/70 p-4">
        <h2 id="helper" className="flex items-center gap-2 text-sm font-bold text-primary">
          <Sparkles className="size-4" aria-hidden="true" />
          {t(lang, "helper")}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {PREFS.map(({ key, icon: Icon }) => (
            <Button key={key} type="button" variant="outline" disabled={pending} loading={pending && asking === key} onClick={() => ask(key)} className="h-auto flex-col gap-1 px-2 py-3 text-xs sm:text-sm">
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
                        <span className={cn("text-xs font-medium", on ? "text-primary-foreground" : "text-muted-foreground")}>{formatSlotParts(o.startsAt).day}</span>
                        <span className="whitespace-nowrap text-base">{formatSlotParts(o.startsAt).time}</span>
                      </span>
                    </label>
                  );
                })}
            </div>
          </div>
        ))}
      </fieldset>

      {home && <AddressPicker lang={lang} />}

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
