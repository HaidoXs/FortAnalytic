"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fmtCompact } from "@/lib/format";
import { Icon } from "./icons";
import { IslandThumb } from "./IslandThumb";

const EVENT = "fortanalytic:search";
export const openSearch = () => window.dispatchEvent(new Event(EVENT));

type Result = {
  islands: { code: string; title: string; creator: string | null; tags: string[]; ccu: number | null }[];
  creators: { creator: string; players: number; islands: number }[];
  code: string | null;
};

export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const show = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA"].includes(e.target.tagName));
      if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener(EVENT, show);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(EVENT, show);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 0);
    else {
      setQ("");
      setRes(null);
    }
  }, [open]);

  useEffect(() => {
    if (!q.trim()) {
      setRes(null);
      return;
    }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((r: Result) => {
          setRes(r);
          setSel(0);
        })
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  if (!open) return null;

  const links = [
    ...(res?.islands ?? []).map((i) => `/island/${i.code}`),
    ...(res?.creators ?? []).map((c) => `/creator/${encodeURIComponent(c.creator)}`),
  ];
  // A full island code that is not in our catalog yet can still be opened (the page fetches it).
  if (res?.code && !res.islands.length) links.push(`/island/${res.code}`);
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-label="Search islands and creators"
        className="w-full max-w-[560px] overflow-hidden rounded-[22px] border border-line bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Icon name="search" size={18} className="text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSel((s) => Math.min(s + 1, links.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSel((s) => Math.max(s - 1, 0));
              }
              if (e.key === "Enter" && links[sel]) go(links[sel]);
            }}
            placeholder="Island name, creator or code (1234-5678-9012)"
            className="h-14 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted"
          />
          <kbd className="rounded border border-line px-1.5 text-[11px] text-muted">Esc</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!q.trim() && <p className="px-3 py-6 text-center text-sm text-muted">Search 280,000+ Fortnite islands by name, creator or island code.</p>}
          {res && !links.length && <p className="px-3 py-6 text-center text-sm text-muted">No island or creator matches “{q}”.</p>}
          {res?.islands.map((i, idx) => (
            <button
              key={i.code}
              type="button"
              onMouseEnter={() => setSel(idx)}
              onClick={() => go(`/island/${i.code}`)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${sel === idx ? "bg-panel-3" : ""}`}
            >
              <IslandThumb code={i.code} title={i.title} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{i.title}</span>
                <span className="block truncate text-[13px] text-muted">
                  {i.creator ?? "Epic"} · {i.code}
                </span>
              </span>
              {i.ccu != null && <span className="text-sm font-semibold tnum">{fmtCompact(i.ccu)}</span>}
            </button>
          ))}
          {!!res?.creators.length && <p className="px-3 pt-3 pb-1 text-[12px] font-semibold tracking-wide text-muted uppercase">Creators</p>}
          {res?.creators.map((c, j) => {
            const idx = res.islands.length + j;
            return (
              <button
                key={c.creator}
                type="button"
                onMouseEnter={() => setSel(idx)}
                onClick={() => go(`/creator/${encodeURIComponent(c.creator)}`)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${sel === idx ? "bg-panel-3" : ""}`}
              >
                <span className="grid size-[34px] place-items-center rounded-full bg-panel-3 text-sm font-bold uppercase">{c.creator.slice(0, 2)}</span>
                <span className="flex-1 font-semibold">{c.creator}</span>
                <span className="text-[13px] text-muted">
                  {c.islands} islands · {fmtCompact(c.players)} playing
                </span>
              </button>
            );
          })}
          {res?.code && !res.islands.length && (
            <button type="button" onClick={() => go(`/island/${res.code}`)} className="flex w-full items-center gap-3 rounded-xl bg-panel-3 px-3 py-3 text-left">
              <Icon name="external" size={16} /> Open island {res.code}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
