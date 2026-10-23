import { create } from 'zustand';

import type { Measurement } from '@/core/measure';
import type { PaletteId } from '@/core/palettes';
import { computeTemperatureMap } from '@/core/radiometry';
import type { Calibration, ObjectParams, Point, TemperatureMap, ThermalFrame } from '@/core/types';

export type Tool = 'spot' | 'box' | 'line';

interface SessionState {
  frame: ThermalFrame | null;
  /** Parameters as read from the file, for the reset button. */
  originalParams: ObjectParams | null;
  map: TemperatureMap | null;
  palette: PaletteId;
  autoRange: boolean;
  level: number;
  span: number;
  hotspotOn: boolean;
  hotspotC: number;
  showMarkers: boolean;
  cursor: Point | null;
  tool: Tool;
  measurements: Measurement[];
  savedId: string | null;
  demoId: string | null;
  loadFrame: (f: ThermalFrame, opts?: { demoId?: string; palette?: PaletteId; measurements?: Measurement[]; savedId?: string }) => void;
  setParams: (p: Partial<ObjectParams>) => void;
  resetParams: () => void;
  setCalibration: (c: Calibration) => void;
  setPalette: (p: PaletteId) => void;
  setAutoRange: (on: boolean) => void;
  setLevel: (v: number) => void;
  setSpan: (v: number) => void;
  setHotspotOn: (on: boolean) => void;
  setHotspotC: (v: number) => void;
  setShowMarkers: (on: boolean) => void;
  setCursor: (p: Point | null) => void;
  setTool: (t: Tool) => void;
  addMeasurement: (m: Measurement) => void;
  removeMeasurement: (id: string) => void;
  clearMeasurements: () => void;
  setSavedId: (id: string | null) => void;
}

export const useSession = create<SessionState>()((set, get) => ({
  frame: null,
  originalParams: null,
  map: null,
  palette: 'ironbow',
  autoRange: true,
  level: 25,
  span: 20,
  hotspotOn: false,
  hotspotC: 40,
  showMarkers: true,
  cursor: null,
  tool: 'spot',
  measurements: [],
  savedId: null,
  demoId: null,
  loadFrame: (frame, opts) => {
    const map = computeTemperatureMap(frame);
    set({
      frame,
      originalParams: { ...frame.params },
      map,
      palette: opts?.palette ?? 'ironbow',
      autoRange: true,
      level: (map.min + map.max) / 2,
      span: Math.max(map.max - map.min, 1),
      hotspotOn: false,
      hotspotC: Math.round(map.min + (map.max - map.min) * 0.7),
      cursor: { x: map.maxAt.x + 0.5, y: map.maxAt.y + 0.5 },
      measurements: opts?.measurements ?? [],
      savedId: opts?.savedId ?? null,
      demoId: opts?.demoId ?? null,
    });
  },
  setParams: (p) => {
    const { frame } = get();
    if (!frame) return;
    const next = { ...frame, params: { ...frame.params, ...p } };
    set({ frame: next, map: computeTemperatureMap(next), savedId: null });
  },
  resetParams: () => {
    const { frame, originalParams } = get();
    if (!frame || !originalParams) return;
    const next = { ...frame, params: { ...originalParams } };
    set({ frame: next, map: computeTemperatureMap(next) });
  },
  setCalibration: (calibration) => {
    const { frame } = get();
    if (!frame) return;
    const next = { ...frame, calibration };
    set({ frame: next, map: computeTemperatureMap(next), savedId: null });
  },
  setPalette: (palette) => set({ palette }),
  setAutoRange: (autoRange) => {
    const { map, level, span } = get();
    if (!autoRange && map) {
      set({ autoRange, level: (map.min + map.max) / 2, span: Math.max(map.max - map.min, 1) });
    } else set({ autoRange, level, span });
  },
  setLevel: (level) => set({ level }),
  setSpan: (span) => set({ span: Math.max(span, 0.5) }),
  setHotspotOn: (hotspotOn) => set({ hotspotOn }),
  setHotspotC: (hotspotC) => set({ hotspotC }),
  setShowMarkers: (showMarkers) => set({ showMarkers }),
  setCursor: (cursor) => set({ cursor }),
  setTool: (tool) => set({ tool }),
  addMeasurement: (m) => set((s) => ({ measurements: [...s.measurements, m].slice(-12) })),
  removeMeasurement: (id) => set((s) => ({ measurements: s.measurements.filter((m) => m.id !== id) })),
  clearMeasurements: () => set({ measurements: [] }),
  setSavedId: (savedId) => set({ savedId }),
}));
