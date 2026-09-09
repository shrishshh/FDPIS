/**
 * Deterministic pseudo-randomness.
 *
 * Every mock value in FDPIS is derived from a fixed seed so that the demo is
 * byte-identical on every run, on every machine. Nothing here uses Math.random.
 */

/** mulberry32 — small, fast, good enough for fixtures. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a — stable string hash, used to derive per-entity jitter. */
export function hashString(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Stable 0–1 value for any string key. */
export function unitFromKey(key: string): number {
  return hashString(key) / 4294967296;
}

export function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

/** Weighted pick. Weights need not sum to 1. */
export function pickWeighted<T>(
  rng: () => number,
  items: readonly T[],
  weight: (item: T) => number,
): T {
  const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0);
  if (total <= 0) return items[0];
  let target = rng() * total;
  for (const item of items) {
    target -= Math.max(0, weight(item));
    if (target <= 0) return item;
  }
  return items[items.length - 1];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
