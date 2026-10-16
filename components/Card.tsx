import Link from "next/link";
import { Icon } from "./icons";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[22px] bg-panel p-4 ${className}`}>{children}</section>;
}

export function CardHeader({ title, subtitle, href, right }: { title: string; subtitle?: string; href?: string; right?: React.ReactNode }) {
  const inner = (
    <>
      <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
      {subtitle && <span className="truncate text-[13px] font-medium text-muted">{subtitle}</span>}
      <span className="ml-auto flex items-center gap-2 self-center">
        {right}
        {href && <Icon name="chevronRight" size={16} className="text-muted transition group-hover:text-text" />}
      </span>
    </>
  );
  return href ? (
    <Link href={href} className="group mb-2 flex items-baseline gap-2">
      {inner}
    </Link>
  ) : (
    <div className="mb-2 flex items-baseline gap-2">{inner}</div>
  );
}

/** Segmented control made of links (server-friendly). */
export function Pills({ items, active, size = "md" }: { items: { key: string; label: string; href: string }[]; active: string; size?: "md" | "sm" }) {
  return (
    <nav className="no-scrollbar flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-line bg-panel p-1">
      {items.map((it) => (
        <Link
          key={it.key}
          href={it.href}
          scroll={false}
          className={`shrink-0 rounded-full font-semibold transition ${size === "sm" ? "px-3 py-1 text-[13px]" : "px-3.5 py-1.5 text-[14px]"} ${
            it.key === active ? "bg-panel-3 text-text" : "text-muted hover:text-text"
          }`}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[22px] border border-dashed border-line px-6 py-14 text-center">
      <Icon name="database" size={28} className="text-muted" />
      <p className="font-semibold">{title}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}
