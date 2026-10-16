// Shown right away when a link is clicked, while the server renders the next page.
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-6 flex gap-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2.5 pb-3">
            <div className="size-11 rounded-[11px] bg-panel" />
            <div className="hidden h-6 w-24 rounded-md bg-panel sm:block" />
          </div>
        ))}
      </div>
      <div className="mb-4 h-11 w-full max-w-[460px] rounded-full bg-panel" />
      <div className="mb-1 h-11 rounded-2xl bg-panel" />
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-line px-3 py-3">
          <div className="h-4 w-5 rounded bg-panel" />
          <div className="size-[38px] rounded-[10px] bg-panel" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-1/3 rounded bg-panel" />
            <div className="h-3 w-1/5 rounded bg-panel" />
          </div>
          <div className="h-4 w-16 rounded bg-panel" />
        </div>
      ))}
    </div>
  );
}
