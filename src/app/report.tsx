import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { ReportCard } from '@/components/ReportCard';
import { Header, Screen } from '@/components/Screen';
import { Button, Muted } from '@/components/ui';
import { useT, DICTIONARIES } from '@/i18n';
import { hapticSuccess, hapticWarn } from '@/lib/haptics';
import { buildReportHtml } from '@/lib/reportHtml';
import { NoImage } from '@/lib/useFrameGuard';
import { useRange } from '@/lib/useRange';
import { renderDataUri } from '@/lib/useThermalImage';
import { useSession } from '@/store/session';
import { useSettings } from '@/store/settings';
import { colors, MAX_CONTENT_WIDTH } from '@/theme';

function downloadOnWeb(uri: string, name: string) {
  const a = document.createElement('a');
  a.href = uri;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function Report() {
  const t = useT();
  const unit = useSettings((s) => s.unit);
  const language = useSettings((s) => s.language);
  const map = useSession((s) => s.map);
  const frame = useSession((s) => s.frame);
  const palette = useSession((s) => s.palette);
  const measurements = useSession((s) => s.measurements);
  const hotspotOn = useSession((s) => s.hotspotOn);
  const hotspotC = useSession((s) => s.hotspotC);
  const [lo, hi] = useRange();
  const ref = useRef<View>(null);
  const [busy, setBusy] = useState<null | 'png' | 'pdf'>(null);
  const [error, setError] = useState<string | null>(null);
  if (!map || !frame) return <NoImage />;

  const uri = renderDataUri(map, lo, hi, palette, hotspotOn ? hotspotC : null);
  const dateText = new Date().toLocaleString(language === 'tr' ? 'tr-TR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const baseName = frame.name.replace(/\.[^.]+$/, '') || 'thermolens';

  const exportPng = async () => {
    setError(null);
    setBusy('png');
    try {
      if (Platform.OS === 'web') {
        const data = await captureRef(ref, { format: 'png', quality: 1, result: 'data-uri' });
        downloadOnWeb(data, `${baseName}-report.png`);
      } else {
        const file = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file, { mimeType: 'image/png', dialogTitle: t('exportPng') });
      }
      hapticSuccess();
    } catch {
      hapticWarn();
      setError(t('shareFailed'));
    } finally {
      setBusy(null);
    }
  };

  const exportPdf = async () => {
    setError(null);
    setBusy('pdf');
    try {
      const html = buildReportHtml({
        title: frame.name,
        dateText,
        imageUri: uri,
        palette,
        lo,
        hi,
        unit,
        map,
        measurements,
        params: frame.params,
        labels: DICTIONARIES[language] as unknown as Record<string, string>,
      });
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const { uri: file } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: t('exportPdf') });
      }
      hapticSuccess();
    } catch {
      hapticWarn();
      setError(t('shareFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Header
        title={t('reportTitle')}
        left={
          <Pressable accessibilityLabel={t('close')} hitSlop={12} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={s.content}>
        <ReportCard ref={ref} uri={uri} lo={lo} hi={hi} dateText={dateText} />
        {error ? <Text style={s.err}>{error}</Text> : null}
        <View style={s.actions}>
          <View style={{ flex: 1 }}>
            <Button label={busy === 'png' ? t('exporting') : t('exportPng')} icon="image-outline" onPress={exportPng} disabled={!!busy} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label={busy === 'pdf' ? t('exporting') : t('exportPdf')} icon="document-outline" variant="ghost" onPress={exportPdf} disabled={!!busy} />
          </View>
        </View>
        <Muted style={{ textAlign: 'center', fontSize: 12 }}>{t('disclaimer')}</Muted>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 32, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  actions: { flexDirection: 'row', gap: 10 },
  err: { color: colors.hot, fontSize: 13 },
});
