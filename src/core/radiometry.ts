import { bandRadiance, KELVIN_OFFSET, LWIR_BAND_M } from './planck';
import {
  DEFAULT_ATMOSPHERE,
  type AtmosphereCoefficients,
  type Calibration,
  type ObjectParams,
  type PlanckConstants,
  type TemperatureMap,
  type ThermalFrame,
} from './types';

/**
 * Atmospheric transmission over half the object distance (FLIR two-term model):
 *   tau = X exp(-sqrt(d/2)(a1 + b1 sqrt(h2o))) + (1-X) exp(-sqrt(d/2)(a2 + b2 sqrt(h2o)))
 * where h2o is the water vapour content derived from humidity and air temperature.
 * The total path transmission is tau^2 (camera sees the object through two such halves).
 */
export function halfPathTransmission(
  distanceM: number,
  atmosphericTempC: number,
  humidityPct: number,
  c: AtmosphereCoefficients = DEFAULT_ATMOSPHERE,
): number {
  const t = atmosphericTempC;
  const h2o = (humidityPct / 100) * Math.exp(1.5587 + 0.06939 * t - 0.00027816 * t * t + 0.00000068455 * t * t * t);
  const s = Math.sqrt(distanceM / 2);
  const sh = Math.sqrt(h2o);
  return c.x * Math.exp(-s * (c.alpha1 + c.beta1 * sh)) + (1 - c.x) * Math.exp(-s * (c.alpha2 + c.beta2 * sh));
}

/** Total transmission through the atmosphere between object and camera. */
export function atmosphericTransmission(p: ObjectParams, c?: AtmosphereCoefficients): number {
  const h = halfPathTransmission(p.distanceM, p.atmosphericTempC, p.humidityPct, c);
  return h * h;
}

/** Raw detector signal that a black body at `tempC` would produce: R1 / (R2 (exp(B/T) - F)) - O. */
export function planckSignal(tempC: number, k: PlanckConstants): number {
  return k.R1 / (k.R2 * (Math.exp(k.B / (tempC + KELVIN_OFFSET)) - k.F)) - k.O;
}

/** Inverse of {@link planckSignal}: T = B / ln(R1 / (R2 (S + O)) + F) - 273.15. */
export function signalToTemperature(signal: number, k: PlanckConstants): number {
  const arg = k.R1 / (k.R2 * (signal + k.O)) + k.F;
  if (!(arg > 0)) return NaN;
  const lg = Math.log(arg);
  return lg > 0 ? k.B / lg - KELVIN_OFFSET : NaN;
}

/**
 * Affine map raw -> corrected object signal for FLIR Planck cameras:
 *   S_obj = a * raw + b
 * with emissivity, reflected apparent temperature, atmosphere and IR window
 * terms as used by the community-documented FLIR formula (ExifTool / Thermimage).
 */
export function flirCorrection(
  k: PlanckConstants,
  p: ObjectParams,
  atm: AtmosphereCoefficients = DEFAULT_ATMOSPHERE,
): { a: number; b: number } {
  const E = Math.min(Math.max(p.emissivity, 0.001), 1);
  const tau = halfPathTransmission(p.distanceM, p.atmosphericTempC, p.humidityPct, atm);
  const irt = Math.min(Math.max(p.windowTransmission, 0.001), 1);
  const sRefl = planckSignal(p.reflectedTempC, k);
  const sAtm = planckSignal(p.atmosphericTempC, k);
  const sWind = planckSignal(p.windowTempC, k);
  const reflAttn = ((1 - E) / E) * sRefl;
  const atmAttn1 = ((1 - tau) / E / tau) * sAtm;
  const windAttn = ((1 - irt) / E / tau / irt) * sWind;
  const atmAttn2 = ((1 - tau) / E / tau / irt / tau) * sAtm;
  const a = 1 / (E * tau * irt * tau);
  const b = -(atmAttn1 + atmAttn2 + windAttn + reflAttn);
  return { a, b };
}

/** Convert a raw count to object temperature (deg C) using the FLIR model. */
export function flirRawToCelsius(raw: number, k: PlanckConstants, p: ObjectParams, atm?: AtmosphereCoefficients): number {
  const { a, b } = flirCorrection(k, p, atm);
  return signalToTemperature(a * raw + b, k);
}

/** Inverse: which raw count would an object at `tempC` (true temperature) produce. */
export function celsiusToFlirRaw(tempC: number, k: PlanckConstants, p: ObjectParams, atm?: AtmosphereCoefficients): number {
  const { a, b } = flirCorrection(k, p, atm);
  return (planckSignal(tempC, k) - b) / a;
}

// ---- T-linear (apparent temperature) path --------------------------------

const LUT_MIN_K = 100;
const LUT_MAX_K = 2200;
const LUT_STEP = 0.1;
let radianceLut: Float64Array | null = null;

function lut(): Float64Array {
  if (!radianceLut) {
    const n = Math.round((LUT_MAX_K - LUT_MIN_K) / LUT_STEP) + 1;
    radianceLut = new Float64Array(n);
    for (let i = 0; i < n; i++) radianceLut[i] = bandRadiance(LUT_MIN_K + i * LUT_STEP, LWIR_BAND_M[0], LWIR_BAND_M[1], 32);
  }
  return radianceLut;
}

/** LWIR band radiance (7.5-14 um) at a given Celsius temperature, via interpolated table. */
export function lwirRadiance(tempC: number): number {
  const t = lut();
  const f = (tempC + KELVIN_OFFSET - LUT_MIN_K) / LUT_STEP;
  const i = Math.min(Math.max(Math.floor(f), 0), t.length - 2);
  return t[i] + (t[i + 1] - t[i]) * (f - i);
}

/** Inverse of {@link lwirRadiance}; returns Celsius. */
export function lwirRadianceToCelsius(L: number): number {
  const t = lut();
  if (!(L > t[0]) || !(L < t[t.length - 1])) return NaN;
  let lo = 0;
  let hi = t.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid] <= L) lo = mid;
    else hi = mid;
  }
  const frac = (L - t[lo]) / (t[hi] - t[lo]);
  return LUT_MIN_K + (lo + frac) * LUT_STEP - KELVIN_OFFSET;
}

/**
 * Correct an apparent (emissivity 1, no atmosphere) temperature for emissivity,
 * reflection and atmosphere using LWIR band radiance:
 *   L_app = eps tau L_obj + (1-eps) tau L_refl + (1-tau) L_atm
 */
export function correctApparentTemperature(apparentC: number, p: ObjectParams): number {
  const tau = atmosphericTransmission(p);
  if (p.emissivity >= 0.9999 && tau >= 0.9999) return apparentC;
  const E = Math.min(Math.max(p.emissivity, 0.001), 1);
  const lApp = lwirRadiance(apparentC);
  const lObj = (lApp - (1 - E) * tau * lwirRadiance(p.reflectedTempC) - (1 - tau) * lwirRadiance(p.atmosphericTempC)) / (E * tau);
  return lwirRadianceToCelsius(lObj);
}

// ---- Frame -> temperature map --------------------------------------------

/** Returns a function mapping a raw count to a corrected temperature for this frame. */
export function makeRawConverter(cal: Calibration, p: ObjectParams): (raw: number) => number {
  if (cal.kind === 'planck') {
    const { a, b } = flirCorrection(cal.planck, p, cal.atmosphere);
    const k = cal.planck;
    return (raw) => signalToTemperature(a * raw + b, k);
  }
  const { kelvinPerCount: kpc, offsetK } = cal;
  return (raw) => correctApparentTemperature(raw * kpc + offsetK - KELVIN_OFFSET, p);
}

export function computeTemperatureMap(frame: Pick<ThermalFrame, 'width' | 'height' | 'raw' | 'calibration' | 'params'>): TemperatureMap {
  const { width, height, raw } = frame;
  const conv = makeRawConverter(frame.calibration, frame.params);
  const data = new Float32Array(raw.length);
  // Cache per raw count: scenes use far fewer distinct counts than pixels.
  let lo = 65535;
  let hi = 0;
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const cache = new Float32Array(hi - lo + 1).fill(Number.NaN);
  const done = new Uint8Array(hi - lo + 1);
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let n = 0;
  let minI = 0;
  let maxI = 0;
  for (let i = 0; i < raw.length; i++) {
    const idx = raw[i] - lo;
    let t: number;
    if (done[idx]) t = cache[idx];
    else {
      t = conv(raw[i]);
      cache[idx] = t;
      done[idx] = 1;
    }
    data[i] = t;
    if (Number.isFinite(t)) {
      if (t < min) { min = t; minI = i; }
      if (t > max) { max = t; maxI = i; }
      sum += t;
      n++;
    }
  }
  return {
    width,
    height,
    data,
    min: n ? min : NaN,
    max: n ? max : NaN,
    mean: n ? sum / n : NaN,
    minAt: { x: minI % width, y: Math.floor(minI / width) },
    maxAt: { x: maxI % width, y: Math.floor(maxI / width) },
  };
}
