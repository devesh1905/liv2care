"use client";

import { ArrowLeft, BadgeCheck, CheckCheck, ExternalLink, HeartPulse, Mic, MoreVertical, Paperclip, Search, Signal, Smile, Wifi } from "lucide-react";
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

/** A short, readable form of a private link, the way WhatsApp shows the address in a message. */
function shown(url: string): string {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname.slice(0, 12)}…`;
  } catch {
    return url;
  }
}

function clock(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso)).toLowerCase();
}

const WHATSAPP_DOODLE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cg fill='none' stroke='%23000000' stroke-opacity='0.05' stroke-width='1.6'%3E%3Ccircle cx='14' cy='16' r='6'/%3E%3Cpath d='M46 12l8 8m0-8l-8 8'/%3E%3Crect x='56' y='46' width='14' height='10' rx='3'/%3E%3Cpath d='M12 56q6-10 12 0'/%3E%3C/g%3E%3C/svg%3E\")";

/**
 * A phone on the screen, for the demo, made to look like a WhatsApp business chat: the patient's messages, and the
 * booking, upload and progress pages opening inside the phone when a link is tapped. It reloads the messages every few
 * seconds so what staff do shows up.
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
        className="flex h-[680px] w-full max-w-[340px] flex-col overflow-hidden rounded-[2.5rem] border-[10px] border-slate-800 bg-[#efeae2] text-[#111b21] shadow-xl"
      >
        <div className="flex items-center justify-between bg-white px-5 pb-1 pt-0.5 text-[11px] font-semibold text-[#111b21]" aria-hidden="true">
          <span>9:41</span>
          <span className="flex items-center gap-1">
            <Signal className="size-3" />
            <Wifi className="size-3" />
          </span>
        </div>

        {open ? (
          <>
            <div className="flex items-center gap-2 bg-[#f0f2f5] px-3 py-2">
              <button type="button" onClick={() => setOpen(null)} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[#111b21] hover:bg-black/5">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Messages
              </button>
              <a href={open} target="_blank" rel="noopener" className="ml-auto inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[#54656f] hover:bg-black/5">
                Full screen
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </div>
            <iframe title="The page the patient sees" src={open} className="min-h-0 w-full flex-1 border-0 bg-white" sandbox="allow-same-origin allow-scripts allow-forms" />
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 bg-white px-3 py-2 shadow-sm">
              <ArrowLeft className="size-5 shrink-0 text-[#111b21]" aria-hidden="true" />
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
                <HeartPulse className="size-5" strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="flex items-center gap-1 truncate text-[15px] font-semibold text-[#111b21]">
                  Livacare
                  <BadgeCheck className="size-4 shrink-0 text-[#00a884]" aria-hidden="true" />
                </p>
                <p className="truncate text-xs text-[#54656f]">Business Account</p>
              </div>
              <Search className="size-5 shrink-0 text-[#54656f]" aria-hidden="true" />
              <MoreVertical className="size-5 shrink-0 text-[#54656f]" aria-hidden="true" />
            </div>

            <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto bg-[#efeae2] px-3 py-3" style={{ backgroundImage: WHATSAPP_DOODLE }} aria-live="polite">
              <p className="mx-auto mt-1 rounded-lg bg-white px-3 py-1 text-xs font-semibold text-[#54656f] shadow-sm">Today</p>
              <p className="mx-auto mb-2 max-w-[92%] rounded-lg bg-[#cdeeee] px-3 py-2 text-center text-xs leading-snug text-[#54656f]">
                This business uses a secure service from Meta to manage this chat. Click to learn more.
              </p>
              {messages.length === 0 && <p className="m-auto text-center text-sm text-[#54656f]">No messages yet.</p>}
              {messages.map((m) => (
                <article
                  key={m.id}
                  className="relative max-w-[86%] self-start rounded-lg rounded-tl-none bg-white px-2.5 pb-1.5 pt-2 text-[14px] leading-snug text-[#111b21] shadow-sm before:absolute before:-left-[7px] before:top-0 before:h-0 before:w-0 before:border-b-[8px] before:border-r-[8px] before:border-b-transparent before:border-r-white before:content-['']"
                >
                  {m.body.split(URL_PATTERN).map((part, i) => {
                    const isUrl = /^https?:\/\//.test(part);
                    const path = isUrl ? pathOf(part) : null;
                    if (path) {
                      const progress = path.startsWith("/patient/");
                      return (
                        <Fragment key={i}>
                          <button
                            type="button"
                            onClick={() => setOpen(path)}
                            aria-label={progress ? "Open my progress page" : "Open the link"}
                            className="my-1 block w-full overflow-hidden rounded-md bg-[#f0f2f5] text-left hover:bg-[#e6e9ec]"
                          >
                            <span className="block bg-[#e1e6ea] px-2.5 py-3 text-xs font-semibold text-[#111b21]">Liv2care</span>
                            <span className="block px-2.5 py-1.5">
                              <span className="block text-[13px] font-semibold text-[#111b21]">{progress ? "Your progress" : "Your liver care journey"}</span>
                              <span className="block text-xs text-[#54656f]">liv2care.vercel.app</span>
                            </span>
                          </button>
                          <span className="block break-all text-[#0a6fa3] underline">{shown(part)}</span>
                        </Fragment>
                      );
                    }
                    return (
                      <span key={i} className="whitespace-pre-line break-words">
                        {part}
                      </span>
                    );
                  })}
                  <span className="float-right ml-3 mt-1 flex items-center gap-1 text-[11px] text-[#54656f]">
                    {clock(m.created_at)}
                    <CheckCheck className="size-3.5 text-[#53bdeb]" aria-hidden="true" />
                  </span>
                  <span className="clear-both block" />
                </article>
              ))}
              <div ref={endRef} />
            </div>

            <div className="px-3 pb-3 pt-1">
              <div className="flex items-center gap-3 rounded-full bg-white px-4 py-2.5 text-[#54656f] shadow-md">
                <Paperclip className="size-5 shrink-0 text-[#111b21]" aria-hidden="true" />
                <Smile className="size-5 shrink-0 text-[#111b21]" aria-hidden="true" />
                <p className="flex-1 truncate text-sm">
                  Type a message<span className="sr-only">. Replies are switched off in this demo.</span>
                </p>
                <Mic className="size-5 shrink-0 text-[#111b21]" aria-hidden="true" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
