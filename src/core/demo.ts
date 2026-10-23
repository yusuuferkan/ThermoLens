import { importThermalBytes } from './importer';
import { renderScene, type SceneId } from './scenes';
import { buildFlirJpeg } from './synth';
import { encodeTiff16 } from './tiff';
import { DEFAULT_PARAMS, type ObjectParams, type ThermalFrame } from './types';

export interface DemoDef {
  id: SceneId;
  kind: 'flir' | 'raw';
  params: Partial<ObjectParams>;
  camera: string;
}

export const DEMOS: DemoDef[] = [
  { id: 'panel', kind: 'flir', params: { emissivity: 0.95, reflectedTempC: 21, atmosphericTempC: 22, distanceM: 1.2, humidityPct: 40 }, camera: 'Synthetic R-JPEG' },
  { id: 'building', kind: 'flir', params: { emissivity: 0.93, reflectedTempC: 17, atmosphericTempC: 18, distanceM: 3, humidityPct: 55 }, camera: 'Synthetic R-JPEG' },
  { id: 'kitchen', kind: 'flir', params: { emissivity: 0.96, reflectedTempC: 22, atmosphericTempC: 22, distanceM: 1.5, humidityPct: 45 }, camera: 'Synthetic R-JPEG' },
  { id: 'heatsink', kind: 'raw', params: { emissivity: 1 }, camera: 'Synthetic 16-bit TIFF' },
];

/**
 * Build a demo frame. FLIR demos are generated as real R-JPEG byte streams and
 * then run through the production parser, so the demo exercises the same path
 * as an imported file.
 */
export function buildDemoFrame(id: SceneId): ThermalFrame {
  const def = DEMOS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown demo ${id}`);
  const temps = renderScene(id, 160, 120);
  const params: ObjectParams = { ...DEFAULT_PARAMS, ...def.params };
  if (def.kind === 'flir') {
    const jpg = buildFlirJpeg({ width: 160, height: 120, temps, params, cameraModel: 'ThermoLens demo', chunkSize: 30000 });
    return { ...importThermalBytes(jpg, `demo-${id}.jpg`), source: 'demo' };
  }
  // 16-bit TIFF with T-Linear 0.04 K/count: apparent temperature = raw * 0.04 K
  const k = 0.04;
  const raw = new Uint16Array(temps.length);
  for (let i = 0; i < raw.length; i++) raw[i] = Math.round((temps[i] + 273.15) / k);
  const tif = encodeTiff16(160, 120, raw);
  const frame = importThermalBytes(tif, `demo-${id}.tiff`);
  return { ...frame, calibration: { kind: 'tlinear', kelvinPerCount: k, offsetK: 0 }, params, source: 'demo' };
}
