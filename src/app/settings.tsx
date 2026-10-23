import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Header, Screen } from '@/components/Screen';
import { Card, Muted, Row, Segmented, SwitchRow, Title } from '@/components/ui';
import type { TempUnit } from '@/core/units';
import { useT, type Lang } from '@/i18n';
import { useSettings } from '@/store/settings';
import { colors, MAX_CONTENT_WIDTH } from '@/theme';

const LINKEDIN = 'https://www.linkedin.com/in/yusuferkan1/';
const GITHUB = 'https://github.com/yusuuferkan';

export default function Settings() {
  const t = useT();
  const { unit, language, haptics, setUnit, setLanguage, setHaptics } = useSettings();
  return (
    <Screen noTop>
      <Header
        title={t('settings')}
        right={
          <Pressable accessibilityLabel={t('close')} hitSlop={12} onPress={() => router.back()}>
            <Ionicons name="close" size={26} color={colors.text} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={s.content}>
        <Card>
          <Title>{t('units')}</Title>
          <Segmented<TempUnit> value={unit} onChange={setUnit} options={[{ value: 'C', label: '°C' }, { value: 'F', label: '°F' }]} />
        </Card>
        <Card>
          <Title>{t('language')}</Title>
          <Segmented<Lang> value={language} onChange={setLanguage} options={[{ value: 'en', label: 'English' }, { value: 'tr', label: 'Türkçe' }]} />
        </Card>
        <Card>
          <SwitchRow label={t('haptics')} value={haptics} onChange={setHaptics} />
        </Card>
        <Card>
          <Title>{t('about')}</Title>
          <Muted>{t('aboutBody')}</Muted>
          <View style={{ height: 8 }} />
          <Row label={t('version')} value={Constants.expoConfig?.version ?? '1.0.0'} />
          <Muted style={{ marginTop: 6, fontSize: 12 }}>{t('disclaimer')}</Muted>
        </Card>
        <View style={s.links}>
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(LINKEDIN)}>
            <Text style={s.link}>{t('linkedin')}</Text>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(GITHUB)}>
            <Text style={s.link}>{t('github')}</Text>
          </Pressable>
        </View>
        <Text style={s.made}>
          {t('madeBy')} <Text style={{ color: colors.text, fontWeight: '700' }}>Yusuf Erkan</Text>
        </Text>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 32, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 4 },
  link: { color: colors.accent, fontWeight: '600', fontSize: 14 },
  made: { color: colors.muted, textAlign: 'center', fontSize: 13, marginTop: 6 },
});
