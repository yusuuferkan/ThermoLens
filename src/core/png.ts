import { unzlibSync, zlibSync } from 'fflate';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array, start: number, end: number): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function isPng(bytes: Uint8Array): boolean {
  return bytes.length > 8 && SIGNATURE.every((b, i) => bytes[i] === b);
}

function buildPng(width: number, height: number, colorType: number, bitDepth: number, scanlines: Uint8Array, level: 0 | 1 | 6): Uint8Array {
  const idat = zlibSync(scanlines, { level });
  const total = 8 + (12 + 13) + (12 + idat.length) + 12;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  out.set(SIGNATURE, 0);
  let p = 8;
  const chunk = (type: string, data: Uint8Array) => {
    dv.setUint32(p, data.length);
    for (let i = 0; i < 4; i++) out[p + 4 + i] = type.charCodeAt(i);
    out.set(data, p + 8);
    dv.setUint32(p + 8 + data.length, crc32(out, p + 4, p + 8 + data.length));
    p += 12 + data.length;
  };
  const ihdr = new Uint8Array(13);
  const idv = new DataView(ihdr.buffer);
  idv.setUint32(0, width);
  idv.setUint32(4, height);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  chunk('IHDR', ihdr);
  chunk('IDAT', idat);
  chunk('IEND', new Uint8Array(0));
  return out;
}

/** Encode 16-bit greyscale samples (big-endian per the PNG spec). */
export function encodeGray16Png(width: number, height: number, samples: Uint16Array): Uint8Array {
  const stride = width * 2 + 1;
  const lines = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    let o = y * stride + 1;
    for (let x = 0; x < width; x++) {
      const v = samples[y * width + x];
      lines[o++] = v >> 8;
      lines[o++] = v & 0xff;
    }
  }
  return buildPng(width, height, 0, 16, lines, 6);
}

/** Encode an RGBA8 image. Light compression keeps the JS cost low for live updates. */
export function encodeRgbaPng(width: number, height: number, rgba: Uint8ClampedArray | Uint8Array, level: 0 | 1 | 6 = 1): Uint8Array {
  const stride = width * 4 + 1;
  const lines = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    lines.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * stride + 1);
  }
  return buildPng(width, height, 6, 8, lines, level);
}

export interface DecodedGray {
  width: number;
  height: number;
  bitDepth: 8 | 16;
  samples: Uint16Array;
}

/** Decode a non-interlaced greyscale PNG (8 or 16 bit). */
export function decodeGrayPng(bytes: Uint8Array): DecodedGray {
  if (!isPng(bytes)) throw new Error('Not a PNG');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = -1, interlace = 0;
  const idats: Uint8Array[] = [];
  while (p + 8 <= bytes.length) {
    const len = dv.getUint32(p);
    const type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
    const data = bytes.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = dv.getUint32(p + 8);
      height = dv.getUint32(p + 12);
      bitDepth = bytes[p + 16];
      colorType = bytes[p + 17];
      interlace = bytes[p + 20];
    } else if (type === 'IDAT') idats.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (colorType !== 0 || (bitDepth !== 16 && bitDepth !== 8)) throw new Error('Only greyscale 8/16-bit PNG is supported');
  if (interlace !== 0) throw new Error('Interlaced PNG is not supported');
  let total = 0;
  for (const c of idats) total += c.length;
  const joined = new Uint8Array(total);
  let o = 0;
  for (const c of idats) {
    joined.set(c, o);
    o += c.length;
  }
  const inflated = unzlibSync(joined);
  const bpp = bitDepth / 8;
  const rowBytes = width * bpp;
  const raw = new Uint8Array(rowBytes * height);
  for (let y = 0; y < height; y++) {
    const ft = inflated[y * (rowBytes + 1)];
    const src = y * (rowBytes + 1) + 1;
    const dst = y * rowBytes;
    for (let i = 0; i < rowBytes; i++) {
      const x = inflated[src + i];
      const a = i >= bpp ? raw[dst + i - bpp] : 0;
      const b = y > 0 ? raw[dst - rowBytes + i] : 0;
      const c = i >= bpp && y > 0 ? raw[dst - rowBytes + i - bpp] : 0;
      let v: number;
      switch (ft) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const pp = a + b - c;
          const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error('Bad PNG filter');
      }
      raw[dst + i] = v & 0xff;
    }
  }
  const samples = new Uint16Array(width * height);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = bitDepth === 16 ? (raw[i * 2] << 8) | raw[i * 2 + 1] : raw[i];
  }
  return { width, height, bitDepth: bitDepth as 8 | 16, samples };
}
