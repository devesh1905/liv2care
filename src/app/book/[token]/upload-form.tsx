"use client";

import { FileUp } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { t, type Lang } from "@/lib/i18n/patient";
import { sendReport, type UploadState } from "./actions";
import { UploadDone } from "./upload-done";

/** The patient sends their existing lab report, as a PDF or a photo, from their phone. */
export function UploadForm({ token, lang }: { token: string; lang: Lang }) {
  const [state, action, pending] = useActionState<UploadState, FormData>(sendReport, {});

  if (state.done) {
    return <UploadDone lang={lang} />;
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-card">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="lang" value={lang} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">{t(lang, "uploadLabel")}</span>
        <input
          name="report"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          required
          className="text-sm file:mr-3 file:h-11 file:rounded-lg file:border file:bg-card file:px-4 file:font-heading file:font-semibold"
        />
        <span className="text-xs text-muted-foreground">{t(lang, "uploadHint")}</span>
      </label>
      <FormMessage error={state.error} />
      <Button type="submit" size="lg" disabled={pending}>
        <FileUp aria-hidden="true" />
        {pending ? t(lang, "uploadSending") : t(lang, "uploadButton")}
      </Button>
    </form>
  );
}
