export type TempUnit = 'C' | 'F';

export const celsiusToFahrenheit = (c: number) => (c * 9) / 5 + 32;
export const fahrenheitToCelsius = (f: number) => ((f - 32) * 5) / 9;

/** Convert a Celsius value into the display unit (no rounding). */
export function toUnit(c: number, unit: TempUnit): number {
  return unit === 'F' ? celsiusToFahrenheit(c) : c;
}

export function fromUnit(v: number, unit: TempUnit): number {
  return unit === 'F' ? fahrenheitToCelsius(v) : v;
}

export function formatTemp(c: number, unit: TempUnit, digits = 1, withUnit = true): string {
  if (!Number.isFinite(c)) return '--';
  const v = toUnit(c, unit).toFixed(digits);
  return withUnit ? `${v}°${unit}` : v;
}

/** Temperature difference (delta) conversion: no +32 offset. */
export function formatDelta(deltaC: number, unit: TempUnit, digits = 1): string {
  if (!Number.isFinite(deltaC)) return '--';
  const v = unit === 'F' ? (deltaC * 9) / 5 : deltaC;
  return `${v.toFixed(digits)}°${unit}`;
}
