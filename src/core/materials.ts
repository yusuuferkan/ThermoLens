export interface Material {
  id: string;
  /** Approximate long-wave emissivity. Typical textbook values; surfaces vary. */
  emissivity: number;
}

export const MATERIALS: Material[] = [
  { id: 'skin', emissivity: 0.98 },
  { id: 'water', emissivity: 0.96 },
  { id: 'blackTape', emissivity: 0.95 },
  { id: 'paint', emissivity: 0.94 },
  { id: 'concrete', emissivity: 0.94 },
  { id: 'brick', emissivity: 0.93 },
  { id: 'plastic', emissivity: 0.93 },
  { id: 'glass', emissivity: 0.92 },
  { id: 'wood', emissivity: 0.9 },
  { id: 'oxSteel', emissivity: 0.79 },
  { id: 'oxCopper', emissivity: 0.65 },
  { id: 'oxAluminium', emissivity: 0.3 },
  { id: 'polSteel', emissivity: 0.16 },
  { id: 'polAluminium', emissivity: 0.05 },
  { id: 'polCopper', emissivity: 0.03 },
];

export function nearestMaterial(e: number): Material | undefined {
  return MATERIALS.find((m) => Math.abs(m.emissivity - e) < 0.0051);
}
