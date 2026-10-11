import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-16">
      <Link href="/" className="w-fit" aria-label="Liv2care home">
        <Logo size="lg" />
      </Link>
      <div>
        <p className="text-sm font-bold uppercase tracking-wide text-primary">404</p>
        <h1 className="mt-1 font-heading text-3xl font-extrabold">We could not find that page</h1>
        <p className="mt-2 text-muted-foreground">
          The link may be mistyped or out of date. If you were sent a link by text message, ask your clinic to send it again.
        </p>
      </div>
      <Button render={<Link href="/" />} size="lg" className="self-start">
        Go to the home page
      </Button>
    </main>
  );
}
