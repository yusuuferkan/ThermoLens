import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { PALETTES, rgbCss, type PaletteId } from '@/core/palettes';
import { formatTemp, type TempUnit } from '@/core/units';
import { colors, fonts } from '@/theme';

/** Horizontal colour bar with cold / hot labels. */
export function PaletteBar({ palette, lo, hi, unit, height = 12 }: { palette: PaletteId; lo: number; hi: number; unit: TempUnit; height?: number }) {
  const stops = PALETTES[palette].stops;
  const mid = (lo + hi) / 2;
  return (
    <View>
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id={`pb-${palette}`} x1="0" y1="0" x2="1" y2="0">
            {stops.map((c, i) => (
              <Stop key={i} offset={i / (stops.length - 1)} stopColor={rgbCss(c)} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={height} rx={height / 2} fill={`url(#pb-${palette})`} />
      </Svg>
      <View style={s.labels}>
        <Text style={s.label}>{formatTemp(lo, unit)}</Text>
        <Text style={s.label}>{formatTemp(mid, unit)}</Text>
        <Text style={s.label}>{formatTemp(hi, unit)}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  label: { color: colors.muted, fontSize: 11, fontFamily: fonts.mono },
});
