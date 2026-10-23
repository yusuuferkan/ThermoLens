/**
 * Synthetic FLIR-style radiometric JPEG builder.
 *
 * Produces files with the same container structure the parser expects: JPEG
 * APP1 "FLIR" segments carrying an FFF block with a RawData record (PNG or raw
 * 16-bit) and a CameraInfo record holding Planck constants and scene
 * parameters. Used for tests and for the bundled demo images, since no
 * permissively licensed real sample is bundled.
 */
import { encodeGray16Png } from './png';
import { celsiusToFlirRaw } from './radiometry';
import {
  CAMERA_INFO_OFFSET,
  FFF_HEADER_SIZE,
  FFF_RECORD,
  FFF_RECORD_SIZE,
  RAW_HEADER_SIZE,
} from './flir';
import { KELVIN_OFFSET } from './planck';
import { DEFAULT_ATMOSPHERE, type AtmosphereCoefficients, type ObjectParams, type PlanckConstants } from './types';

/** Representative Planck constants (same magnitude as values published for FLIR E-series cameras). */
export const SAMPLE_PLANCK: PlanckConstants = { R1: 21106.77, R2: 0.012545258, B: 1501, F: 1, O: -7340 };

export interface BuildOptions {
  width: number;
  height: number;
  /** True object temperatures in deg C. */
  temps: Float32Array;
  planck?: PlanckConstants;
  atmosphere?: AtmosphereCoefficients;
  params: ObjectParams;
  encoding?: 'png' | 'raw';
  /** Byte order of FFF structures. */
  littleEndian?: boolean;
  /** Store 16-bit samples byte-swapped (mimics some camera firmwares). */
  swapSamples?: boolean;
  /** Maximum payload bytes per APP1 segment (forces multi-chunk reassembly). */
  chunkSize?: number;
  cameraModel?: string;
}

export function tempsToRaw(temps: Float32Array, planck: PlanckConstants, params: ObjectParams, atm?: AtmosphereCoefficients): Uint16Array {
  const raw = new Uint16Array(temps.length);
  for (let i = 0; i < temps.length; i++) {
    raw[i] = Math.min(65535, Math.max(0, Math.round(celsiusToFlirRaw(temps[i], planck, params, atm))));
  }
  return raw;
}

export function buildFlirJpeg(opts: BuildOptions): Uint8Array {
  const planck = opts.planck ?? SAMPLE_PLANCK;
  const atm = opts.atmosphere ?? DEFAULT_ATMOSPHERE;
  const le = opts.littleEndian ?? true;
  const enc = opts.encoding ?? 'png';
  const { width, height, params } = opts;
  const raw = tempsToRaw(opts.temps, planck, params, atm);
  const swap = (v: number) => ((v & 0xff) << 8) | (v >> 8);

  let pixelBytes: Uint8Array;
  if (enc === 'png') {
    const samples = opts.swapSamples ? raw.map(swap) : raw;
    pixelBytes = encodeGray16Png(width, height, samples);
  } else {
    pixelBytes = new Uint8Array(raw.length * 2);
    const dv = new DataView(pixelBytes.buffer);
    for (let i = 0; i < raw.length; i++) dv.setUint16(i * 2, opts.swapSamples ? swap(raw[i]) : raw[i], true);
  }

  // Record payloads
  const rawRec = new Uint8Array(RAW_HEADER_SIZE + pixelBytes.length);
  const rdv = new DataView(rawRec.buffer);
  rdv.setUint16(0, 2, le);
  rdv.setUint16(2, width, le);
  rdv.setUint16(4, height, le);
  rawRec.set(pixelBytes, RAW_HEADER_SIZE);

  const camRec = new Uint8Array(0x340);
  const cdv = new DataView(camRec.buffer);
  const f = (o: number, v: number) => cdv.setFloat32(o, v, le);
  f(CAMERA_INFO_OFFSET.emissivity, params.emissivity);
  f(CAMERA_INFO_OFFSET.objectDistance, params.distanceM);
  f(CAMERA_INFO_OFFSET.reflectedTemp, params.reflectedTempC + KELVIN_OFFSET);
  f(CAMERA_INFO_OFFSET.atmosphericTemp, params.atmosphericTempC + KELVIN_OFFSET);
  f(CAMERA_INFO_OFFSET.windowTemp, params.windowTempC + KELVIN_OFFSET);
  f(CAMERA_INFO_OFFSET.windowTransmission, params.windowTransmission);
  f(CAMERA_INFO_OFFSET.humidity, params.humidityPct / 100);
  f(CAMERA_INFO_OFFSET.R1, planck.R1);
  f(CAMERA_INFO_OFFSET.B, planck.B);
  f(CAMERA_INFO_OFFSET.F, planck.F);
  f(CAMERA_INFO_OFFSET.alpha1, atm.alpha1);
  f(CAMERA_INFO_OFFSET.alpha2, atm.alpha2);
  f(CAMERA_INFO_OFFSET.beta1, atm.beta1);
  f(CAMERA_INFO_OFFSET.beta2, atm.beta2);
  f(CAMERA_INFO_OFFSET.x, atm.x);
  cdv.setInt32(CAMERA_INFO_OFFSET.O, planck.O, le);
  f(CAMERA_INFO_OFFSET.R2, planck.R2);
  const model = opts.cameraModel ?? 'Synthetic';
  for (let i = 0; i < Math.min(model.length, 31); i++) camRec[CAMERA_INFO_OFFSET.cameraModel + i] = model.charCodeAt(i);

  // FFF container: header + record directory + record bodies
  const records = [
    { type: FFF_RECORD.CAMERA_INFO, body: camRec },
    { type: FFF_RECORD.RAW_DATA, body: rawRec },
  ];
  const dirOffset = FFF_HEADER_SIZE;
  let cursor = dirOffset + records.length * FFF_RECORD_SIZE;
  const fff = new Uint8Array(cursor + records.reduce((s, r) => s + r.body.length, 0));
  const dv = new DataView(fff.buffer);
  fff.set([0x46, 0x46, 0x46, 0x00], 0);
  for (let i = 0; i < 12; i++) fff[4 + i] = 'ThermoLens-fixt'.charCodeAt(i) || 0;
  dv.setUint32(0x14, 100, le);
  dv.setUint32(0x18, dirOffset, le);
  dv.setUint32(0x1c, records.length, le);
  records.forEach((r, i) => {
    const p = dirOffset + i * FFF_RECORD_SIZE;
    dv.setUint16(p, r.type, le);
    dv.setUint32(p + 12, cursor, le);
    dv.setUint32(p + 16, r.body.length, le);
    fff.set(r.body, cursor);
    cursor += r.body.length;
  });

  // JPEG: SOI, APP1 FLIR chunks, EOI
  const chunk = Math.max(1024, Math.min(opts.chunkSize ?? 60000, 65000));
  const nChunks = Math.ceil(fff.length / chunk);
  const parts: Uint8Array[] = [new Uint8Array([0xff, 0xd8])];
  for (let c = 0; c < nChunks; c++) {
    const body = fff.subarray(c * chunk, Math.min((c + 1) * chunk, fff.length));
    const seg = new Uint8Array(4 + 8 + body.length);
    seg[0] = 0xff;
    seg[1] = 0xe1;
    const len = 2 + 8 + body.length;
    seg[2] = len >> 8;
    seg[3] = len & 0xff;
    seg.set([0x46, 0x4c, 0x49, 0x52, 0x00, 0x01, c, nChunks - 1], 4);
    seg.set(body, 12);
    parts.push(seg);
  }
  parts.push(new Uint8Array([0xff, 0xd9]));
  const total = parts.reduce((s, p) => s + p.length, 0);
  const jpg = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    jpg.set(p, o);
    o += p.length;
  }
  return jpg;
}
