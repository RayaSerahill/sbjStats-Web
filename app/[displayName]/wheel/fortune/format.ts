/** Number formatting shared by the Fortune layout pieces. */

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function fmtCompact(n: number) {
  return compact.format(n);
}

export function fmtGil(n: number) {
  return `${compact.format(n)} Gil`;
}

export function fmtInt(n: number) {
  return whole.format(n);
}

export function fmtDelta(n: number) {
  const sign = n < 0 ? "-" : "+";
  return `${sign}${compact.format(Math.abs(n))}`;
}

const AVATARS = [
  "🐱", "🦊", "🐰", "🐻", "🐼", "🐨", "🦁", "🐯", "🐸", "🐧", "🦉", "🐙",
  "🦄", "🐲", "🐳", "🦋", "🐹", "🐮", "🐷", "🐵", "🦝", "🦔", "🐺", "🐥",
  "🦜", "🐢", "🦈", "🐞", "🦩", "🐬",
];

/** A stable little face for a player name so the board feels lived in. */
export function avatarFor(name: string) {
  let hash = 2166136261;
  for (const ch of name.toLowerCase()) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  return AVATARS[hash % AVATARS.length];
}
