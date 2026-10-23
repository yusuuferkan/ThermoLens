import {
  bandRadiance,
  planckSpectralRadiance,
  stefanBoltzmannExitance,
  wienPeakWavelength,
  STEFAN_BOLTZMANN,
} from '../src/core/planck';

describe('planck', () => {
  it('Wien peak at 300 K is about 9.66 um', () => {
    expect(wienPeakWavelength(300) * 1e6).toBeCloseTo(9.659, 2);
  });

  it('Wien peak at the Sun surface (5772 K) is about 502 nm', () => {
    expect(wienPeakWavelength(5772) * 1e9).toBeCloseTo(502, 0);
  });

  it('spectral radiance peaks at the Wien wavelength', () => {
    const T = 310;
    const peak = wienPeakWavelength(T);
    const at = planckSpectralRadiance(peak, T);
    expect(at).toBeGreaterThan(planckSpectralRadiance(peak * 0.9, T));
    expect(at).toBeGreaterThan(planckSpectralRadiance(peak * 1.1, T));
  });

  it('full-spectrum integral equals sigma T^4 / pi', () => {
    const T = 300;
    // integrate 1 um .. 1 mm on a log-ish split to cover the tails
    const total =
      bandRadiance(T, 0.5e-6, 5e-6, 400) + bandRadiance(T, 5e-6, 50e-6, 2000) + bandRadiance(T, 50e-6, 5e-3, 20000);
    const expected = (STEFAN_BOLTZMANN * T ** 4) / Math.PI;
    expect(Math.abs(total - expected) / expected).toBeLessThan(0.005);
  });

  it('Stefan-Boltzmann exitance at 300 K is about 459.3 W/m2', () => {
    expect(stefanBoltzmannExitance(300)).toBeCloseTo(459.3, 1);
    expect(stefanBoltzmannExitance(300, 0.5)).toBeCloseTo(229.65, 1);
  });

  it('band radiance rises monotonically with temperature', () => {
    expect(bandRadiance(310, 7.5e-6, 14e-6)).toBeGreaterThan(bandRadiance(300, 7.5e-6, 14e-6));
  });
});
