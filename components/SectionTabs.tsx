import Link from "next/link";
import { Icon, type IconName } from "./icons";

const TABS: { href: string; label: string; icon: IconName; tint: string }[] = [
  { href: "/islands", label: "Islands", icon: "chart", tint: "linear-gradient(135deg,#1e3a8a,#2563eb)" },
  { href: "/charts", label: "Charts", icon: "list", tint: "linear-gradient(135deg,#0ea5e9,#2563eb)" },
  { href: "/genres", label: "Genres", icon: "pie", tint: "linear-gradient(135deg,#8b5cf6,#6d28d9)" },
  { href: "/trends", label: "Trends", icon: "flame", tint: "linear-gradient(135deg,#ec4899,#f97316)" },
];

export function SectionTabs({ active, right }: { active: string; right?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <nav className="no-scrollbar flex gap-2 overflow-x-auto sm:gap-5">
        {TABS.map((t) => {
          const on = t.href === active;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex shrink-0 items-center gap-2.5 border-b-2 pb-3 pr-1 text-[20px] font-extrabold tracking-tight transition sm:text-[24px] ${
                on ? "border-text text-text" : "border-transparent text-muted hover:text-text-2"
              }`}
            >
              <span className={`grid size-9 place-items-center rounded-[11px] text-white sm:size-11 ${on ? "" : "opacity-70"}`} style={{ background: t.tint }}>
                <Icon name={t.icon} size={20} strokeWidth={2.2} />
              </span>
              {t.label}
            </Link>
          );
        })}
      </nav>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}
