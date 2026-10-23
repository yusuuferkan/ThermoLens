import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Empty } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { buildDemoFrame } from '@/core/demo';
import { formatTemp } from '@/core/units';
import type { ThermalFrame } from '@/core/types';
import { analysisStore } from '@/data/db';
import type { AnalysisRecord } from '@/data/types';
import { useT } from '@/i18n';
import { hapticSuccess, hapticWarn } from '@/lib/haptics';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';
import { colors, MAX_CONTENT_WIDTH, radius } from '@/theme';

export default function History() {
  const t = useT();
  const unit = useSettings((s) => s.unit);
  const language = useSettings((s) => s.language);
  const [items, setItems] = useState<AnalysisRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    analysisStore.list().then(setItems).catch(() => setItems([]));
  }, []);
  useFocusEffect(refresh);

  const open = async (rec: AnalysisRecord) => {
    setError(null);
    let frame: ThermalFrame;
    if (rec.source === 'demo' && rec.demoId) {
      frame = buildDemoFrame(rec.demoId as Parameters<typeof buildDemoFrame>[0]);
    } else {
      const raw = await analysisStore.getRaw(rec.id);
      if (!raw) {
        hapticWarn();
        setError(t('reopenFailed'));
        return;
      }
      frame = { name: rec.name, width: rec.width, height: rec.height, raw, calibration: rec.calibration, params: rec.params, source: rec.source, cameraModel: rec.cameraModel };
    }
    frame = { ...frame, params: rec.params, calibration: rec.calibration, name: rec.name };
    useSession.getState().loadFrame(frame, { demoId: rec.demoId, palette: rec.palette, measurements: rec.measurements, savedId: rec.id });
    hapticSuccess();
    router.navigate('/viewer');
  };

  const remove = async (id: string) => {
    await analysisStore.remove(id);
    refresh();
  };

  return (
    <Screen>
      <Text style={s.h1}>{t('historyTitle')}</Text>
      {error ? <Text style={s.err}>{error}</Text> : null}
      {items.length === 0 ? (
        <Empty icon="time-outline" title={t('historyTitle')} body={t('historyEmpty')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" onPress={() => open(item)} style={({ pressed }) => [s.item, pressed && { opacity: 0.85 }]}>
              <Image source={{ uri: item.thumb }} style={s.thumb} />
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={s.meta}>{new Date(item.createdAt).toLocaleString(language === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
                <Text style={s.meta}>
                  {formatTemp(item.minC, unit)} – {formatTemp(item.maxC, unit)}  ·  {item.measurements.length} {t('measurements').toLowerCase()}
                </Text>
              </View>
              <Pressable accessibilityLabel={t('delete')} hitSlop={12} onPress={() => remove(item.id)}>
                <Ionicons name="trash-outline" size={20} color={colors.muted} />
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  h1: { color: colors.text, fontSize: 24, fontWeight: '800', padding: 16, paddingBottom: 4, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  err: { color: colors.hot, paddingHorizontal: 16, paddingBottom: 6, fontSize: 13 },
  list: { padding: 16, gap: 10, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 72, height: 54, borderRadius: radius.sm, backgroundColor: '#000' },
  name: { color: colors.text, fontWeight: '700', fontSize: 14 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
