/** Planck calibration constants as stored by FLIR cameras (CameraInfo record). */
export interface PlanckConstants {
  R1: number;
  R2: number;
  B: number;
  F: number;
  O: number;
}

/** Atmospheric transmission model coefficients (FLIR defaults). */
export interface AtmosphereCoefficients {
  alpha1: number;
  alpha2: number;
  beta1: number;
  beta2: number;
  x: number;
}

/** Scene / object parameters that influence the temperature conversion. */
export interface ObjectParams {
  emissivity: number;
  reflectedTempC: number;
  atmosphericTempC: number;
  distanceM: number;
  humidityPct: number;
  windowTempC: number;
  windowTransmission: number;
}

export type Calibration =
  | { kind: 'planck'; planck: PlanckConstants; atmosphere?: AtmosphereCoefficients }
  | { kind: 'tlinear'; kelvinPerCount: number; offsetK: number };

export type FrameSource = 'flir' | 'raw' | 'demo';

export interface ThermalFrame {
  name: string;
  width: number;
  height: number;
  raw: Uint16Array;
  calibration: Calibration;
  params: ObjectParams;
  source: FrameSource;
  cameraModel?: string;
}

export interface TemperatureMap {
  width: number;
  height: number;
  /** Temperatures in degrees Celsius, row-major. */
  data: Float32Array;
  min: number;
  max: number;
  mean: number;
  minAt: Point;
  maxAt: Point;
}

export interface Point {
  x: number;
  y: number;
}

export const DEFAULT_PARAMS: ObjectParams = {
  emissivity: 0.95,
  reflectedTempC: 20,
  atmosphericTempC: 20,
  distanceM: 1,
  humidityPct: 50,
  windowTempC: 20,
  windowTransmission: 1,
};

export const DEFAULT_ATMOSPHERE: AtmosphereCoefficients = {
  alpha1: 0.006569,
  alpha2: 0.01262,
  beta1: -0.002276,
  beta2: -0.00667,
  x: 1.9,
};
