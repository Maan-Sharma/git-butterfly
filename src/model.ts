/** Growth model: contributions decide the life stage, languages decide the colors. */
import type { RGB } from "./palette.js";

export type Stage = "egg" | "caterpillar" | "cocoon" | "butterfly";
export type Thresholds = [number, number, number];

export const DEFAULT_THRESHOLDS: Thresholds = [25, 300, 800]; // egg -> caterpillar -> cocoon -> butterfly
export const FULL_SIZE_AT = 4000; // contributions at which the butterfly reaches full size

export interface Lang {
  name: string;
  color: RGB;
  weight: number;
}

/** A language and how many of the user's repositories use it as their main language. */
export interface RepoLang {
  name: string;
  color: string; // "#rrggbb", the real GitHub color
  count: number;
}

export interface Stats {
  login: string;
  total: number; // lifetime contributions
  streak: number; // current daily streak
  languages: Lang[]; // drives the wing colors
  repoLanguages?: RepoLang[]; // drives the legend (languages by repo count)
}

export interface Growth {
  stage: Stage;
  progress: number; // 0..1 inside the current stage
  scale: number; // butterfly size multiplier
}

export type Band = [RGB, number]; // [color, share of the wing]

/** The pink/orange palette from the reference pixel art, used when no language data exists. */
export const DEFAULT_LANGS: Lang[] = [
  { name: "default", color: [176, 56, 110], weight: 3 },
  { name: "default", color: [232, 128, 120], weight: 2 },
  { name: "default", color: [247, 181, 70], weight: 2 },
];

export function growth(total: number, thresholds: Thresholds = DEFAULT_THRESHOLDS): Growth {
  const [a, b, c] = thresholds;
  if (!(a > 0 && a < b && b < c)) throw new Error("thresholds must be increasing, e.g. 25,300,800");
  if (total < a) return { stage: "egg", progress: total / a, scale: 1 };
  if (total < b) return { stage: "caterpillar", progress: (total - a) / (b - a), scale: 1 };
  if (total < c) return { stage: "cocoon", progress: (total - b) / (c - b), scale: 1 };
  const p = Math.min(1, (total - c) / Math.max(1, FULL_SIZE_AT - c));
  return { stage: "butterfly", progress: p, scale: 0.75 + 0.6 * p };
}

/** The languages worth showing by name: biggest first, tiny ones dropped. Empty when there is no real data. */
export function topLangs(langs: Lang[], max = 6): Lang[] {
  const real = langs.filter((l) => l.name !== "default");
  const total = real.reduce((s, l) => s + l.weight, 0) || 1;
  return real
    .filter((l) => l.weight / total >= 0.03)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, max);
}

/**
 * Turn languages into (color, share) bands that sum to 1.
 * Biggest language first (it becomes the outer, most visible part of the wing). Tiny languages are
 * dropped and every band gets at least `minShare` so it stays visible.
 */
export function wingBands(langs: Lang[], maxBands = 4, minShare = 0.15): Band[] {
  const all = langs.length ? langs : DEFAULT_LANGS;
  const total = all.reduce((s, l) => s + l.weight, 0) || 1;
  let kept = all.filter((l) => l.weight / total >= 0.03);
  if (!kept.length) kept = all;
  kept = [...kept].sort((a, b) => b.weight - a.weight).slice(0, maxBands);
  const sub = kept.reduce((s, l) => s + l.weight, 0) || 1;
  const shares = kept.map((l) => Math.max(l.weight / sub, minShare));
  const norm = shares.reduce((s, x) => s + x, 0);
  return kept.map((l, i) => [l.color, shares[i] / norm] as Band);
}
