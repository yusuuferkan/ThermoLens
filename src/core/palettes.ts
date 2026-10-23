export type PaletteId = 'ironbow' | 'rainbow' | 'whiteHot' | 'blackHot' | 'arctic';
export type RGB = [number, number, number];

export interface Palette {
  id: PaletteId;
  /** Evenly spaced colour stops from cold (0) to hot (1). */
  stops: RGB[];
}

export const PALETTES: Record<PaletteId, Palette> = {
  ironbow: {
    id: 'ironbow',
    stops: [[0, 0, 0], [20, 4, 70], [75, 0, 130], [140, 20, 120], [200, 50, 70], [235, 100, 20], [250, 170, 20], [255, 235, 110], [255, 255, 255]],
  },
  rainbow: {
    id: 'rainbow',
    stops: [[20, 20, 140], [0, 90, 255], [0, 210, 220], [20, 200, 80], [200, 230, 20], [255, 170, 0], [255, 60, 0], [200, 0, 20]],
  },
  whiteHot: { id: 'whiteHot', stops: [[0, 0, 0], [255, 255, 255]] },
  blackHot: { id: 'blackHot', stops: [[255, 255, 255], [0, 0, 0]] },
  arctic: {
    id: 'arctic',
    stops: [[0, 10, 40], [10, 50, 130], [30, 130, 210], [150, 220, 245], [250, 250, 250], [255, 205, 100], [255, 120, 20], [190, 30, 20]],
  },
};

export const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];

const cache = new Map<PaletteId, Uint8Array>();

/** 256-entry RGB lookup table (768 bytes). */
export function paletteLut(id: PaletteId): Uint8Array {
  const hit = cache.get(id);
  if (hit) return hit;
  const { stops } = PALETTES[id];
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const f = (i / 255) * (stops.length - 1);
    const k = Math.min(Math.floor(f), stops.length - 2);
    const t = f - k;
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = Math.round(stops[k][c] + (stops[k + 1][c] - stops[k][c]) * t);
  }
  cache.set(id, lut);
  return lut;
}

export function paletteColor(id: PaletteId, t: number): RGB {
  const lut = paletteLut(id);
  const i = Math.min(255, Math.max(0, Math.round(t * 255))) * 3;
  return [lut[i], lut[i + 1], lut[i + 2]];
}

export const rgbCss = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;
