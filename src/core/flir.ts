import { decodeGrayPng, isPng } from './png';
import { DEFAULT_PARAMS, type Calibration, type ObjectParams, type PlanckConstants } from './types';
import { KELVIN_OFFSET } from './planck';

export interface ParsedFlir {
  width: number;
  height: number;
  raw: Uint16Array;
  calibration: Calibration;
  params: ObjectParams;
  cameraModel?: string;
  encoding: 'png' | 'raw';
  /** True if 16-bit samples had to be byte-swapped (smoothness heuristic). */
  byteSwapped: boolean;
}

export class FlirParseError extends Error {}

/** Record type ids inside the FFF record directory. */
export const FFF_RECORD = { RAW_DATA: 0x01, CAMERA_INFO: 0x20 } as const;

/** Byte offsets inside the CameraInfo record (community-documented FFF layout). */
export const CAMERA_INFO_OFFSET = {
  emissivity: 0x20,
  objectDistance: 0x24,
  reflectedTemp: 0x28,
  atmosphericTemp: 0x2c,
  windowTemp: 0x30,
  windowTransmission: 0x34,
  humidity: 0x3c,
  R1: 0x58,
  B: 0x5c,
  F: 0x60,
  alpha1: 0x90,
  alpha2: 0x94,
  beta1: 0x98,
  beta2: 0x9c,
  x: 0xa0,
  cameraModel: 0xd4,
  O: 0x308,
  R2: 0x30c,
} as const;

export const FFF_HEADER_SIZE = 64;
export const FFF_RECORD_SIZE = 32;
export const RAW_HEADER_SIZE = 32;

/** Quick check whether a byte array looks like a JPEG that carries FLIR APP1 segments. */
export function looksLikeFlirJpeg(bytes: Uint8Array): boolean {
  return findFlirSegments(bytes).length > 0;
}

interface Segment {
  index: number;
  order: number;
  data: Uint8Array;
}

function findFlirSegments(bytes: Uint8Array): Segment[] {
  const out: Segment[] = [];
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return out;
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = bytes[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2;
      continue;
    }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2) break;
    const start = i + 4;
    const end = Math.min(i + 2 + len, bytes.length);
    if (
      marker === 0xe1 &&
      end - start > 8 &&
      bytes[start] === 0x46 && // F
      bytes[start + 1] === 0x4c && // L
      bytes[start + 2] === 0x49 && // I
      bytes[start + 3] === 0x52 && // R
      bytes[start + 4] === 0x00
    ) {
      out.push({ index: bytes[start + 6], order: out.length, data: bytes.subarray(start + 8, end) });
    }
    i = i + 2 + len;
  }
  return out;
}

/** Concatenate the FLIR APP1 payloads (sorted by chunk index) into one FFF buffer. */
export function reassembleFff(bytes: Uint8Array): Uint8Array {
  const segs = findFlirSegments(bytes);
  if (!segs.length) throw new FlirParseError('No FLIR APP1 segments found');
  segs.sort((a, b) => a.index - b.index || a.order - b.order);
  let total = 0;
  for (const s of segs) total += s.data.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const s of segs) {
    out.set(s.data, o);
    o += s.data.length;
  }
  return out;
}

interface FffRecord {
  type: number;
  offset: number;
  length: number;
}

function swap16(v: number): number {
  return ((v & 0xff) << 8) | (v >> 8);
}

function roughness(a: Uint16Array, width: number, swapped: boolean): number {
  let s = 0;
  const step = Math.max(1, Math.floor(a.length / 20000));
  for (let i = 1; i < a.length; i += step) {
    if (i % width === 0) continue;
    let p = a[i - 1];
    let q = a[i];
    if (swapped) {
      p = swap16(p);
      q = swap16(q);
    }
    s += Math.abs(p - q);
  }
  return s;
}

export function parseFff(fff: Uint8Array): ParsedFlir {
  if (fff.length < FFF_HEADER_SIZE) throw new FlirParseError('FFF buffer too short');
  const magic = String.fromCharCode(fff[0], fff[1], fff[2]);
  if ((magic !== 'FFF' && magic !== 'AFF') || fff[3] !== 0) throw new FlirParseError('Missing FFF header');
  const dv = new DataView(fff.buffer, fff.byteOffset, fff.byteLength);
  const ver = dv.getUint32(0x14, true);
  const le = ver > 0 && ver < 0x10000;
  const dirOffset = dv.getUint32(0x18, le);
  const dirCount = dv.getUint32(0x1c, le);
  if (dirCount > 1024 || dirOffset + dirCount * FFF_RECORD_SIZE > fff.length) throw new FlirParseError('Bad FFF record directory');
  const records: FffRecord[] = [];
  for (let i = 0; i < dirCount; i++) {
    const p = dirOffset + i * FFF_RECORD_SIZE;
    const type = dv.getUint16(p, le);
    const offset = dv.getUint32(p + 12, le);
    const length = dv.getUint32(p + 16, le);
    if (type !== 0 && offset + length <= fff.length) records.push({ type, offset, length });
  }
  const rawRec = records.find((r) => r.type === FFF_RECORD.RAW_DATA);
  const camRec = records.find((r) => r.type === FFF_RECORD.CAMERA_INFO);
  if (!rawRec) throw new FlirParseError('No raw thermal image record');
  if (!camRec) throw new FlirParseError('No camera info record');

  // --- camera info ---
  const cam = new DataView(fff.buffer, fff.byteOffset + camRec.offset, camRec.length);
  if (camRec.length < CAMERA_INFO_OFFSET.R2 + 4) throw new FlirParseError('Camera info record too short');
  const f32 = (o: number) => cam.getFloat32(o, le);
  const planck: PlanckConstants = {
    R1: f32(CAMERA_INFO_OFFSET.R1),
    R2: f32(CAMERA_INFO_OFFSET.R2),
    B: f32(CAMERA_INFO_OFFSET.B),
    F: f32(CAMERA_INFO_OFFSET.F),
    O: cam.getInt32(CAMERA_INFO_OFFSET.O, le),
  };
  if (![planck.R1, planck.R2, planck.B, planck.F].every((v) => Number.isFinite(v) && v !== 0)) {
    throw new FlirParseError('Invalid Planck constants');
  }
  const sane = (v: number, lo: number, hi: number, d: number) => (Number.isFinite(v) && v >= lo && v <= hi ? v : d);
  const humRaw = f32(CAMERA_INFO_OFFSET.humidity);
  const humidity = sane(humRaw <= 1.5 ? humRaw * 100 : humRaw, 0, 100, DEFAULT_PARAMS.humidityPct);
  const params: ObjectParams = {
    emissivity: sane(f32(CAMERA_INFO_OFFSET.emissivity), 0.01, 1, DEFAULT_PARAMS.emissivity),
    distanceM: sane(f32(CAMERA_INFO_OFFSET.objectDistance), 0, 10000, DEFAULT_PARAMS.distanceM),
    reflectedTempC: sane(f32(CAMERA_INFO_OFFSET.reflectedTemp) - KELVIN_OFFSET, -100, 1000, DEFAULT_PARAMS.reflectedTempC),
    atmosphericTempC: sane(f32(CAMERA_INFO_OFFSET.atmosphericTemp) - KELVIN_OFFSET, -100, 1000, DEFAULT_PARAMS.atmosphericTempC),
    windowTempC: sane(f32(CAMERA_INFO_OFFSET.windowTemp) - KELVIN_OFFSET, -100, 1000, DEFAULT_PARAMS.windowTempC),
    windowTransmission: sane(f32(CAMERA_INFO_OFFSET.windowTransmission), 0.01, 1, DEFAULT_PARAMS.windowTransmission),
    humidityPct: humidity,
  };
  const atmosphere = {
    alpha1: f32(CAMERA_INFO_OFFSET.alpha1),
    alpha2: f32(CAMERA_INFO_OFFSET.alpha2),
    beta1: f32(CAMERA_INFO_OFFSET.beta1),
    beta2: f32(CAMERA_INFO_OFFSET.beta2),
    x: f32(CAMERA_INFO_OFFSET.x),
  };
  const atmOk = Object.values(atmosphere).every((v) => Number.isFinite(v) && v !== 0);
  let cameraModel: string | undefined;
  if (camRec.length >= CAMERA_INFO_OFFSET.cameraModel + 32) {
    let s = '';
    for (let i = 0; i < 32; i++) {
      const c = cam.getUint8(CAMERA_INFO_OFFSET.cameraModel + i);
      if (c === 0) break;
      if (c >= 32 && c < 127) s += String.fromCharCode(c);
    }
    cameraModel = s.trim() || undefined;
  }

  // --- raw data ---
  const rd = new DataView(fff.buffer, fff.byteOffset + rawRec.offset, rawRec.length);
  if (rawRec.length <= RAW_HEADER_SIZE) throw new FlirParseError('Raw record too short');
  let rle = le;
  let width = rd.getUint16(2, rle);
  let height = rd.getUint16(4, rle);
  if (width === 0 || width > 8192 || height === 0 || height > 8192) {
    rle = !rle;
    width = rd.getUint16(2, rle);
    height = rd.getUint16(4, rle);
  }
  const payload = fff.subarray(rawRec.offset + RAW_HEADER_SIZE, rawRec.offset + rawRec.length);
  let samples: Uint16Array;
  let encoding: 'png' | 'raw';
  if (isPng(payload)) {
    const png = decodeGrayPng(payload);
    width = png.width;
    height = png.height;
    samples = png.samples; // values already big-endian decoded
    encoding = 'png';
  } else {
    if (width * height * 2 > payload.length) throw new FlirParseError('Raw payload smaller than width*height');
    samples = new Uint16Array(width * height);
    const pdv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    for (let i = 0; i < samples.length; i++) samples[i] = pdv.getUint16(i * 2, true);
    encoding = 'raw';
  }
  // FLIR files are inconsistent about 16-bit byte order: choose the smoother interpretation.
  const byteSwapped = roughness(samples, width, true) < roughness(samples, width, false);
  if (byteSwapped) for (let i = 0; i < samples.length; i++) samples[i] = swap16(samples[i]);

  return {
    width,
    height,
    raw: samples,
    calibration: { kind: 'planck', planck, atmosphere: atmOk ? atmosphere : undefined },
    params,
    cameraModel,
    encoding,
    byteSwapped,
  };
}

export function parseFlirJpeg(bytes: Uint8Array): ParsedFlir {
  return parseFff(reassembleFff(bytes));
}
