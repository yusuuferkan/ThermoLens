/** Procedural temperature fields used for the bundled demo images. All values in deg C. */

export type SceneId = 'panel' | 'building' | 'kitchen' | 'heatsink';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Field {
  readonly t: Float32Array;
  constructor(readonly w: number, readonly h: number, base: number) {
    this.t = new Float32Array(w * h).fill(base);
  }
  rect(x0: number, y0: number, x1: number, y1: number, temp: number) {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.h, y1); y++)
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.w, x1); x++) this.t[y * this.w + x] = temp;
  }
  gauss(cx: number, cy: number, sx: number, sy: number, delta: number) {
    const rx = Math.ceil(sx * 4), ry = Math.ceil(sy * 4);
    for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(this.h - 1, cy + ry); y++)
      for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(this.w - 1, cx + rx); x++) {
        const d = ((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2;
        this.t[y * this.w + x] += delta * Math.exp(-d / 2);
      }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, temp: number, edge = 0.18) {
    for (let y = Math.max(0, Math.floor(cy - ry - 1)); y <= Math.min(this.h - 1, cy + ry + 1); y++)
      for (let x = Math.max(0, Math.floor(cx - rx - 1)); x <= Math.min(this.w - 1, cx + rx + 1); x++) {
        const d = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2);
        if (d <= 1) {
          // slightly cooler rim gives a soft, realistic edge
          const k = d > 1 - edge ? 1 - ((d - (1 - edge)) / edge) * 0.25 : 1;
          const idx = y * this.w + x;
          this.t[idx] = this.t[idx] + (temp - this.t[idx]) * k;
        }
      }
  }
  blur(passes = 1) {
    const { w, h } = this;
    for (let p = 0; p < passes; p++) {
      const src = this.t.slice();
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          let s = 0, n = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx, yy = y + dy;
              if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
              s += src[yy * w + xx];
              n++;
            }
          this.t[y * w + x] = s / n;
        }
    }
  }
  noise(sigma: number, seed: number) {
    const r = rng(seed);
    for (let i = 0; i < this.t.length; i++) {
      // sum of uniforms approximates a Gaussian
      this.t[i] += (r() + r() + r() + r() - 2) * 1.7 * sigma;
    }
  }
}

export function renderScene(id: SceneId, w = 160, h = 120): Float32Array {
  const s = w / 160;
  const f = new Field(w, h, 21);
  switch (id) {
    case 'panel': {
      f.rect(0, 0, w, h, 20.5);
      f.rect(28 * s, 10 * s, 132 * s, 110 * s, 25);
      for (let col = 0; col < 3; col++)
        for (let row = 0; row < 6; row++) {
          const x = (38 + col * 30) * s, y = (18 + row * 15) * s;
          f.rect(x, y, x + 24 * s, y + 10 * s, 26.5);
        }
      f.rect(74 * s, 10 * s, 78 * s, 110 * s, 33); // bus bar
      f.gauss(98 * s, 48 * s, 5 * s, 3.5 * s, 38); // overloaded breaker
      f.gauss(48 * s, 78 * s, 2 * s, 2 * s, 55); // loose lug
      f.gauss(68 * s, 33 * s, 6 * s, 4 * s, 6);
      f.blur(1);
      f.noise(0.08, 11);
      break;
    }
    case 'building': {
      f.rect(0, 0, w, h, 18.2);
      for (let x = 12; x < 160; x += 40) f.rect(x * s, 0, (x + 3) * s, h, 17.1); // studs: cooler
      f.rect(0, 100 * s, w, h, 19.4); // floor / skirting
      f.rect(55 * s, 18 * s, 118 * s, 78 * s, 9.5); // window glass
      f.rect(52 * s, 15 * s, 121 * s, 18 * s, 14.2); // frame
      f.rect(52 * s, 76 * s, 121 * s, 80 * s, 14.2);
      f.rect(52 * s, 15 * s, 55 * s, 80 * s, 14.2);
      f.rect(118 * s, 15 * s, 121 * s, 80 * s, 14.2);
      f.gauss(119 * s, 50 * s, 2 * s, 24 * s, -2.5); // draught along the right seal
      f.rect(10 * s, 84 * s, 38 * s, 104 * s, 41); // radiator
      for (let x = 12; x < 38; x += 4) f.rect(x * s, 84 * s, (x + 1.2) * s, 104 * s, 37);
      f.gauss(24 * s, 70 * s, 14 * s, 14 * s, 5); // warm plume above radiator
      f.blur(1);
      f.noise(0.07, 22);
      break;
    }
    case 'kitchen': {
      f.rect(0, 0, w, h, 21.5);
      f.rect(0, 84 * s, w, h, 23.2); // counter top
      f.ellipse(52 * s, 62 * s, 20 * s, 26 * s, 84, 0.25); // kettle body
      f.rect(60 * s, 40 * s, 74 * s, 47 * s, 62); // spout
      f.gauss(78 * s, 28 * s, 6 * s, 12 * s, 14); // steam plume
      f.ellipse(112 * s, 74 * s, 12 * s, 14 * s, 61, 0.25); // mug
      f.ellipse(112 * s, 63 * s, 9 * s, 3 * s, 70, 0.1); // tea surface
      f.ellipse(144 * s, 70 * s, 8 * s, 22 * s, 6.5, 0.2); // cold bottle
      f.ellipse(20 * s, 98 * s, 14 * s, 8 * s, 45, 0.2); // warm pan residue on counter
      f.blur(1);
      f.noise(0.09, 33);
      break;
    }
    case 'heatsink': {
      f.rect(0, 0, w, h, 24);
      f.rect(20 * s, 20 * s, 140 * s, 100 * s, 28);
      for (let x = 24; x < 136; x += 6) f.rect(x * s, 24 * s, (x + 3.2) * s, 96 * s, 36);
      f.rect(20 * s, 20 * s, 140 * s, 24 * s, 31);
      f.gauss(80 * s, 62 * s, 22 * s, 22 * s, 30);
      f.gauss(80 * s, 62 * s, 5 * s, 5 * s, 14);
      f.blur(1);
      f.noise(0.1, 44);
      break;
    }
  }
  return f.t;
}
