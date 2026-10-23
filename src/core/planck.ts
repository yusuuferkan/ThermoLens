/** Physical constants (SI, CODATA 2018 exact values) and Planck-law helpers. */
export const PLANCK_H = 6.62607015e-34; // J s
export const LIGHT_C = 299792458; // m/s
export const BOLTZMANN_K = 1.380649e-23; // J/K
export const STEFAN_BOLTZMANN = 5.670374419e-8; // W m^-2 K^-4
/** Wien displacement constant b in lambda_max = b / T. */
export const WIEN_B = 2.897771955e-3; // m K

export const KELVIN_OFFSET = 273.15;

/**
 * Spectral radiance of a black body, W / (m^2 sr m):
 *   B(lambda, T) = 2 h c^2 / lambda^5 / (exp(h c / (lambda k T)) - 1)
 * @param wavelengthM wavelength in metres
 * @param temperatureK temperature in kelvin
 */
export function planckSpectralRadiance(wavelengthM: number, temperatureK: number): number {
  if (wavelengthM <= 0 || temperatureK <= 0) return 0;
  const a = 2 * PLANCK_H * LIGHT_C * LIGHT_C;
  const x = (PLANCK_H * LIGHT_C) / (wavelengthM * BOLTZMANN_K * temperatureK);
  return a / Math.pow(wavelengthM, 5) / Math.expm1(x);
}

/**
 * Band radiance W / (m^2 sr) integrated over [lambda1, lambda2] (metres) with
 * composite Simpson's rule.
 */
export function bandRadiance(
  temperatureK: number,
  lambda1M: number,
  lambda2M: number,
  steps = 64,
): number {
  const n = steps % 2 === 0 ? steps : steps + 1;
  const h = (lambda2M - lambda1M) / n;
  let sum = planckSpectralRadiance(lambda1M, temperatureK) + planckSpectralRadiance(lambda2M, temperatureK);
  for (let i = 1; i < n; i++) {
    sum += (i % 2 === 0 ? 2 : 4) * planckSpectralRadiance(lambda1M + i * h, temperatureK);
  }
  return (sum * h) / 3;
}

/** Wavelength of peak spectral radiance (Wien's displacement law), metres. */
export function wienPeakWavelength(temperatureK: number): number {
  return WIEN_B / temperatureK;
}

/** Radiant exitance of a grey body, W/m^2: epsilon sigma T^4. */
export function stefanBoltzmannExitance(temperatureK: number, emissivity = 1): number {
  return emissivity * STEFAN_BOLTZMANN * Math.pow(temperatureK, 4);
}

/** Common long-wave infrared band used by uncooled microbolometers. */
export const LWIR_BAND_M: [number, number] = [7.5e-6, 14e-6];

export const celsiusToKelvin = (c: number) => c + KELVIN_OFFSET;
export const kelvinToCelsius = (k: number) => k - KELVIN_OFFSET;
