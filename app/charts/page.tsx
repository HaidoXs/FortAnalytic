import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/Card";
import { RankMove } from "@/components/Delta";
import { Icon, type IconName } from "@/components/icons";
import { IslandItem } from "@/components/IslandItem";
import { SectionTabs } from "@/components/SectionTabs";
import { fmtCompact, fmtMinutes, fmtPct } from "@/lib/format";
import { boards } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Charts" };

export default function ChartsPage() {
  const all = boards({ compact: fmtCompact, pct: (n) => fmtPct(n, true), min: fmtMinutes });
  const filled = all.filter((b) => b.items.length);

  return (
    <>
      <SectionTabs active="/charts" />
      <nav className="no-scrollbar mb-5 flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-full border border-line bg-panel p-1">
        {filled.map((b) => (
          <a key={b.id} href={`#${b.id}`} className="shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-semibold text-muted transition hover:bg-panel-3 hover:text-text">
            {b.title.replace(/^Top |^Most /, "")}
          </a>
        ))}
      </nav>

      {!filled.length ? (
        <EmptyState title="No chart data yet">Charts fill in after the collector&apos;s first hourly sync.</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filled.map((b) => (
            <section key={b.id} id={b.id} className="scroll-mt-6 rounded-[22px] bg-panel p-4">
              <Link href={b.href} className="group mb-3 flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-[10px] bg-panel-3 text-accent">
                  <Icon name={b.icon as IconName} size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[16px] font-bold tracking-tight">{b.title}</span>
                  <span className="block truncate text-[13px] font-medium text-muted">{b.subtitle}</span>
                </span>
                <Icon name="chevronRight" size={16} className="ml-auto text-muted group-hover:text-text" />
              </Link>
              {b.items.map((it, i) => (
                <IslandItem
                  key={it.row.code}
                  rank={i + 1}
                  code={it.row.code}
                  title={it.row.title}
                  sub={it.row.creator ?? "Epic"}
                  size={36}
                  badge={it.badge && b.id === "played" ? <RankMove text={it.badge.text} tone={it.badge.tone} /> : undefined}
                  right={
                    <span className="flex flex-col items-end">
                      <span className="text-[15px] font-bold tnum">{it.value}</span>
                      {it.badge && b.id === "trending" && <span className="text-[12px] font-semibold text-up tnum">{it.badge.text}</span>}
                    </span>
                  }
                />
              ))}
            </section>
          ))}
        </div>
      )}
      <p className="mt-6 text-[12px] font-medium text-muted">
        Daily boards use the last complete UTC day. Retention and session boards only include islands with at least 2,000 players that day.
      </p>
    </>
  );
}
