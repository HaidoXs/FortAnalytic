"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Icon } from "./icons";

// The watchlist lives in the browser (no accounts): a list of island codes in localStorage.
const KEY = "fortanalytic.watchlist";

const Ctx = createContext<{ codes: string[]; ready: boolean; toggle: (code: string) => void; has: (code: string) => boolean }>({
  codes: [],
  ready: false,
  toggle: () => {},
  has: () => false,
});

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [codes, setCodes] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setCodes(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
    } catch {
      /* storage blocked: start empty */
    }
    setReady(true);
  }, []);

  const toggle = useCallback((code: string) => {
    setCodes((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [code, ...prev];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const has = useCallback((code: string) => codes.includes(code), [codes]);
  return <Ctx.Provider value={{ codes, ready, toggle, has }}>{children}</Ctx.Provider>;
}

export const useWatchlist = () => useContext(Ctx);

export function StarButton({ code, size = 16, className = "" }: { code: string; size?: number; className?: string }) {
  const { has, toggle } = useWatchlist();
  const on = has(code);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(code);
      }}
      aria-pressed={on}
      aria-label={on ? "Remove from watchlist" : "Add to watchlist"}
      title={on ? "Remove from watchlist" : "Add to watchlist"}
      className={`grid place-items-center rounded-full p-1.5 transition hover:bg-panel-3 ${on ? "text-[#ffc53d]" : "text-muted/70 hover:text-text"} ${className}`}
    >
      <Icon name="star" size={size} fill={on ? "currentColor" : "none"} />
    </button>
  );
}
