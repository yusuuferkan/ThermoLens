import { paletteLut, type PaletteId } from './palettes';

export interface ColorizeOptions {
  /** Temperature mapped to the cold end of the palette (deg C). */
  lo: number;
  /** Temperature mapped to the hot end of the palette (deg C). */
  hi: number;
  palette: PaletteId;
  /** If set, pixels at or above this temperature (deg C) get a highlight overlay. */
  hotspotC?: number | null;
}

const HOT_RGB = [255, 45, 120];

/** Map a temperature field to an RGBA8 buffer. */
export function colorize(temps: Float32Array, width: number, height: number, opts: ColorizeOptions): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  const lut = paletteLut(opts.palette);
  const span = Math.max(opts.hi - opts.lo, 1e-6);
  const inv = 255 / span;
  const th = opts.hotspotC;
  const hasHot = th !== null && th !== undefined && Number.isFinite(th);
  for (let i = 0; i < temps.length; i++) {
    const t = temps[i];
    const o = i * 4;
    if (!Number.isFinite(t)) {
      out[o + 3] = 255;
      continue;
    }
    let idx = Math.round((t - opts.lo) * inv);
    idx = idx < 0 ? 0 : idx > 255 ? 255 : idx;
    let r = lut[idx * 3];
    let g = lut[idx * 3 + 1];
    let b = lut[idx * 3 + 2];
    if (hasHot) {
      if (t >= (th as number)) {
        r = r * 0.35 + HOT_RGB[0] * 0.65;
        g = g * 0.35 + HOT_RGB[1] * 0.65;
        b = b * 0.35 + HOT_RGB[2] * 0.65;
      } else {
        const l = (r * 0.3 + g * 0.59 + b * 0.11) * 0.55;
        r = g = b = l;
      }
    }
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = b;
    out[o + 3] = 255;
  }
  return out;
}
