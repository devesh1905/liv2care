import { CalendarCheck, CircleCheck, Info, Languages } from "lucide-react";
import { connection } from "next/server";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { loadBookingView } from "@/lib/booking/view";
import { isLang, t, TITLE_KEY, type Lang } from "@/lib/i18n/patient";
import { BookingPicker } from "./booking-picker";

export const metadata = {
  title: "Book your appointment",
  // A booking link is private: keep it out of search results and referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

async function Content({ params, searchParams }: Pick<PageProps<"/book/[token]">, "params" | "searchParams">) {
  await connection();
  const { token } = await params;
  const wanted = (await searchParams).lang;
  const view = await loadBookingView(token);

  const lang: Lang = isLang(wanted) ? wanted : view.kind === "ready" || view.kind === "booked" ? view.language : "en";
  const other: Lang = lang === "en" ? "hi" : "en";

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <a
            href={`?lang=${other}`}
            lang={other}
            className="inline-flex h-10 items-center gap-2 rounded-lg border bg-card px-3 text-sm font-semibold shadow-sm hover:bg-muted"
          >
            <Languages className="size-4" aria-hidden="true" />
            {t(lang, "language")}
          </a>
        </div>
      </header>

      <main lang={lang} className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl">{t(lang, "journey")}</h1>

        {view.kind === "invalid" && (
          <p role="alert" className="flex gap-3 rounded-2xl bg-bad-soft p-4 font-medium text-bad">
            <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            {t(lang, "linkInvalid")}
          </p>
        )}

        {view.kind === "nothing" && (
          <p className="flex gap-3 rounded-2xl border bg-card p-4">
            <Info className="mt-0.5 size-5 shrink-0 text-info" aria-hidden="true" />
            {t(lang, "nothingToBook")}
          </p>
        )}

        {view.kind === "booked" && (
          <section className="flex flex-col gap-3 rounded-2xl border border-ok/30 bg-ok-soft p-5">
            <CircleCheck className="size-8 text-ok" aria-hidden="true" />
            <h2 className="font-heading text-xl font-extrabold text-ok">{t(lang, "booked")}</h2>
            <p>{t(lang, "seeYou", { place: view.partnerName, slot: view.slotLabel })}</p>
          </section>
        )}

        {view.kind === "ready" && (
          <>
            <div className="flex flex-col gap-1">
              <p className="text-lg font-semibold">
                {t(lang, "hello")} {view.firstName}.
              </p>
              <h2 className="flex items-center gap-2 font-heading text-xl font-extrabold text-primary">
                <CalendarCheck className="size-5" aria-hidden="true" />
                {t(lang, TITLE_KEY[view.partnerKind])}
              </h2>
            </div>
            {view.reschedule && <p className="rounded-2xl bg-warn-soft p-4 font-semibold text-warn">{t(lang, "resched")}</p>}
            <BookingPicker token={token} lang={lang} options={view.options} />
          </>
        )}
      </main>
    </div>
  );
}

export default function Page(props: PageProps<"/book/[token]">) {
  return (
    <Suspense fallback={<p role="status" className="p-8 text-muted-foreground">Loading…</p>}>
      <Content params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
