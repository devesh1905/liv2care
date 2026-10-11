"use client";

import { useEffect } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

/** Shown when a page fails unexpectedly. It never prints the error itself, which could hold private details. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The digest is a short reference the team can match with the server log. Nothing else about the error is shown.
    if (error.digest) console.error(`Page error, reference ${error.digest}`);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <Logo size="lg" />
      <div role="alert">
        <h1 className="font-heading text-3xl font-extrabold">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground">
          That did not work, and nothing was lost. Please try again. If it keeps happening, tell your clinic
          {error.digest ? ` and quote the reference ${error.digest}` : ""}.
        </p>
      </div>
      <Button onClick={reset} size="lg" className="self-start">
        Try again
      </Button>
    </main>
  );
}
