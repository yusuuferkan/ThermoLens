import type { Point, TemperatureMap } from './types';

export interface RegionStats {
  min: number;
  max: number;
  mean: number;
  std: number;
  minAt: Point;
  maxAt: Point;
  count: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function tempAt(map: TemperatureMap, x: number, y: number): number {
  const px = clamp(Math.floor(x), 0, map.width - 1);
  const py = clamp(Math.floor(y), 0, map.height - 1);
  return map.data[py * map.width + px];
}

/** Stats over an inclusive pixel box; corners may be given in any order. */
export function boxStats(map: TemperatureMap, a: Point, b: Point): RegionStats {
  const x0 = clamp(Math.floor(Math.min(a.x, b.x)), 0, map.width - 1);
  const x1 = clamp(Math.floor(Math.max(a.x, b.x)), 0, map.width - 1);
  const y0 = clamp(Math.floor(Math.min(a.y, b.y)), 0, map.height - 1);
  const y1 = clamp(Math.floor(Math.max(a.y, b.y)), 0, map.height - 1);
  let min = Infinity, max = -Infinity, sum = 0, sum2 = 0, n = 0;
  let minAt = { x: x0, y: y0 };
  let maxAt = { x: x0, y: y0 };
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = map.data[y * map.width + x];
      if (!Number.isFinite(t)) continue;
      if (t < min) { min = t; minAt = { x, y }; }
      if (t > max) { max = t; maxAt = { x, y }; }
      sum += t;
      sum2 += t * t;
      n++;
    }
  }
  if (!n) return { min: NaN, max: NaN, mean: NaN, std: NaN, minAt, maxAt, count: 0 };
  const mean = sum / n;
  return { min, max, mean, std: Math.sqrt(Math.max(sum2 / n - mean * mean, 0)), minAt, maxAt, count: n };
}

export interface LineProfile {
  values: number[];
  min: number;
  max: number;
  mean: number;
  /** Length in pixels. */
  length: number;
  minIndex: number;
  maxIndex: number;
}

/** Sample the temperature along a straight line (nearest neighbour, one sample per pixel step). */
export function lineProfile(map: TemperatureMap, a: Point, b: Point): LineProfile {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const n = Math.max(2, Math.ceil(length) + 1);
  const values: number[] = [];
  let min = Infinity, max = -Infinity, sum = 0, minIndex = 0, maxIndex = 0;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const t = tempAt(map, a.x + dx * f, a.y + dy * f);
    values.push(t);
    if (t < min) { min = t; minIndex = i; }
    if (t > max) { max = t; maxIndex = i; }
    sum += t;
  }
  return { values, min, max, mean: sum / n, length, minIndex, maxIndex };
}

export function histogram(map: TemperatureMap, bins = 32): { counts: number[]; lo: number; hi: number } {
  const counts = new Array<number>(bins).fill(0);
  const span = Math.max(map.max - map.min, 1e-9);
  for (let i = 0; i < map.data.length; i++) {
    const t = map.data[i];
    if (!Number.isFinite(t)) continue;
    counts[Math.min(bins - 1, Math.floor(((t - map.min) / span) * bins))]++;
  }
  return { counts, lo: map.min, hi: map.max };
}
