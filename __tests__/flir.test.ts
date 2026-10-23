import { computeTemperatureMap, planckSignal, signalToTemperature, celsiusToFlirRaw, flirRawToCelsius } from '../src/core/radiometry';
import { parseFlirJpeg, looksLikeFlirJpeg, reassembleFff } from '../src/core/flir';
import { buildFlirJpeg, SAMPLE_PLANCK } from '../src/core/synth';
import { renderScene } from '../src/core/scenes';
import { DEFAULT_PARAMS } from '../src/core/types';
import { buildDemoFrame } from '../src/core/demo';
import { importThermalBytes, ImportError } from '../src/core/importer';

const params = { ...DEFAULT_PARAMS, emissivity: 0.95, reflectedTempC: 21, atmosphericTempC: 22, distanceM: 1.5, humidityPct: 45 };

function roundTrip(opts: Partial<Parameters<typeof buildFlirJpeg>[0]>) {
  const temps = renderScene('panel', 160, 120);
  const jpg = buildFlirJpeg({ width: 160, height: 120, temps, params, ...opts });
  const parsed = parseFlirJpeg(jpg);
  const frame = { ...parsed, params: parsed.params };
  const map = computeTemperatureMap(frame);
  let worst = 0;
  for (let i = 0; i < temps.length; i++) worst = Math.max(worst, Math.abs(map.data[i] - temps[i]));
  return { parsed, worst, temps, map };
}

describe('Planck inverse', () => {
  it('signalToTemperature inverts planckSignal', () => {
    for (const t of [-20, 0, 25, 100, 300, 500]) {
      expect(signalToTemperature(planckSignal(t, SAMPLE_PLANCK), SAMPLE_PLANCK)).toBeCloseTo(t, 6);
    }
  });
  it('raw counts at room temperature are in a plausible 16-bit range', () => {
    const raw = celsiusToFlirRaw(25, SAMPLE_PLANCK, { ...DEFAULT_PARAMS, emissivity: 1, distanceM: 0 });
    expect(raw).toBeGreaterThan(5000);
    expect(raw).toBeLessThan(65535);
  });
});

describe('FLIR R-JPEG parser', () => {
  it('detects FLIR segments and rejects plain JPEG', () => {
    const jpg = buildFlirJpeg({ width: 160, height: 120, temps: renderScene('panel'), params });
    expect(looksLikeFlirJpeg(jpg)).toBe(true);
    expect(looksLikeFlirJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xd9]))).toBe(false);
    expect(() => importThermalBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 'x.jpg')).toThrow(ImportError);
  });

  it('reassembles multi-chunk FFF data in index order', () => {
    const jpg = buildFlirJpeg({ width: 160, height: 120, temps: renderScene('panel'), params, chunkSize: 2000 });
    const fff = reassembleFff(jpg);
    expect(String.fromCharCode(fff[0], fff[1], fff[2])).toBe('FFF');
    expect(fff.length).toBeGreaterThan(2000 * 3);
  });

  it('reads scene parameters and Planck constants from CameraInfo', () => {
    const { parsed } = roundTrip({});
    expect(parsed.width).toBe(160);
    expect(parsed.height).toBe(120);
    expect(parsed.params.emissivity).toBeCloseTo(0.95, 5);
    expect(parsed.params.reflectedTempC).toBeCloseTo(21, 3);
    expect(parsed.params.atmosphericTempC).toBeCloseTo(22, 3);
    expect(parsed.params.distanceM).toBeCloseTo(1.5, 5);
    expect(parsed.params.humidityPct).toBeCloseTo(45, 3);
    expect(parsed.calibration.kind).toBe('planck');
    if (parsed.calibration.kind === 'planck') {
      expect(parsed.calibration.planck.B).toBe(1501);
      expect(parsed.calibration.planck.O).toBe(-7340);
      expect(parsed.calibration.planck.R1).toBeCloseTo(21106.77, 1);
    }
    expect(parsed.cameraModel).toBe('Synthetic');
  });

  it.each([
    ['PNG little-endian', { encoding: 'png' as const }],
    ['PNG big-endian structures', { encoding: 'png' as const, littleEndian: false }],
    ['PNG with byte-swapped samples', { encoding: 'png' as const, swapSamples: true }],
    ['raw 16-bit', { encoding: 'raw' as const }],
    ['raw 16-bit big-endian structures', { encoding: 'raw' as const, littleEndian: false }],
    ['raw with byte-swapped samples', { encoding: 'raw' as const, swapSamples: true }],
    ['many small chunks', { chunkSize: 1500 }],
  ])('temperature round trip: %s', (_n, opts) => {
    const { worst, parsed } = roundTrip(opts);
    expect(parsed.width * parsed.height).toBe(160 * 120);
    expect(worst).toBeLessThan(0.1);
  });

  it('flags byte-swapped samples', () => {
    expect(roundTrip({ swapSamples: true }).parsed.byteSwapped).toBe(true);
    expect(roundTrip({}).parsed.byteSwapped).toBe(false);
  });

  it('lower emissivity setting raises the computed temperature of a hot target', () => {
    const { parsed } = roundTrip({});
    if (parsed.calibration.kind !== 'planck') throw new Error('expected planck');
    const raw = parsed.raw[60 * 160 + 98 * 1];
    const hi = flirRawToCelsius(raw, parsed.calibration.planck, { ...parsed.params, emissivity: 0.95 });
    const lo = flirRawToCelsius(raw, parsed.calibration.planck, { ...parsed.params, emissivity: 0.6 });
    expect(lo).toBeGreaterThan(hi);
  });

  it('emissivity 1 with no atmosphere path is the plain Planck inverse', () => {
    const p = { ...DEFAULT_PARAMS, emissivity: 1, distanceM: 0 };
    const raw = 20000;
    expect(flirRawToCelsius(raw, SAMPLE_PLANCK, p)).toBeCloseTo(signalToTemperature(raw, SAMPLE_PLANCK), 6);
  });
});

describe('demo frames', () => {
  it.each(['panel', 'building', 'kitchen', 'heatsink'] as const)('%s builds and has plausible extremes', (id) => {
    const f = buildDemoFrame(id);
    const m = computeTemperatureMap(f);
    expect(f.width).toBe(160);
    expect(m.min).toBeGreaterThan(-20);
    expect(m.max).toBeLessThan(200);
    expect(m.max - m.min).toBeGreaterThan(10);
  });
  it('panel demo hot spot is recovered through the parser', () => {
    const temps = renderScene('panel');
    const map = computeTemperatureMap(buildDemoFrame('panel'));
    let max = -Infinity;
    for (const t of temps) max = Math.max(max, t);
    expect(map.max).toBeCloseTo(max, 0);
  });
});
