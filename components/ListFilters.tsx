"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icons";

/** Search box + genre select that keep their state in the URL. */
export function ListFilters({ genres }: { genres: { slug: string; name: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  const push = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("limit");
    router.replace(`${path}?${next.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) push("q", q.trim());
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex items-center gap-2">
      <label className="flex h-10 items-center gap-2 rounded-full border border-line bg-panel px-3 text-muted focus-within:text-text">
        <Icon name="search" size={15} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="w-24 bg-transparent text-[14px] font-medium text-text outline-none placeholder:text-muted sm:w-32" />
      </label>
      <label className="relative flex h-10 items-center rounded-full border border-line bg-panel pr-3 pl-3 text-[14px] font-semibold text-text-2">
        <Icon name="filter" size={15} className="mr-2 text-muted" />
        <select value={params.get("genre") ?? ""} onChange={(e) => push("genre", e.target.value)} className="appearance-none bg-transparent pr-1 outline-none" aria-label="Genre">
          <option value="">All genres</option>
          {genres.map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
