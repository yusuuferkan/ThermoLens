import { useWindowDimensions, View } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';

import { colors } from '@/theme';

/** Tiny line chart of a temperature profile. */
export function ProfileChart({ values, height = 70 }: { values: number[]; height?: number }) {
  const { width: ww } = useWindowDimensions();
  const w = Math.min(ww, 560) - 64;
  if (values.length < 2) return null;
  let lo = Infinity, hi = -Infinity;
  for (const v of values) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const span = Math.max(hi - lo, 0.1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${height - 4 - ((v - lo) / span) * (height - 8)}`).join(' ');
  return (
    <View>
      <Svg width={w} height={height}>
        <Line x1="0" y1={height - 0.5} x2={w} y2={height - 0.5} stroke={colors.border} strokeWidth="1" />
        <Polyline points={pts} fill="none" stroke={colors.accent} strokeWidth="2" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
