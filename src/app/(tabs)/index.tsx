import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Muted } from '@/components/ui';
import { Screen } from '@/components/Screen';
import { buildDemoFrame, DEMOS } from '@/core/demo';
import { ImportError } from '@/core/importer';
import { computeTemperatureMap } from '@/core/radiometry';
import type { SceneId } from '@/core/scenes';
import { useT, type Strings } from '@/i18n';
import { pickFromFiles, pickFromPhotos } from '@/lib/files';
import { hapticWarn } from '@/lib/haptics';
import { openDemo, openFrame } from '@/lib/loadFrame';
import { renderDataUri } from '@/lib/useThermalImage';
import { colors, MAX_CONTENT_WIDTH, radius } from '@/theme';


const DEMO_TEXT: Record<SceneId, [keyof Strings, keyof Strings]> = {
  panel: ['demoPanel', 'demoPanelDesc'],
  building: ['demoBuilding', 'demoBuildingDesc'],
  kitchen: ['demoKitchen', 'demoKitchenDesc'],
  heatsink: ['demoHeatsink', 'demoHeatsinkDesc'],
};

const thumbCache = new Map<SceneId, string>();

function useThumbs() {
  const [thumbs, setThumbs] = useState<Partial<Record<SceneId, string>>>(() => Object.fromEntries(thumbCache));
  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      for (const d of DEMOS) {
        if (cancelled) return;
        if (!thumbCache.has(d.id)) {
          const map = computeTemperatureMap(buildDemoFrame(d.id));
          thumbCache.set(d.id, renderDataUri(map, map.min, map.max, 'ironbow', null));
        }
      }
      if (!cancelled) setThumbs(Object.fromEntries(thumbCache));
    }, 30);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, []);
  return thumbs;
}

export default function Gallery() {
  const t = useT();
  const thumbs = useThumbs();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (picker: typeof pickFromFiles) => {
    setError(null);
    setBusy(true);
    try {
      const frame = await picker();
      if (frame) openFrame(frame);
    } catch (e) {
      hapticWarn();
      if (e instanceof ImportError) {
        setError(t(e.code === 'notRadiometric' ? 'errNotRadiometric' : e.code === 'unsupported' ? 'errUnsupported' : 'errCorrupt'));
      } else setError(t('errCorrupt'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.top}>
          <View style={{ flex: 1 }}>
            <View style={s.brandRow}>
              <View style={s.logo}>
                <Ionicons name="flame" size={18} color="#1A0D00" />
              </View>
              <Text style={s.brand}>{t('appName')}</Text>
            </View>
            <Muted style={{ marginTop: 6 }}>{t('tagline')}</Muted>
          </View>
          <Pressable accessibilityLabel={t('settings')} onPress={() => router.push('/settings')} hitSlop={10} style={s.gear}>
            <Ionicons name="settings-outline" size={22} color={colors.text} />
          </Pressable>
        </View>

        <Card style={{ marginTop: 18 }}>
          <Text style={s.cardTitle}>{t('importTitle')}</Text>
          <Muted style={{ marginTop: 4, marginBottom: 14 }}>{t('importBody')}</Muted>
          <View style={{ gap: 10 }}>
            <Button label={t('openFiles')} icon="folder-open-outline" onPress={() => run(pickFromFiles)} disabled={busy} />
            <Button label={t('openPhotos')} icon="image-outline" variant="ghost" onPress={() => run(pickFromPhotos)} disabled={busy} />
          </View>
          {busy ? <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} /> : null}
          {error ? (
            <View style={s.error}>
              <Ionicons name="alert-circle" size={18} color={colors.hot} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}
          <Muted style={{ marginTop: 12, fontSize: 12 }}>{t('importHint')}</Muted>
        </Card>

        <Text style={s.section}>{t('demoTitle')}</Text>
        <Muted style={{ marginBottom: 12 }}>{t('demoBody')}</Muted>
        <View style={s.grid}>
          {DEMOS.map((d) => {
            const [title, desc] = DEMO_TEXT[d.id];
            return (
              <Pressable key={d.id} accessibilityRole="button" accessibilityLabel={t(title)} onPress={() => openDemo(d.id)} style={({ pressed }) => [s.demo, pressed && { opacity: 0.85 }]}>
                <View style={s.thumbWrap}>
                  {thumbs[d.id] ? <Image source={{ uri: thumbs[d.id] }} style={s.thumb} resizeMode="cover" /> : <View style={[s.thumb, { backgroundColor: colors.surface2 }]} />}
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{d.kind === 'flir' ? t('badgeFlir') : t('badgeRaw')}</Text>
                  </View>
                </View>
                <Text style={s.demoTitle}>{t(title)}</Text>
                <Text style={s.demoDesc} numberOfLines={2}>
                  {t(desc)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  brand: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  gear: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  error: { flexDirection: 'row', gap: 8, marginTop: 12, padding: 10, borderRadius: radius.sm, backgroundColor: 'rgba(255,59,107,0.10)', borderWidth: 1, borderColor: 'rgba(255,59,107,0.35)' },
  errorText: { color: colors.text, flex: 1, fontSize: 13, lineHeight: 18 },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 26, marginBottom: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  demo: { width: '47.8%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 8 },
  thumbWrap: { borderRadius: radius.sm, overflow: 'hidden', aspectRatio: 4 / 3, backgroundColor: '#000' },
  thumb: { width: '100%', height: '100%' },
  badge: { position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  demoTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 8 },
  demoDesc: { color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 16 },
});
