import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme';

export function Screen({ children, noTop }: { children: ReactNode; noTop?: boolean }) {
  const insets = useSafeAreaInsets();
  return <View style={[s.root, { paddingTop: noTop ? 0 : insets.top }]}>{children}</View>;
}

export function Header({ title, right, left }: { title: string; right?: ReactNode; left?: ReactNode }) {
  return (
    <View style={s.header}>
      <View style={s.side}>{left}</View>
      <Text style={s.headerTitle}>{title}</Text>
      <View style={[s.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 48 },
  side: { width: 60 },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '700' },
});
