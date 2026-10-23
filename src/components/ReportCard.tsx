import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PaletteBar } from '@/components/PaletteBar';
import { KIND_COLOR, ThermalCanvas } from '@/components/ThermalCanvas';
import { evaluateMeasurement } from '@/core/measure';
import { formatDelta, formatTemp } from '@/core/units';
import { useT } from '@/i18n';
import { useCanvasWidth } from '@/lib/useCanvasWidth';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';
import { colors, fonts } from '@/theme';

interface Props {
  uri: string;
  lo: number;
  hi: number;
  dateText: string;
}

/** On-screen report layout. The same view is captured to PNG. */
export const ReportCard = forwardRef<View, Props>(function ReportCard({ uri, lo, hi, dateText }, ref) {
  const t = useT();
  const unit = useSettings((s) => s.unit);
  const map = useSession((s) => s.map)!;
  const frame = useSession((s) => s.frame)!;
  const palette = useSession((s) => s.palette);
  const measurements = useSession((s) => s.measurements);
  const width = useCanvasWidth() - 32;
  const p = frame.params;
  return (
    <View ref={ref} collapsable={false} style={s.card}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>
            {frame.name}
          </Text>
          <Text style={s.sub}>{dateText}</Text>
        </View>
        <Text style={s.brand}>{t('appName')}</Text>
      </View>
      <ThermalCanvas map={map} uri={uri} width={width - 24} mode="none" cursor={null} measurements={measurements} showMarkers unit={unit} />
      <View style={{ marginTop: 10 }}>
        <PaletteBar palette={palette} lo={lo} hi={hi} unit={unit} />
      </View>
      <View style={s.kv}>
        <KV label={t('min')} value={formatTemp(map.min, unit)} color={colors.cold} />
        <KV label={t('avg')} value={formatTemp(map.mean, unit)} />
        <KV label={t('max')} value={formatTemp(map.max, unit)} color={colors.hot} />
      </View>
      <Text style={s.h2}>{t('measurements')}</Text>
      {measurements.length === 0 ? <Text style={s.sub}>{t('noMeasurements')}</Text> : null}
      {measurements.map((m, i) => {
        const r = evaluateMeasurement(map, m);
        const text =
          r.kind === 'spot'
            ? formatTemp(r.value, unit)
            : r.kind === 'box'
              ? `${formatTemp(r.stats.min, unit, 1, false)} / ${formatTemp(r.stats.max, unit, 1, false)} / ${formatTemp(r.stats.mean, unit)}`
              : `${formatTemp(r.profile.min, unit, 1, false)} / ${formatTemp(r.profile.max, unit, 1, false)} / ${formatTemp(r.profile.mean, unit)}  ${formatDelta(r.profile.max - r.profile.min, unit)}`;
        return (
          <View key={m.id} style={s.mrow}>
            <View style={[s.dot, { backgroundColor: KIND_COLOR[m.kind] }]}>
              <Text style={s.dotText}>{i + 1}</Text>
            </View>
            <Text style={s.mkind}>{t(m.kind)}</Text>
            <Text style={s.mval}>{text}</Text>
          </View>
        );
      })}
      {measurements.some((m) => m.kind !== 'spot') ? <Text style={[s.sub, { marginTop: 4 }]}>min / max / {t('avg').toLowerCase()}</Text> : null}
      <Text style={s.h2}>{t('parameters')}</Text>
      <View style={s.kv}>
        <KV label={t('emissivity')} value={p.emissivity.toFixed(2)} />
        <KV label={t('reflected')} value={formatTemp(p.reflectedTempC, unit)} />
        <KV label={t('atmospheric')} value={formatTemp(p.atmosphericTempC, unit)} />
        <KV label={t('distance')} value={`${p.distanceM.toFixed(1)} m`} />
        <KV label={t('humidity')} value={`${Math.round(p.humidityPct)} %`} />
      </View>
      <Text style={s.foot}>{t('generated')}</Text>
    </View>
  );
});

function KV({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ minWidth: 92 }}>
      <Text style={s.kvLabel}>{label}</Text>
      <Text style={[s.kvValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'stretch' },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  sub: { color: colors.muted, fontSize: 12 },
  brand: { color: colors.accent, fontWeight: '800', fontSize: 14 },
  kv: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  kvLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  kvValue: { color: colors.text, fontSize: 15, fontWeight: '700', fontFamily: fonts.mono },
  h2: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  mrow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  dot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: '#111', fontSize: 11, fontWeight: '800' },
  mkind: { color: colors.muted, width: 44, fontSize: 12 },
  mval: { color: colors.text, fontSize: 12.5, fontWeight: '600', fontFamily: fonts.mono, flexShrink: 1 },
  foot: { color: colors.muted, fontSize: 10, marginTop: 14, textAlign: 'center' },
});
