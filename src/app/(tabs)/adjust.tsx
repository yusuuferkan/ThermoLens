import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button, Card, Chip, Muted, Row, SliderRow, Title } from '@/components/ui';
import { RAW_CALIBRATION_PRESETS } from '@/core/importer';
import { MATERIALS, nearestMaterial } from '@/core/materials';
import { formatTemp, fromUnit, toUnit } from '@/core/units';
import { useT, type Strings } from '@/i18n';
import { NoImage } from '@/lib/useFrameGuard';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';
import { colors, MAX_CONTENT_WIDTH } from '@/theme';

export default function Adjust() {
  const t = useT();
  const unit = useSettings((s) => s.unit);
  const frame = useSession((s) => s.frame);
  const map = useSession((s) => s.map);
  const st = useSession.getState;
  if (!frame || !map) return <NoImage />;
  const p = frame.params;
  const cal = frame.calibration;
  const mat = nearestMaterial(p.emissivity);
  const tempSlider = (label: string, key: 'reflectedTempC' | 'atmosphericTempC', min: number, max: number) => (
    <SliderRow label={label} valueText={formatTemp(p[key], unit)} value={toUnit(p[key], unit)} min={toUnit(min, unit)} max={toUnit(max, unit)} step={0.5} onChange={(v) => st().setParams({ [key]: fromUnit(v, unit) })} />
  );
  let lo = 65535, hi = 0;
  for (let i = 0; i < frame.raw.length; i++) {
    const v = frame.raw[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const sourceLabel = frame.source === 'demo' ? t('sourceDemo') : frame.source === 'flir' ? t('sourceFlir') : t('sourceRaw');

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={s.h1}>{t('adjustTitle')}</Text>
          <Muted>{t('adjustBody')}</Muted>
        </View>

        <Card style={s.live}>
          <LiveStat label={t('min')} value={formatTemp(map.min, unit)} color={colors.cold} />
          <LiveStat label={t('avg')} value={formatTemp(map.mean, unit)} color={colors.text} />
          <LiveStat label={t('max')} value={formatTemp(map.max, unit)} color={colors.hot} />
        </Card>

        <Card>
          <SliderRow label={t('emissivity')} valueText={p.emissivity.toFixed(2)} value={p.emissivity} min={0.05} max={1} step={0.01} onChange={(v) => st().setParams({ emissivity: Math.round(v * 100) / 100 })} />
          <Muted style={{ marginTop: 10, marginBottom: 8 }}>{t('material')}</Muted>
          <View style={s.chips}>
            {MATERIALS.map((m) => (
              <Chip key={m.id} label={`${t(`m_${m.id}` as keyof Strings)} ${m.emissivity.toFixed(2)}`} active={mat?.id === m.id} onPress={() => st().setParams({ emissivity: m.emissivity })} />
            ))}
          </View>
          <Muted style={{ marginTop: 10, fontSize: 12 }}>{t('materialNote')}</Muted>
        </Card>

        <Card>
          {tempSlider(t('reflected'), 'reflectedTempC', -40, 150)}
          {tempSlider(t('atmospheric'), 'atmosphericTempC', -40, 60)}
          <SliderRow label={t('distance')} valueText={`${p.distanceM.toFixed(1)} m`} value={p.distanceM} min={0} max={50} step={0.5} onChange={(v) => st().setParams({ distanceM: v })} />
          <SliderRow label={t('humidity')} valueText={`${Math.round(p.humidityPct)} %`} value={p.humidityPct} min={0} max={100} step={1} onChange={(v) => st().setParams({ humidityPct: v })} />
          <View style={{ marginTop: 12 }}>
            <Button label={t('resetValues')} icon="refresh-outline" variant="ghost" onPress={() => st().resetParams()} />
          </View>
        </Card>

        {cal.kind === 'tlinear' ? (
          <Card>
            <Title>{t('calibration')}</Title>
            <Muted style={{ marginBottom: 10 }}>{t('calibrationBody')}</Muted>
            <View style={s.chips}>
              {RAW_CALIBRATION_PRESETS.map((c) => (
                <Chip key={c.id} label={`${c.kelvinPerCount} K`} active={Math.abs(cal.kelvinPerCount - c.kelvinPerCount) < 1e-9} onPress={() => st().setCalibration({ ...cal, kelvinPerCount: c.kelvinPerCount })} />
              ))}
            </View>
            <SliderRow label={t('kPerCount')} valueText={cal.kelvinPerCount.toFixed(3)} value={cal.kelvinPerCount} min={0.005} max={0.2} step={0.005} onChange={(v) => st().setCalibration({ ...cal, kelvinPerCount: v })} />
            <SliderRow label={t('offsetK')} valueText={cal.offsetK.toFixed(1)} value={cal.offsetK} min={-100} max={100} step={0.5} onChange={(v) => st().setCalibration({ ...cal, offsetK: v })} />
          </Card>
        ) : null}

        <Card>
          <Title>{t('fileInfo')}</Title>
          <Row label={t('fileInfo')} value={sourceLabel} />
          {frame.cameraModel ? <Row label={t('camera')} value={frame.cameraModel} /> : null}
          <Row label={t('resolution')} value={`${frame.width} × ${frame.height}`} mono />
          <Row label={t('rawRange')} value={`${lo} – ${hi}`} mono />
          <Row label={t('calibration')} value={cal.kind === 'planck' ? t('planckInfo') : t('tlinearInfo')} />
          {cal.kind === 'planck' ? (
            <Row label="R1 · R2 · B · F · O" value={`${cal.planck.R1.toFixed(1)} · ${cal.planck.R2.toFixed(5)} · ${cal.planck.B.toFixed(0)} · ${cal.planck.F} · ${cal.planck.O}`} mono />
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function LiveStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={s.liveLabel}>{label}</Text>
      <Text style={[s.liveValue, { color }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 28, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  h1: { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 2, marginTop: 6 },
  live: { flexDirection: 'row' },
  liveLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  liveValue: { fontSize: 18, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
