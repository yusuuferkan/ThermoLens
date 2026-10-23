import { analysisStore } from '@/data/db';
import type { AnalysisRecord } from '@/data/types';
import { renderDataUri } from '@/lib/useThermalImage';
import { useSession } from '@/store/session';

function makeId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Persist the current session (image, parameters, measurements) to history. */
export async function saveCurrentAnalysis(): Promise<string | null> {
  const s = useSession.getState();
  if (!s.frame || !s.map) return null;
  const { frame, map } = s;
  const [lo, hi] = s.autoRange ? [map.min, map.max] : [s.level - s.span / 2, s.level + s.span / 2];
  const id = s.savedId ?? makeId();
  const rec: AnalysisRecord = {
    id,
    name: frame.name,
    createdAt: Date.now(),
    source: frame.source,
    demoId: s.demoId ?? undefined,
    width: frame.width,
    height: frame.height,
    params: frame.params,
    calibration: frame.calibration,
    cameraModel: frame.cameraModel,
    palette: s.palette,
    measurements: s.measurements,
    minC: map.min,
    maxC: map.max,
    thumb: renderDataUri(map, lo, hi, s.palette, null),
  };
  await analysisStore.save(rec, frame.source === 'demo' ? null : frame.raw);
  s.setSavedId(id);
  return id;
}
