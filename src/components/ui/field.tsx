import { cn } from "@/lib/utils";

const control =
  "h-11 w-full rounded-lg border bg-card px-3 text-base shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:opacity-60";

/** A label above a control, with optional hint text. Wraps the control so the label is always associated. */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(control, className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select className={cn(control, "appearance-auto", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(control, "h-auto min-h-32 py-2.5 leading-relaxed", className)} {...props} />;
}

/** A large checkbox row with text, for consent and options. */
export function CheckRow({ children, className, ...props }: React.ComponentProps<"input"> & { children: React.ReactNode }) {
  return (
    <label className={cn("flex items-start gap-3 text-sm", className)}>
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" {...props} />
      <span>{children}</span>
    </label>
  );
}

/** Success and error messages under a form. */
export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error)
    return (
      <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">
        {error}
      </p>
    );
  if (success)
    return (
      <p role="status" className="rounded-lg bg-ok-soft px-3 py-2 text-sm font-semibold text-ok">
        {success}
      </p>
    );
  return null;
}
