import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  icon,
  className,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="flex items-start gap-3">
        {icon && (
          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
            {icon}
          </span>
        )}
        <div>
          <h1 className="font-heading text-2xl font-extrabold sm:text-3xl">{title}</h1>
          {description && <p className="mt-1 max-w-prose text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
