import { CircleCheck } from "lucide-react";
import { t, type Lang } from "@/lib/i18n/patient";

/** Shown after the patient has sent their report, and again if they open the link later. */
export function UploadDone({ lang }: { lang: Lang }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-ok/30 bg-ok-soft p-5">
      <CircleCheck className="size-8 text-ok" aria-hidden="true" />
      <h2 className="font-heading text-xl font-extrabold text-ok">{t(lang, "uploadDoneTitle")}</h2>
      <p>{t(lang, "uploadDoneText")}</p>
    </section>
  );
}
