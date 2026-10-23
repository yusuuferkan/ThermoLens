import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { hapticSelect, hapticTap } from '@/lib/haptics';
import { colors, fonts, radius } from '@/theme';

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Title({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={s.titleRow}>
      <Text style={s.title}>{children}</Text>
      {right}
    </View>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[s.muted, style]}>{children}</Text>;
}

export function Chip({ label, active, onPress, color }: { label: string; active?: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      style={[s.chip, active && { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
      {color ? <View style={[s.chipDot, { backgroundColor: color }]} /> : null}
      <Text style={[s.chipText, active && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={s.seg}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="button"
          accessibilityState={{ selected: o.value === value }}
          onPress={() => {
            hapticSelect();
            onChange(o.value);
          }}
          style={[s.segItem, o.value === value && s.segActive]}>
          <Text style={[s.segText, o.value === value && { color: colors.text }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Button({ label, icon, onPress, variant = 'primary', disabled }: { label: string; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void; variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean }) {
  const bg = variant === 'primary' ? colors.accent : 'transparent';
  const fg = variant === 'primary' ? '#1A0D00' : variant === 'danger' ? colors.hot : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        hapticTap();
        onPress();
      }}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, borderColor: variant === 'primary' ? colors.accent : colors.border, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }]}>
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[s.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, mono && { fontFamily: fonts.mono }]}>{value}</Text>
    </View>
  );
}

export function SwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.switchRow}>
      <Text style={s.switchLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={(v) => {
          hapticSelect();
          onChange(v);
        }}
        trackColor={{ true: colors.accent, false: colors.surface2 }}
        thumbColor="#fff"
        {...({ activeThumbColor: '#fff' } as object)}
      />
    </View>
  );
}

export function SliderRow({ label, valueText, value, min, max, step, onChange }: { label: string; valueText: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <View style={{ marginTop: 6 }}>
      <View style={s.sliderHead}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={[s.rowValue, { fontFamily: fonts.mono }]}>{valueText}</Text>
      </View>
      <Slider
        accessibilityLabel={label}
        style={{ height: 36 }}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.accent}
      />
    </View>
  );
}

export function Empty({ icon, title, body, action }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; action?: ReactNode }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.accent} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={[s.muted, { textAlign: 'center', maxWidth: 280 }]}>{body}</Text>
      {action}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  seg: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.sm + 2, padding: 3, borderWidth: 1, borderColor: colors.border },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.sm },
  segActive: { backgroundColor: colors.surface2 },
  segText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1 },
  btnText: { fontWeight: '700', fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  rowLabel: { color: colors.muted, fontSize: 13 },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  switchLabel: { color: colors.text, fontSize: 14 },
  sliderHead: { flexDirection: 'row', justifyContent: 'space-between' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
