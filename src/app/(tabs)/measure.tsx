import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ProfileChart } from '@/components/ProfileChart';
import { Screen } from '@/components/Screen';
import { KIND_COLOR, ThermalCanvas, type Draft, type GesturePhase } from '@/components/ThermalCanvas';
import { Button, Card, Muted, Segmented } from '@/components/ui';
import { evaluateMeasurement, type Measurement, type MeasurementResult } from '@/core/measure';
import { formatDelta, formatTemp, type TempUnit } from '@/core/units';
import type { Point } from '@/core/types';
import { useT, type Strings } from '@/i18n';
import { hapticSelect, hapticTap } from '@/lib/haptics';
import { useCanvasWidth } from '@/lib/useCanvasWidth';
import { NoImage } from '@/lib/useFrameGuard';
import { useRange } from '@/lib/useRange';
import { useThermalImage } from '@/lib/useThermalImage';
import { useSession, type Tool } from '@/store/session';
import { useSettings } from '@/store/settings';
import { colors, fonts, MAX_CONTENT_WIDTH, radius } from '@/theme';

let counter = 0;
const newId = () => `m${Date.now().toString(36)}${counter++}`;

export default function Measure() {
  const t = useT();
  const unit = useSettings((s) => s.unit);
  const map = useSession((s) => s.map);
  const frame = useSession((s) => s.frame);
  const palette = useSession((s) => s.palette);
  const tool = useSession((s) => s.tool);
  const measurements = useSession((s) => s.measurements);
  const hotspotOn = useSession((s) => s.hotspotOn);
  const hotspotC = useSession((s) => s.hotspotC);
  const showMarkers = useSession((s) => s.showMarkers);
  const [lo, hi] = useRange();
  const uri = useThermalImage(map, lo, hi, palette, hotspotOn ? hotspotC : null);
  const width = useCanvasWidth();
  const [draft, setDraft] = useState<Draft | null>(null);
  const draftRef = useRef<Draft | null>(null);

  const onGesture = useCallback(
    (phase: GesturePhase, p: Point) => {
      const st = useSession.getState();
      const kind = st.tool;
      if (phase === 'start') {
        draftRef.current = { kind, a: p, b: p };
      } else if (draftRef.current) {
        draftRef.current = { ...draftRef.current, a: kind === 'spot' ? p : draftRef.current.a, b: p };
      }
      const d = draftRef.current;
      if (phase !== 'end' || !d) {
        setDraft(d);
        return;
      }
      draftRef.current = null;
      setDraft(null);
      if (d.kind === 'spot') st.addMeasurement({ id: newId(), kind: 'spot', a: d.b });
      else if (Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y) >= 2) st.addMeasurement({ id: newId(), kind: d.kind, a: d.a, b: d.b });
      else return;
      hapticTap();
    },
    [],
  );

  if (!map || !frame) return <NoImage />;

  const toolHint = tool === 'spot' ? t('hintSpot') : tool === 'box' ? t('hintBox') : t('hintLine');

  return (
    <Screen>
      <View style={s.tools}>
        <Segmented<Tool>
          value={tool}
          onChange={(v) => {
            useSession.getState().setTool(v);
            setDraft(null);
            draftRef.current = null;
          }}
          options={[
            { value: 'spot', label: t('spot') },
            { value: 'box', label: t('box') },
            { value: 'line', label: t('line') },
          ]}
        />
      </View>
      <ThermalCanvas map={map} uri={uri} width={width} mode={tool} cursor={null} measurements={measurements} draft={draft} showMarkers={showMarkers} unit={unit} onGesture={onGesture} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Muted style={{ fontSize: 12 }}>{toolHint}</Muted>
        <View style={s.listHead}>
          <Text style={s.listTitle}>{t('measurements')}</Text>
          {measurements.length ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                hapticSelect();
                useSession.getState().clearMeasurements();
              }}>
              <Text style={s.clear}>{t('clearAll')}</Text>
            </Pressable>
          ) : null}
        </View>
        {measurements.length === 0 ? (
          <Card>
            <Muted>{t('noMeasurements')}</Muted>
          </Card>
        ) : (
          measurements.map((m, i) => <MeasurementCard key={m.id} index={i} m={m} unit={unit} map={map} t={t} />)
        )}
        {measurements.length ? <Button label={t('report')} icon="document-text-outline" onPress={() => router.push('/report')} /> : null}
      </ScrollView>
    </Screen>
  );
}

function MeasurementCard({ index, m, unit, map, t }: { index: number; m: Measurement; unit: TempUnit; map: NonNullable<ReturnType<typeof useSession.getState>['map']>; t: (k: keyof Strings) => string }) {
  const r = evaluateMeasurement(map, m);
  return (
    <Card>
      <View style={s.cardHead}>
        <View style={[s.badge, { backgroundColor: KIND_COLOR[m.kind] }]}>
          <Text style={s.badgeText}>{index + 1}</Text>
        </View>
        <Text style={s.kind}>{t(m.kind)}</Text>
        <View style={{ flex: 1 }} />
        <Pressable accessibilityLabel={t('remove')} hitSlop={10} onPress={() => useSession.getState().removeMeasurement(m.id)}>
          <Ionicons name="close-circle" size={22} color={colors.muted} />
        </Pressable>
      </View>
      <Values r={r} unit={unit} t={t} />
      {r.kind === 'line' ? (
        <View style={{ marginTop: 10 }}>
          <Muted style={{ marginBottom: 4, fontSize: 12 }}>{t('profile')}</Muted>
          <ProfileChart values={r.profile.values} />
        </View>
      ) : null}
    </Card>
  );
}

function Values({ r, unit, t }: { r: MeasurementResult; unit: TempUnit; t: (k: keyof Strings) => string }) {
  const items: [string, string][] =
    r.kind === 'spot'
      ? [[t('spot'), formatTemp(r.value, unit, 1)]]
      : r.kind === 'box'
        ? [
            [t('min'), formatTemp(r.stats.min, unit)],
            [t('max'), formatTemp(r.stats.max, unit)],
            [t('avg'), formatTemp(r.stats.mean, unit)],
            [t('std'), formatDelta(r.stats.std, unit, 2)],
          ]
        : [
            [t('min'), formatTemp(r.profile.min, unit)],
            [t('max'), formatTemp(r.profile.max, unit)],
            [t('avg'), formatTemp(r.profile.mean, unit)],
            [t('delta'), formatDelta(r.profile.max - r.profile.min, unit)],
          ];
  return (
    <View style={s.vals}>
      {items.map(([k, v]) => (
        <View key={k} style={{ minWidth: 70 }}>
          <Text style={s.vLabel}>{k}</Text>
          <Text style={s.vValue}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  tools: { paddingHorizontal: 16, paddingVertical: 8, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  content: { padding: 16, gap: 10, paddingBottom: 28, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  listTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  clear: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  badge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#111', fontWeight: '800', fontSize: 12 },
  kind: { color: colors.text, fontWeight: '700', fontSize: 14 },
  vals: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, borderRadius: radius.sm },
  vLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  vValue: { color: colors.text, fontSize: 16, fontWeight: '700', fontFamily: fonts.mono },
});
