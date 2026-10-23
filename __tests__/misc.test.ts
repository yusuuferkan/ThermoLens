import { decodeGrayPng, encodeGray16Png, encodeRgbaPng, isPng } from '../src/core/png';
import { decodeTiff16, encodeTiff16 } from '../src/core/tiff';
import { base64ToBytes, bytesToBase64 } from '../src/core/base64';
import { colorize } from '../src/core/colorize';
import { paletteLut, paletteColor } from '../src/core/palettes';
import { boxStats, lineProfile, tempAt } from '../src/core/stats';
import { formatTemp, formatDelta, celsiusToFahrenheit } from '../src/core/units';
import { correctApparentTemperature, lwirRadiance, lwirRadianceToCelsius, computeTemperatureMap } from '../src/core/radiometry';
import { importThermalBytes } from '../src/core/importer';
import { DEFAULT_PARAMS, type TemperatureMap } from '../src/core/types';

function mapOf(w: number, h: number, f: (x: number, y: number) => number): TemperatureMap {
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = f(x, y);
  return computeLike(data, w, h);
}
function computeLike(data: Float32Array, width: number, height: number): TemperatureMap {
  let min = Infinity, max = -Infinity;
  data.forEach((v) => { min = Math.min(min, v); max = Math.max(max, v); });
  return { width, height, data, min, max, mean: 0, minAt: { x: 0, y: 0 }, maxAt: { x: 0, y: 0 } };
}

describe('codecs', () => {
  it('16-bit PNG round trip', () => {
    const s = new Uint16Array(30 * 20).map((_, i) => (i * 37) % 65536);
    const png = encodeGray16Png(30, 20, s);
    expect(isPng(png)).toBe(true);
    const d = decodeGrayPng(png);
    expect([d.width, d.height, d.bitDepth]).toEqual([30, 20, 16]);
    expect(Array.from(d.samples)).toEqual(Array.from(s));
  });
  it('RGBA PNG has valid signature and IEND', () => {
    const png = encodeRgbaPng(4, 4, new Uint8ClampedArray(64).fill(200));
    expect(isPng(png)).toBe(true);
    expect(String.fromCharCode(...png.subarray(png.length - 8, png.length - 4))).toBe('IEND');
  });
  it.each([true, false])('TIFF 16-bit round trip (LE=%s)', (le) => {
    const s = new Uint16Array(12 * 7).map((_, i) => i * 500);
    const d = decodeTiff16(encodeTiff16(12, 7, s, le));
    expect([d.width, d.height]).toEqual([12, 7]);
    expect(Array.from(d.samples)).toEqual(Array.from(s));
  });
  it('base64 round trip for all remainders', () => {
    for (let n = 0; n < 10; n++) {
      const b = new Uint8Array(n).map((_, i) => i * 29 + 3);
      expect(Array.from(base64ToBytes(bytesToBase64(b)))).toEqual(Array.from(b));
    }
    expect(bytesToBase64(new TextEncoder().encode('Man'))).toBe('TWFu');
  });
  it('imports 16-bit TIFF and PNG as raw frames', () => {
    const s = new Uint16Array(8 * 6).fill(7500);
    expect(importThermalBytes(encodeTiff16(8, 6, s), 'a.tif').source).toBe('raw');
    const f = importThermalBytes(encodeGray16Png(8, 6, s), 'a.png');
    // 7500 * 0.04 K = 300 K = 26.85 C
    expect(computeTemperatureMap({ ...f, params: { ...DEFAULT_PARAMS, emissivity: 1, distanceM: 0 } }).mean).toBeCloseTo(26.85, 1);
  });
});

describe('palettes and colorize', () => {
  it('ends of white-hot are black and white; black-hot is inverted', () => {
    expect(paletteColor('whiteHot', 0)).toEqual([0, 0, 0]);
    expect(paletteColor('whiteHot', 1)).toEqual([255, 255, 255]);
    expect(paletteColor('blackHot', 0)).toEqual([255, 255, 255]);
    expect(paletteLut('ironbow').length).toBe(768);
  });
  it('maps temperatures across the span and clamps', () => {
    const t = new Float32Array([0, 50, 100, 200]);
    const px = colorize(t, 4, 1, { lo: 0, hi: 100, palette: 'whiteHot' });
    expect(px[0]).toBe(0);
    expect(px[4]).toBeGreaterThan(120);
    expect(px[4]).toBeLessThan(135);
    expect(px[8]).toBe(255);
    expect(px[12]).toBe(255);
    expect(px[3]).toBe(255);
  });
  it('hotspot overlay tints pixels above threshold only', () => {
    const t = new Float32Array([10, 90]);
    const px = colorize(t, 2, 1, { lo: 0, hi: 100, palette: 'whiteHot', hotspotC: 50 });
    expect(px[0]).toBe(px[1]); // cold pixel desaturated
    expect(px[4]).toBeGreaterThan(px[5]); // hot pixel is red-tinted
  });
});

describe('measurements', () => {
  const m = mapOf(10, 10, (x, y) => x + y * 10);
  it('box stats', () => {
    const s = boxStats(m, { x: 2, y: 1 }, { x: 4, y: 2 });
    expect(s.count).toBe(6);
    expect(s.min).toBe(12);
    expect(s.max).toBe(24);
    expect(s.mean).toBeCloseTo(18, 5);
    expect(s.maxAt).toEqual({ x: 4, y: 2 });
  });
  it('box stats accept reversed corners and clamp', () => {
    const s = boxStats(m, { x: 50, y: 50 }, { x: 8, y: 8 });
    expect(s.count).toBe(4);
  });
  it('line profile along a row', () => {
    const p = lineProfile(m, { x: 0, y: 3 }, { x: 9, y: 3 });
    expect(p.values.length).toBe(10);
    expect(p.min).toBe(30);
    expect(p.max).toBe(39);
  });
  it('spot reads nearest pixel and clamps', () => {
    expect(tempAt(m, 3.7, 2.2)).toBe(23);
    expect(tempAt(m, -4, 99)).toBe(90);
  });
});

describe('units', () => {
  it('formats', () => {
    expect(celsiusToFahrenheit(100)).toBe(212);
    expect(formatTemp(25, 'F')).toBe('77.0°F');
    expect(formatTemp(NaN, 'C')).toBe('--');
    expect(formatDelta(10, 'F')).toBe('18.0°F');
  });
});

describe('T-linear correction', () => {
  it('radiance table inverts', () => {
    expect(lwirRadianceToCelsius(lwirRadiance(37.5))).toBeCloseTo(37.5, 2);
  });
  it('is identity for emissivity 1 and no atmosphere', () => {
    expect(correctApparentTemperature(60, { ...DEFAULT_PARAMS, emissivity: 1, distanceM: 0 })).toBe(60);
  });
  it('hot low-emissivity target is corrected upward; cold one downward vs reflection', () => {
    const p = { ...DEFAULT_PARAMS, emissivity: 0.5, reflectedTempC: 20, distanceM: 0 };
    expect(correctApparentTemperature(60, p)).toBeGreaterThan(60);
    expect(correctApparentTemperature(5, p)).toBeLessThan(5);
  });
  it('matches the analytic solution for a grey body', () => {
    const p = { ...DEFAULT_PARAMS, emissivity: 0.8, reflectedTempC: 20, distanceM: 0 };
    const tObj = 80;
    const lApp = 0.8 * lwirRadiance(tObj) + 0.2 * lwirRadiance(20);
    expect(correctApparentTemperature(lwirRadianceToCelsius(lApp), p)).toBeCloseTo(tObj, 1);
  });
});
