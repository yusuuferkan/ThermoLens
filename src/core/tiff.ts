export function isTiff(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  const le = bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0;
  const be = bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0 && bytes[3] === 0x2a;
  return le || be;
}

export interface DecodedTiff {
  width: number;
  height: number;
  samples: Uint16Array;
}

/** Decode an uncompressed, single-channel 16-bit TIFF (strip layout). */
export function decodeTiff16(bytes: Uint8Array): DecodedTiff {
  if (!isTiff(bytes)) throw new Error('Not a TIFF');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const le = bytes[0] === 0x49;
  const ifd = dv.getUint32(4, le);
  const n = dv.getUint16(ifd, le);
  const tags = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    const tag = dv.getUint16(e, le);
    const type = dv.getUint16(e + 2, le);
    const count = dv.getUint32(e + 4, le);
    const size = type === 3 ? 2 : type === 4 ? 4 : 0;
    if (!size) continue;
    const base = size * count <= 4 ? e + 8 : dv.getUint32(e + 8, le);
    const vals: number[] = [];
    for (let k = 0; k < count; k++) {
      vals.push(type === 3 ? dv.getUint16(base + k * 2, le) : dv.getUint32(base + k * 4, le));
    }
    tags.set(tag, vals);
  }
  const one = (t: number, d?: number) => tags.get(t)?.[0] ?? d;
  const width = one(256)!;
  const height = one(257)!;
  const bits = one(258, 8);
  const comp = one(259, 1);
  const spp = one(277, 1);
  if (bits !== 16 || comp !== 1 || spp !== 1) throw new Error('Only uncompressed single-channel 16-bit TIFF is supported');
  const offsets = tags.get(273);
  const counts = tags.get(279);
  if (!width || !height || !offsets) throw new Error('Malformed TIFF');
  const samples = new Uint16Array(width * height);
  let s = 0;
  for (let i = 0; i < offsets.length && s < samples.length; i++) {
    const len = counts?.[i] ?? samples.length * 2;
    for (let b = 0; b + 1 < len && s < samples.length; b += 2) {
      samples[s++] = dv.getUint16(offsets[i] + b, le);
    }
  }
  return { width, height, samples };
}

/** Minimal uncompressed 16-bit greyscale TIFF writer (used in tests and fixtures). */
export function encodeTiff16(width: number, height: number, samples: Uint16Array, littleEndian = true): Uint8Array {
  const entries = 8;
  const ifdOff = 8;
  const dataOff = ifdOff + 2 + entries * 12 + 4;
  const out = new Uint8Array(dataOff + samples.length * 2);
  const dv = new DataView(out.buffer);
  const le = littleEndian;
  out[0] = out[1] = le ? 0x49 : 0x4d;
  dv.setUint16(2, 42, le);
  dv.setUint32(4, ifdOff, le);
  dv.setUint16(ifdOff, entries, le);
  const put = (i: number, tag: number, type: number, val: number) => {
    const e = ifdOff + 2 + i * 12;
    dv.setUint16(e, tag, le);
    dv.setUint16(e + 2, type, le);
    dv.setUint32(e + 4, 1, le);
    if (type === 3) dv.setUint16(e + 8, val, le);
    else dv.setUint32(e + 8, val, le);
  };
  put(0, 256, 4, width);
  put(1, 257, 4, height);
  put(2, 258, 3, 16);
  put(3, 259, 3, 1);
  put(4, 262, 3, 1);
  put(5, 273, 4, dataOff);
  put(6, 277, 3, 1);
  put(7, 279, 4, samples.length * 2);
  for (let i = 0; i < samples.length; i++) dv.setUint16(dataOff + i * 2, samples[i], le);
  return out;
}
