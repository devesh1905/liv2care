"use client";

import { ArrowLeft, CheckCheck, ExternalLink, MessageSquareText, Signal, Wifi } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";

export type PhoneMessage = { id: string; channel: string; body: string; created_at: string };

const URL_PATTERN = /(https?:\/\/\S+)/g;

/** The patient pages open inside the phone as a path on this site, whatever address the message was written with. */
function pathOf(url: string): string | null {
  try {
    const { pathname, search } = new URL(url);
    return /^\/(book|patient)\/[A-Za-z0-9_-]{32}$/.test(pathname) ? `${pathname}${search}` : null;
  } catch {
    return null;
  }
}

function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
}

/**
 * A phone on the screen, for the demo: the patient's messages as a chat, and the booking, upload and progress pages
 * opening inside the phone when a link is tapped. It reloads the messages every few seconds so what staff do shows up.
 */
export function PhoneSimulator({ patientName, messages }: { patientName: string; messages: PhoneMessage[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [router]);

  useEffect(() => {
    if (!open) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, open]);

  return (
    <div className="flex justify-center py-2">
      <div
        role="group"
        aria-label={`${patientName}'s phone`}
        className="flex h-[680px] w-[340px] flex-col overflow-hidden rounded-[2.5rem] border-[10px] border-slate-800 bg-white text-slate-900 shadow-xl"
      >
        <div className="flex items-center justify-between bg-slate-800 px-5 pb-1 pt-0.5 text-[11px] font-semibold text-white" aria-hidden="true">
          <span>9:41</span>
          <span className="flex items-center gap-1">
            <Signal className="size-3" />
            <Wifi className="size-3" />
          </span>
        </div>

        {open ? (
          <>
            <div className="flex items-center gap-2 border-b bg-slate-100 px-3 py-2">
              <button type="button" onClick={() => setOpen(null)} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Messages
              </button>
              <a href={open} target="_blank" rel="noopener" className="ml-auto inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-200">
                Full screen
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </div>
            <iframe title="The page the patient sees" src={open} className="min-h-0 w-full flex-1 border-0 bg-white" sandbox="allow-same-origin allow-scripts allow-forms" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white">
              <span className="grid size-9 place-items-center rounded-full bg-white/20" aria-hidden="true">
                <MessageSquareText className="size-5" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-bold">Liv2care</p>
                <p className="text-xs text-emerald-100">Official updates for {patientName}</p>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-[#efeae2] px-3 py-4" aria-live="polite">
              {messages.length === 0 && <p className="m-auto text-center text-sm text-slate-500">No messages yet.</p>}
              {messages.map((m) => (
                <article
                  key={m.id}
                  className={`max-w-[88%] self-start rounded-2xl rounded-tl-sm px-3 py-2 text-sm shadow-sm ${m.channel === "WhatsApp" ? "bg-white" : "bg-slate-200"}`}
                >
                  <p className="whitespace-pre-line break-words">
                    {m.body.split(URL_PATTERN).map((part, i) => {
                      const path = /^https?:\/\//.test(part) ? pathOf(part) : null;
                      return path ? (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setOpen(path)}
                          className="my-1 block w-full rounded-lg bg-[#075e54] px-3 py-2 text-center text-sm font-semibold text-white hover:bg-[#064e46]"
                        >
                          {path.startsWith("/patient/") ? "Open my progress page" : "Open the link"}
                        </button>
                      ) : (
                        <Fragment key={i}>{part}</Fragment>
                      );
                    })}
                  </p>
                  <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-slate-600">
                    {m.channel} · {clock(m.created_at)}
                    {m.channel === "WhatsApp" && <CheckCheck className="size-3.5 text-sky-600" aria-hidden="true" />}
                  </p>
                </article>
              ))}
              <div ref={endRef} />
            </div>
            <div className="border-t bg-slate-100 px-3 py-2 text-center text-xs text-slate-600">Replies are switched off in this demo.</div>
          </>
        )}
      </div>
    </div>
  );
}
