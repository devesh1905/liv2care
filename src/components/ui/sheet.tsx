"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A panel that slides in from the right. Built on the accessible Dialog: focus stays inside while it is open,
 * Escape and the close button shut it, and the page behind is dimmed.
 */
export function Sheet({
  trigger,
  triggerClassName,
  title,
  description,
  children,
}: {
  trigger: React.ReactNode;
  triggerClassName?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className={triggerClassName}>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-foreground/40 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col gap-5 overflow-y-auto bg-card p-6 shadow-2xl outline-none",
            "transition-transform duration-200 data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-heading text-xl font-extrabold">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-1 text-sm text-muted-foreground">{description}</Dialog.Description>}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="grid size-10 shrink-0 place-items-center rounded-lg border bg-card shadow-sm hover:bg-muted"
            >
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
