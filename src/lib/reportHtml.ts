import { evaluateMeasurement, type Measurement } from '../core/measure';
import { PALETTES, rgbCss, type PaletteId } from '../core/palettes';
import { formatDelta, formatTemp, type TempUnit } from '../core/units';
import type { ObjectParams, TemperatureMap } from '../core/types';

export interface ReportInput {
  title: string;
  dateText: string;
  imageUri: string;
  palette: PaletteId;
  lo: number;
  hi: number;
  unit: TempUnit;
  map: TemperatureMap;
  measurements: Measurement[];
  params: ObjectParams;
  labels: Record<string, string>;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const KIND_COLOR = { spot: '#E0A800', box: '#0AA5C9', line: '#2FB344' };

/** Self-contained printable HTML (used for the PDF export). */
export function buildReportHtml(r: ReportInput): string {
  const L = r.labels;
  const grad = PALETTES[r.palette].stops.map((c, i, a) => `${rgbCss(c)} ${Math.round((i / (a.length - 1)) * 100)}%`).join(', ');
  const pins = r.measurements
    .map((m, i) => {
      const x = ((m.a.x / r.map.width) * 100).toFixed(2);
      const y = ((m.a.y / r.map.height) * 100).toFixed(2);
      return `<div class="pin" style="left:${x}%;top:${y}%;background:${KIND_COLOR[m.kind]}">${i + 1}</div>`;
    })
    .join('');
  const rows = r.measurements
    .map((m, i) => {
      const res = evaluateMeasurement(r.map, m);
      let vals = '';
      if (res.kind === 'spot') vals = formatTemp(res.value, r.unit);
      else if (res.kind === 'box')
        vals = `${L.min} ${formatTemp(res.stats.min, r.unit)} &middot; ${L.max} ${formatTemp(res.stats.max, r.unit)} &middot; ${L.avg} ${formatTemp(res.stats.mean, r.unit)}`;
      else vals = `${L.min} ${formatTemp(res.profile.min, r.unit)} &middot; ${L.max} ${formatTemp(res.profile.max, r.unit)} &middot; ${L.avg} ${formatTemp(res.profile.mean, r.unit)} &middot; ${L.delta} ${formatDelta(res.profile.max - res.profile.min, r.unit)}`;
      return `<tr><td><span class="dot" style="background:${KIND_COLOR[m.kind]}">${i + 1}</span></td><td>${esc(L[m.kind])}</td><td>${vals}</td></tr>`;
    })
    .join('');
  const p = r.params;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.title)}</title><style>
  body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#14181d;margin:28px;max-width:720px}
  h1{font-size:22px;margin:0}.sub{color:#5b6673;font-size:12px;margin:2px 0 16px}
  .img{position:relative;line-height:0}.img img{width:100%;border-radius:8px;image-rendering:auto}
  .pin{position:absolute;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:9px;color:#111;font-size:11px;font-weight:700;line-height:18px;text-align:center;border:1.5px solid #fff}
  .bar{height:12px;border-radius:6px;margin-top:12px;background:linear-gradient(to right, ${grad})}
  .scale{display:flex;justify-content:space-between;font-size:11px;color:#5b6673;margin-top:3px}
  h2{font-size:14px;margin:20px 0 6px}table{border-collapse:collapse;width:100%;font-size:12.5px}
  td{padding:5px 6px;border-bottom:1px solid #e3e7ec}.dot{display:inline-block;width:18px;height:18px;border-radius:9px;text-align:center;line-height:18px;font-size:11px;font-weight:700}
  .kv{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-size:12px}.kv b{display:block;font-size:13px}
  .foot{margin-top:22px;color:#8a95a3;font-size:11px}
  </style></head><body>
  <h1>${esc(r.title)}</h1><div class="sub">${esc(r.dateText)}</div>
  <div class="img"><img src="${r.imageUri}" />${pins}</div>
  <div class="bar"></div><div class="scale"><span>${formatTemp(r.lo, r.unit)}</span><span>${formatTemp((r.lo + r.hi) / 2, r.unit)}</span><span>${formatTemp(r.hi, r.unit)}</span></div>
  <h2>${esc(L.summary)}</h2>
  <div class="kv"><div>${L.min}<b>${formatTemp(r.map.min, r.unit)}</b></div><div>${L.avg}<b>${formatTemp(r.map.mean, r.unit)}</b></div><div>${L.max}<b>${formatTemp(r.map.max, r.unit)}</b></div></div>
  <h2>${esc(L.measurements)}</h2>
  ${r.measurements.length ? `<table>${rows}</table>` : `<div class="sub">${esc(L.noMeasurements)}</div>`}
  <h2>${esc(L.parameters)}</h2>
  <div class="kv"><div>${L.emissivity}<b>${p.emissivity.toFixed(2)}</b></div><div>${L.reflected}<b>${formatTemp(p.reflectedTempC, r.unit)}</b></div><div>${L.atmospheric}<b>${formatTemp(p.atmosphericTempC, r.unit)}</b></div><div>${L.distance}<b>${p.distanceM.toFixed(1)} m</b></div><div>${L.humidity}<b>${Math.round(p.humidityPct)} %</b></div></div>
  <div class="foot">${esc(L.generated)} &middot; ${esc(L.disclaimer)}</div>
  </body></html>`;
}
