import { looksLikeFlirJpeg, parseFlirJpeg } from './flir';
import { decodeGrayPng, isPng } from './png';
import { decodeTiff16, isTiff } from './tiff';
import { DEFAULT_PARAMS, type Calibration, type ThermalFrame } from './types';

export class ImportError extends Error {
  constructor(readonly code: 'notRadiometric' | 'unsupported' | 'corrupt', message: string) {
    super(message);
  }
}

/** Default calibration applied to raw (non-FLIR) frames until the user picks one. */
export const DEFAULT_RAW_CALIBRATION: Calibration = { kind: 'tlinear', kelvinPerCount: 0.04, offsetK: 0 };

export const RAW_CALIBRATION_PRESETS: { id: string; kelvinPerCount: number }[] = [
  { id: 'k001', kelvinPerCount: 0.01 },
  { id: 'k004', kelvinPerCount: 0.04 },
  { id: 'k01', kelvinPerCount: 0.1 },
];

/** Decode bytes of any supported thermal file into a frame. */
export function importThermalBytes(bytes: Uint8Array, name: string): ThermalFrame {
  try {
    if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) {
      if (!looksLikeFlirJpeg(bytes)) throw new ImportError('notRadiometric', 'This JPEG has no FLIR radiometric data');
      const p = parseFlirJpeg(bytes);
      return {
        name,
        width: p.width,
        height: p.height,
        raw: p.raw,
        calibration: p.calibration,
        params: p.params,
        source: 'flir',
        cameraModel: p.cameraModel,
      };
    }
    if (isPng(bytes)) {
      const d = decodeGrayPng(bytes);
      return { name, width: d.width, height: d.height, raw: d.samples, calibration: DEFAULT_RAW_CALIBRATION, params: { ...DEFAULT_PARAMS }, source: 'raw' };
    }
    if (isTiff(bytes)) {
      const d = decodeTiff16(bytes);
      return { name, width: d.width, height: d.height, raw: d.samples, calibration: DEFAULT_RAW_CALIBRATION, params: { ...DEFAULT_PARAMS }, source: 'raw' };
    }
  } catch (e) {
    if (e instanceof ImportError) throw e;
    throw new ImportError('corrupt', e instanceof Error ? e.message : 'Could not decode file');
  }
  throw new ImportError('unsupported', 'Unsupported file type');
}
