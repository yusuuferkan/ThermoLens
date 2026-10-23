import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hapticSelect } from '@/lib/haptics';
import { useT } from '@/i18n';
import { colors } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

export default function TabsLayout() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const icon = (name: IconName) =>
    function TabIcon({ color, size }: { color: ColorValue; size: number }) {
      return <Ionicons name={name} size={size} color={color} />;
    };
  return (
    <Tabs
      screenListeners={{ tabPress: () => hapticSelect() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 72 + insets.bottom,
          paddingBottom: 10 + insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', lineHeight: 16, paddingBottom: 2 },
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: t('tabGallery'), tabBarIcon: icon('images-outline') }} />
      <Tabs.Screen name="viewer" options={{ title: t('tabViewer'), tabBarIcon: icon('thermometer-outline') }} />
      <Tabs.Screen name="measure" options={{ title: t('tabMeasure'), tabBarIcon: icon('analytics-outline') }} />
      <Tabs.Screen name="adjust" options={{ title: t('tabAdjust'), tabBarIcon: icon('options-outline') }} />
      <Tabs.Screen name="history" options={{ title: t('tabHistory'), tabBarIcon: icon('time-outline') }} />
    </Tabs>
  );
}
