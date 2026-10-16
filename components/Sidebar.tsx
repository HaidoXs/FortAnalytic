"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./icons";
import { openSearch } from "./SearchDialog";

const NAV: { href: string; label: string; icon: IconName; tint: string; match: string[] }[] = [
  { href: "/", label: "Home", icon: "home", tint: "linear-gradient(135deg,#3b82f6,#1d4ed8)", match: ["/"] },
  { href: "/islands", label: "Islands", icon: "chart", tint: "linear-gradient(135deg,#1e3a8a,#2563eb)", match: ["/islands", "/charts", "/genres", "/trends", "/island"] },
  { href: "/creators", label: "Creators", icon: "users", tint: "linear-gradient(135deg,#f59e0b,#ea580c)", match: ["/creators", "/creator"] },
  { href: "/watchlist", label: "Watchlist", icon: "star", tint: "linear-gradient(135deg,#6366f1,#2563eb)", match: ["/watchlist"] },
];

const DISCOVER: { href: string; label: string; icon: IconName; tint: string }[] = [
  { href: "/charts", label: "Charts", icon: "list", tint: "linear-gradient(135deg,#0ea5e9,#2563eb)" },
  { href: "/genres", label: "Genres", icon: "pie", tint: "linear-gradient(135deg,#8b5cf6,#6d28d9)" },
  { href: "/trends", label: "Trends", icon: "flame", tint: "linear-gradient(135deg,#ec4899,#f97316)" },
];

function isActive(path: string, match: string[]) {
  return match.some((m) => (m === "/" ? path === "/" : path === m || path.startsWith(m + "/") || path.startsWith(m + "?")));
}

function Tile({ icon, tint }: { icon: IconName; tint: string }) {
  return (
    <span className="grid size-[22px] place-items-center rounded-[7px] text-white shadow-sm" style={{ background: tint }}>
      <Icon name={icon} size={13} strokeWidth={2.2} />
    </span>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-[19px] font-extrabold tracking-tight">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <rect width="26" height="26" rx="7" fill="var(--accent)" />
        <path d="M8 19V7h10M8 13h7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      FortAnalytic
    </Link>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as "dark" | "light") ?? "dark");
  }, []);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("fortanalytic.theme", next);
    } catch {
      /* ignore */
    }
    setTheme(next);
  };
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="grid size-10 place-items-center rounded-full border border-line bg-panel text-text-2 transition hover:text-text"
    >
      <Icon name={theme === "dark" ? "moon" : "sun"} size={17} />
    </button>
  );
}

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[230px] shrink-0 flex-col border-r border-line px-3 py-5 lg:flex">
      <div className="px-2">
        <Logo />
      </div>
      <button
        type="button"
        onClick={openSearch}
        className="mt-6 flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-semibold text-text-2 transition hover:bg-panel hover:text-text"
      >
        <Icon name="search" size={18} />
        Search
        <kbd className="ml-auto rounded border border-line px-1.5 text-[11px] font-medium text-muted">/</kbd>
      </button>

      <nav className="mt-4 flex flex-col gap-0.5">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-semibold transition ${
              isActive(path, n.match) ? "bg-panel text-text" : "text-text-2 hover:bg-panel/60 hover:text-text"
            }`}
          >
            <Tile icon={n.icon} tint={n.tint} />
            {n.label}
          </Link>
        ))}
      </nav>

      <p className="mt-7 mb-1 px-3 text-[12px] font-semibold tracking-wide text-muted uppercase">Discover</p>
      <nav className="flex flex-col gap-0.5">
        {DISCOVER.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-semibold transition ${
              path === n.href ? "bg-panel text-text" : "text-text-2 hover:bg-panel/60 hover:text-text"
            }`}
          >
            <Tile icon={n.icon} tint={n.tint} />
            {n.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <Link
          href="/about"
          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-semibold transition ${
            path === "/about" ? "bg-panel text-text" : "text-text-2 hover:text-text"
          }`}
        >
          <Icon name="info" size={18} />
          About the data
        </Link>
        <div className="px-1">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

/** Top bar used below the lg breakpoint, where the sidebar is hidden. */
export function MobileBar() {
  const path = usePathname();
  const items = [...NAV, ...DISCOVER.map((d) => ({ ...d, match: [d.href] }))];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur lg:hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <Logo />
        <button type="button" onClick={openSearch} aria-label="Search" className="ml-auto grid size-10 place-items-center rounded-full border border-line bg-panel">
          <Icon name="search" size={17} />
        </button>
        <ThemeToggle />
      </div>
      <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2">
        {items.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold ${isActive(path, n.match) ? "bg-panel-3 text-text" : "text-muted"}`}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
