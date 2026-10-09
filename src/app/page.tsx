import { Button } from "@/components/ui/button";

const steps = [
  "Doctor decides",
  "Liv2care coordinates",
  "Patient completes",
  "Doctor sees the outcome",
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-16 sm:px-6">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          Health-a-thon 2026 · Team LIVACARE
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Liv2care</h1>
        <p className="text-lg text-muted-foreground">
          An EHR-independent, closed-loop care-coordination platform for liver-risk assessment in
          people with type 2 diabetes.
        </p>
      </div>

      <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-3">
            <span className="rounded-lg border bg-card px-3 py-2 text-sm font-semibold">{step}</span>
            {i < steps.length - 1 && (
              <span aria-hidden="true" className="hidden text-primary sm:inline">
                →
              </span>
            )}
          </li>
        ))}
      </ol>

      <p className="rounded-lg bg-secondary p-4 text-sm">
        The app is being built in phases. This page confirms the foundations are in place. The
        clickable prototype is the best way to see the full pathway today.
      </p>

      <div className="flex flex-wrap gap-3">
        <Button render={<a href="https://github.com/devesh1905/liv2care-prototype" />}>
          Open the prototype repo
        </Button>
        <Button variant="outline" render={<a href="/api/health" />}>
          Health check
        </Button>
      </div>
    </main>
  );
}
