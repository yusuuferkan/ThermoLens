import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PaletteBar } from '@/components/PaletteBar';
import { Screen } from '@/components/Screen';
import { ThermalCanvas, type GesturePhase } from '@/components/ThermalCanvas';
import { Button, Card, Chip, Muted, SliderRow, SwitchRow, Title } from '@/components/ui';
import { PALETTE_IDS, PALETTES, rgbCss } from '@/core/palettes';
import { tempAt } from '@/core/stats';
import { formatTemp, fromUnit, toUnit } from '@/core/units';
import type { Point } from '@/core/types';
import { useT } from '@/i18n';
import { hapticSuccess } from '@/lib/haptics';
import { saveCurrentAnalysis } from '@/lib/saveAnalysis';
import { useCanvasWidth } from '@/lib/useCanvasWidth';
import { NoImage } from '@/lib/useFrameGuard';
import { useRange } from '@/lib/useRange';
import { useThermalImage } from '@/lib/useThermalImage';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';
import { colors, fonts, MAX_CONTENT_WIDTH } from '@/theme';

export default function Viewer() {
  const t = useT();
  const unit = useSettings((s) => s.unit);
  const map = useSession((s) => s.map);
  const frame = useSession((s) => s.frame);
  const palette = useSession((s) => s.palette);
  const autoRange = useSession((s) => s.autoRange);
  const level = useSession((s) => s.level);
  const span = useSession((s) => s.span);
  const hotspotOn = useSession((s) => s.hotspotOn);
  const hotspotC = useSession((s) => s.hotspotC);
  const showMarkers = useSession((s) => s.showMarkers);
  const cursor = useSession((s) => s.cursor);
  const savedId = useSession((s) => s.savedId);
  const set = useSession.getState;
  const [lo, hi] = useRange();
  const uri = useThermalImage(map, lo, hi, palette, hotspotOn ? hotspotC : null);
  const width = useCanvasWidth();
  const [justSaved, setJustSaved] = useState(false);

  if (!map || !frame) return <NoImage />;

  const onGesture = (_: GesturePhase, p: Point) => set().setCursor(p);
  const spot = cursor ? tempAt(map, cursor.x, cursor.y) : NaN;
  const dU = (c: number) => toUnit(c, unit);

  return (
    <Screen>
      <View style={s.head}>
        <Text style={s.name} numberOfLines={1}>
          {frame.name}
        </Text>
        <Muted>
          {frame.width}×{frame.height}
          {frame.cameraModel ? `  ·  ${frame.cameraModel}` : ''}
        </Muted>
      </View>
      <ThermalCanvas map={map} uri={uri} width={width} mode="cursor" cursor={cursor} measurements={[]} showMarkers={showMarkers} unit={unit} onGesture={onGesture} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={s.readRow}>
            <View>
              <Muted>{t('cursor')}</Muted>
              <Text style={s.big} accessibilityLabel="spot temperature">
                {formatTemp(spot, unit, 1)}
              </Text>
            </View>
            <View style={s.stats}>
              <Stat label={t('min')} value={formatTemp(map.min, unit)} color={colors.cold} />
              <Stat label={t('avg')} value={formatTemp(map.mean, unit)} color={colors.text} />
              <Stat label={t('max')} value={formatTemp(map.max, unit)} color={colors.hot} />
            </View>
          </View>
          <View style={{ marginTop: 12 }}>
            <PaletteBar palette={palette} lo={lo} hi={hi} unit={unit} />
          </View>
          <Muted style={{ marginTop: 8, fontSize: 12 }}>{t('hintViewer')}</Muted>
        </Card>

        <Card>
          <Title>{t('palette')}</Title>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {PALETTE_IDS.map((id) => (
              <Chip key={id} label={t(id)} active={id === palette} color={rgbCss(PALETTES[id].stops[Math.floor(PALETTES[id].stops.length * 0.7)])} onPress={() => set().setPalette(id)} />
            ))}
          </ScrollView>
        </Card>

        <Card>
          <SwitchRow label={t('autoRange')} value={autoRange} onChange={(v) => set().setAutoRange(v)} />
          {!autoRange ? (
            <>
              <SliderRow label={t('level')} valueText={formatTemp(level, unit)} value={dU(level)} min={dU(map.min - 10)} max={dU(map.max + 10)} step={0.1} onChange={(v) => set().setLevel(fromUnit(v, unit))} />
              <SliderRow label={t('span')} valueText={`${(unit === 'F' ? span * 1.8 : span).toFixed(1)}°${unit}`} value={unit === 'F' ? span * 1.8 : span} min={1} max={Math.max(10, (map.max - map.min) * 2) * (unit === 'F' ? 1.8 : 1)} step={0.5} onChange={(v) => set().setSpan(unit === 'F' ? v / 1.8 : v)} />
            </>
          ) : null}
          <SwitchRow label={t('markers')} value={showMarkers} onChange={(v) => set().setShowMarkers(v)} />
          <SwitchRow label={t('hotspot')} value={hotspotOn} onChange={(v) => set().setHotspotOn(v)} />
          {hotspotOn ? (
            <SliderRow label={t('hotspotAbove')} valueText={formatTemp(hotspotC, unit)} value={dU(hotspotC)} min={dU(map.min)} max={dU(map.max)} step={0.1} onChange={(v) => set().setHotspotC(fromUnit(v, unit))} />
          ) : null}
        </Card>

        <View style={s.actions}>
          <View style={{ flex: 1 }}>
            <Button
              label={justSaved || savedId ? t('saved') : t('save')}
              icon={justSaved || savedId ? 'checkmark-circle-outline' : 'bookmark-outline'}
              variant="ghost"
              onPress={async () => {
                if (await saveCurrentAnalysis()) {
                  hapticSuccess();
                  setJustSaved(true);
                }
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={t('report')} icon="document-text-outline" onPress={() => router.push('/report')} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 14, minWidth: 130 }}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  head: { paddingHorizontal: 16, paddingVertical: 8, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  content: { padding: 16, gap: 12, paddingBottom: 28, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  readRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  big: { color: colors.text, fontSize: 36, fontWeight: '800', fontFamily: fonts.mono, letterSpacing: -1 },
  stats: { gap: 4 },
  statLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  statValue: { fontSize: 13, fontWeight: '700', fontFamily: fonts.mono },
  actions: { flexDirection: 'row', gap: 10 },
});
