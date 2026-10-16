// Epic's public API has no island images, so every island gets generated cover art:
// a gradient seeded by its code, with the title's emoji or initials on top.

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
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden font-extrabold text-white select-none"
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        background: `linear-gradient(${angle}deg, ${a}, ${b})`,
        fontSize: g.emoji ? size * 0.5 : size * 0.36,
        letterSpacing: "-0.02em",
        textShadow: "0 1px 2px rgba(0,0,0,.35)",
      }}
      aria-hidden
    >
      <span
        className="absolute inset-0 opacity-25"
        style={{ background: `radial-gradient(circle at ${20 + (h % 60)}% ${15 + ((h >> 8) % 50)}%, #fff 0, transparent 55%)` }}
      />
      <span className="relative">{g.text}</span>
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
