import { useDeferredValue, useMemo } from 'react';

import { bytesToBase64 } from '@/core/base64';
import { colorize } from '@/core/colorize';
import type { PaletteId } from '@/core/palettes';
import { encodeRgbaPng } from '@/core/png';
import type { TemperatureMap } from '@/core/types';

export function renderDataUri(map: TemperatureMap, lo: number, hi: number, palette: PaletteId, hotspotC: number | null): string {
  const rgba = colorize(map.data, map.width, map.height, { lo, hi, palette, hotspotC });
  return `data:image/png;base64,${bytesToBase64(encodeRgbaPng(map.width, map.height, rgba, 1))}`;
}

/**
 * Colourised temperature map as a PNG data URI. Pure JS (no native module), so
 * it behaves identically on iOS, Android and web; deferred so slider drags stay smooth.
 */
export function useThermalImage(map: TemperatureMap | null, lo: number, hi: number, palette: PaletteId, hotspotC: number | null): string | null {
  const dLo = useDeferredValue(lo);
  const dHi = useDeferredValue(hi);
  const dHot = useDeferredValue(hotspotC);
  return useMemo(() => (map ? renderDataUri(map, dLo, dHi, palette, dHot) : null), [map, dLo, dHi, palette, dHot]);
}
