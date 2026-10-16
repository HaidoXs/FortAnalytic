"use client";

import { useState } from "react";
import { Icon } from "./icons";

export function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(code).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className="flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-[14px] font-bold tnum transition hover:bg-panel-3"
      title="Copy island code"
    >
      {code}
      <Icon name="copy" size={14} className="text-muted" />
      <span className="sr-only" aria-live="polite">
        {done ? "Copied" : ""}
      </span>
      {done && <span className="text-[12px] font-semibold text-up">Copied</span>}
    </button>
  );
}
