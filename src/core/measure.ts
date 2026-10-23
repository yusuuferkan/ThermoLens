import { boxStats, lineProfile, tempAt, type LineProfile, type RegionStats } from './stats';
import type { Point, TemperatureMap } from './types';

export type Measurement =
  | { id: string; kind: 'spot'; a: Point }
  | { id: string; kind: 'box'; a: Point; b: Point }
  | { id: string; kind: 'line'; a: Point; b: Point };

export type MeasurementResult =
  | { kind: 'spot'; value: number }
  | { kind: 'box'; stats: RegionStats }
  | { kind: 'line'; profile: LineProfile };

export function evaluateMeasurement(map: TemperatureMap, m: Measurement): MeasurementResult {
  switch (m.kind) {
    case 'spot':
      return { kind: 'spot', value: tempAt(map, m.a.x, m.a.y) };
    case 'box':
      return { kind: 'box', stats: boxStats(map, m.a, m.b) };
    case 'line':
      return { kind: 'line', profile: lineProfile(map, m.a, m.b) };
  }
}

/** Headline number for a measurement (spot value, box mean, line max). */
export function headlineValue(r: MeasurementResult): number {
  return r.kind === 'spot' ? r.value : r.kind === 'box' ? r.stats.mean : r.profile.max;
}
