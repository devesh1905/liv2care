import { Suspense } from "react";
import { connection } from "next/server";
import { loadBookingView } from "@/lib/booking/view";
import { BookingPicker } from "./booking-picker";
import { isLang, t, TITLE_KEY, type Lang } from "@/lib/i18n/patient";

export const metadata = {
  title: "Book · Liv2care",
  // A booking link is private: keep it out of search results and referrers.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

async function Content({ params, searchParams }: Pick<PageProps<"/book/[token]">, "params" | "searchParams">) {
  await connection();
  const { token } = await params;
  const wanted = (await searchParams).lang;
  const view = await loadBookingView(token);

  const lang: Lang = isLang(wanted) ? wanted : (view.kind === "ready" || view.kind === "booked" ? view.language : "en");
  const other: Lang = lang === "en" ? "hi" : "en";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-extrabold tracking-tight text-primary">Liv2care</p>
          <h1 lang={lang} className="text-2xl font-extrabold tracking-tight">
            {t(lang, "journey")}
          </h1>
        </div>
        <a href={`?lang=${other}`} lang={other} className="rounded-lg border px-3 py-2 text-sm font-semibold">
          {t(lang, "language")}
        </a>
      </header>

      <div lang={lang} className="flex flex-col gap-5">
        {view.kind === "invalid" && <p role="alert">{t(lang, "linkInvalid")}</p>}
        {view.kind === "nothing" && <p>{t(lang, "nothingToBook")}</p>}
        {view.kind === "booked" && (
          <section className="rounded-lg border p-4">
            <h2 className="font-extrabold">{t(lang, "booked")}</h2>
            <p>{t(lang, "seeYou", { place: view.partnerName, slot: view.slotLabel })}</p>
          </section>
        )}
        {view.kind === "ready" && (
          <>
            <p className="font-semibold">
              {t(lang, "hello")} {view.firstName}.
            </p>
            <h2 className="text-lg font-extrabold">{t(lang, TITLE_KEY[view.partnerKind])}</h2>
            {view.reschedule && <p className="rounded-lg bg-secondary p-3 font-semibold">{t(lang, "resched")}</p>}
            <BookingPicker token={token} lang={lang} options={view.options} />
          </>
        )}
      </div>
    </main>
  );
}

export default function Page(props: PageProps<"/book/[token]">) {
  return (
    <Suspense fallback={<p role="status" className="p-8 text-muted-foreground">Loading…</p>}>
      <Content params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
