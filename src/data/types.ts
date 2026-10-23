import type { Measurement } from '@/core/measure';
import type { PaletteId } from '@/core/palettes';
import type { Calibration, FrameSource, ObjectParams } from '@/core/types';

export interface AnalysisRecord {
  id: string;
  name: string;
  createdAt: number;
  source: FrameSource;
  /** Demo scene id when `source === 'demo'`; demos are rebuilt instead of stored. */
  demoId?: string;
  width: number;
  height: number;
  params: ObjectParams;
  calibration: Calibration;
  cameraModel?: string;
  palette: PaletteId;
  measurements: Measurement[];
  minC: number;
  maxC: number;
  thumb: string;
}

export interface AnalysisStore {
  list(): Promise<AnalysisRecord[]>;
  save(rec: AnalysisRecord, raw: Uint16Array | null): Promise<void>;
  getRaw(id: string): Promise<Uint16Array | null>;
  remove(id: string): Promise<void>;
}

export interface KvStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
