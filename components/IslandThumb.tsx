// Epic's public API has no island images, so every island gets generated cover art:
// a gradient seeded by its code, with the title's emoji or initials on top.
// With NEXT_PUBLIC_ISLAND_IMAGES set (see lib/images.ts) the real image covers it when known.

const SHOW_IMAGES = process.env.NEXT_PUBLIC_ISLAND_IMAGES === "fortnitegg";

const PALETTES = [
  ["#ff7a18", "#af002d"],
  ["#00c6ff", "#0072ff"],
  ["#f7971e", "#ffd200"],
  ["#a18cd1", "#5f2c82"],
  ["#11998e", "#38ef7d"],
  ["#fc466b", "#3f5efb"],
  ["#f953c6", "#b91d73"],
  ["#00b09b", "#96c93d"],
  ["#4776e6", "#8e54e9"],
  ["#ee0979", "#ff6a00"],
  ["#1fa2ff", "#12d8fa"],
  ["#f12711", "#f5af19"],
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function glyph(title: string) {
  const emoji = title.match(/\p{Extended_Pictographic}/u)?.[0];
  if (emoji) return { text: emoji, emoji: true };
  const words = title
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const text = (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
  return { text, emoji: false };
}

export function IslandThumb({ code, title, size = 36, rounded = 10 }: { code: string; title: string; size?: number; rounded?: number }) {
  const h = hash(code);
  const [a, b] = PALETTES[h % PALETTES.length];
  const angle = (h >> 4) % 360;
  const g = glyph(title);
  // Styling lives in the .thumb class (globals.css); only the per-island values go inline,
  // which keeps pages listing hundreds of thumbnails small.
  const vars = {
    "--s": `${size}px`,
    "--r": `${rounded}px`,
    "--a": a,
    "--b": b,
    "--d": `${angle}deg`,
    "--x": `${20 + (h % 60)}%`,
    "--y": `${15 + ((h >> 8) % 50)}%`,
  } as React.CSSProperties;
  return (
    <span className={g.emoji ? "thumb emoji" : "thumb"} style={vars} aria-hidden>
      {g.text}
      {SHOW_IMAGES && (
        // Real cover art on top when we have it; /api/thumb answers a transparent pixel otherwise.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/thumb/${code}`} alt="" loading="lazy" decoding="async" />
      )}
    </span>
  );
}

export function ThumbStack({ items, size = 28 }: { items: { code: string; title: string }[]; size?: number }) {
  return (
    <span className="flex">
      {items.slice(0, 3).map((it, i) => (
        <span key={it.code} className="rounded-[9px] ring-2 ring-[var(--panel)]" style={{ marginLeft: i ? -size * 0.35 : 0, zIndex: 3 - i }}>
          <IslandThumb code={it.code} title={it.title} size={size} rounded={8} />
        </span>
      ))}
    </span>
  );
}
