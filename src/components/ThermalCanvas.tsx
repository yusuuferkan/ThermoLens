import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { evaluateMeasurement, headlineValue, type Measurement } from '@/core/measure';
import { tempAt } from '@/core/stats';
import { formatTemp, type TempUnit } from '@/core/units';
import type { Point, TemperatureMap } from '@/core/types';
import { colors, fonts } from '@/theme';

export type GesturePhase = 'start' | 'move' | 'end';
export type CanvasMode = 'cursor' | 'spot' | 'box' | 'line' | 'none';

export interface Draft {
  kind: 'spot' | 'box' | 'line';
  a: Point;
  b: Point;
}

export const KIND_COLOR = { spot: '#FFD23F', box: '#4DE1FF', line: '#7CFF8A' } as const;

const AnimatedG = Animated.createAnimatedComponent(G);

interface OverlayProps {
  map: TemperatureMap;
  width: number;
  height: number;
  scale: SharedValue<number>;
  unit: TempUnit;
  cursor?: Point | null;
  measurements: Measurement[];
  draft?: Draft | null;
  showMarkers: boolean;
}

function Pin({ x, y, W, scale, label, children }: { x: number; y: number; W: number; scale: SharedValue<number>; label?: string; children: React.ReactNode }) {
  const st = useAnimatedStyle(() => ({ transform: [{ scale: 1 / scale.get() }] }));
  const flip = x > W * 0.62;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y, width: 0, height: 0 }}>
      <Animated.View style={[{ position: 'absolute', left: -10, top: -10, width: 20, height: 20 }, st]}>
        <Svg width={20} height={20} viewBox="0 0 20 20">
          {children}
        </Svg>
        {label ? (
          <View style={[s.pinLabelWrap, flip ? { right: 24, justifyContent: 'flex-end' } : { left: 24 }]}>
            <View style={s.pinLabel}>
              <Text style={s.pinText} numberOfLines={1}>
                {label}
              </Text>
            </View>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const Crosshair = ({ color }: { color: string }) => (
  <>
    <Circle cx={10} cy={10} r={6.5} stroke="#000" strokeOpacity={0.55} strokeWidth={3.2} fill="none" />
    <Circle cx={10} cy={10} r={6.5} stroke={color} strokeWidth={1.6} fill="none" />
    <Path d="M10 0V5M10 15V20M0 10H5M15 10H20" stroke="#000" strokeOpacity={0.55} strokeWidth={3.2} />
    <Path d="M10 0V5M10 15V20M0 10H5M15 10H20" stroke={color} strokeWidth={1.4} />
  </>
);

export const Overlays = memo(function Overlays({ map, width, height, scale, unit, cursor, measurements, draft, showMarkers }: OverlayProps) {
  const k = width / map.width;
  const P = (p: Point) => ({ x: p.x * k, y: p.y * k });
  const animatedProps = useAnimatedProps(() => ({ strokeWidth: 2 / scale.get() }));
  const all: (Measurement | (Draft & { id: string }))[] = [...measurements];
  if (draft) all.push({ ...draft, id: 'draft' } as Draft & { id: string });
  const center = { x: map.width / 2, y: map.height / 2 };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <AnimatedG animatedProps={animatedProps} fill="none">
          {all.map((m) => {
            if (m.kind === 'box') {
              const a = P(m.a), b = P((m as Draft).b);
              return <Rect key={m.id} x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(a.x - b.x)} height={Math.abs(a.y - b.y)} stroke={KIND_COLOR.box} fill="rgba(77,225,255,0.10)" />;
            }
            if (m.kind === 'line') {
              const a = P(m.a), b = P((m as Draft).b);
              return <Line key={m.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={KIND_COLOR.line} />;
            }
            return null;
          })}
        </AnimatedG>
      </Svg>
      {showMarkers ? (
        <>
          <Pin x={P({ x: map.minAt.x + 0.5, y: map.minAt.y + 0.5 }).x} y={P({ x: map.minAt.x + 0.5, y: map.minAt.y + 0.5 }).y} W={width} scale={scale} label={formatTemp(map.min, unit)}>
            <Path d="M3 4H17L10 17Z" fill={colors.cold} stroke="#000" strokeOpacity={0.6} strokeWidth={1.2} />
          </Pin>
          <Pin x={P({ x: map.maxAt.x + 0.5, y: map.maxAt.y + 0.5 }).x} y={P({ x: map.maxAt.x + 0.5, y: map.maxAt.y + 0.5 }).y} W={width} scale={scale} label={formatTemp(map.max, unit)}>
            <Path d="M10 3L17 16H3Z" fill={colors.hot} stroke="#000" strokeOpacity={0.6} strokeWidth={1.2} />
          </Pin>
          <Pin x={P(center).x} y={P(center).y} W={width} scale={scale} label={formatTemp(tempAt(map, center.x, center.y), unit)}>
            <Path d="M10 5V15M5 10H15" stroke="#000" strokeOpacity={0.6} strokeWidth={3} />
            <Path d="M10 5V15M5 10H15" stroke="#fff" strokeWidth={1.4} />
          </Pin>
        </>
      ) : null}
      {measurements.map((m, i) => {
        const p = P(m.a);
        const r = evaluateMeasurement(map, m);
        const label = m.kind === 'spot' ? `${i + 1}  ${formatTemp(headlineValue(r), unit)}` : String(i + 1);
        return (
          <Pin key={m.id} x={p.x} y={p.y} W={width} scale={scale} label={label}>
            <Crosshair color={KIND_COLOR[m.kind]} />
          </Pin>
        );
      })}
      {draft ? (
        <Pin x={P(draft.a).x} y={P(draft.a).y} W={width} scale={scale}>
          <Crosshair color={KIND_COLOR[draft.kind]} />
        </Pin>
      ) : null}
      {cursor ? (
        <Pin x={P(cursor).x} y={P(cursor).y} W={width} scale={scale} label={formatTemp(tempAt(map, cursor.x, cursor.y), unit)}>
          <Crosshair color="#FFFFFF" />
        </Pin>
      ) : null}
    </View>
  );
});

interface CanvasProps extends Omit<OverlayProps, 'scale' | 'height'> {
  uri: string | null;
  mode: CanvasMode;
  onGesture?: (phase: GesturePhase, p: Point) => void;
}

/** Zoomable thermal image. One finger places crosshair / draws, two fingers pinch and pan. */
export function ThermalCanvas({ map, uri, width, mode, onGesture, ...overlay }: CanvasProps) {
  const height = Math.round((width * map.height) / map.width);
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sScale = useSharedValue(1);
  const sTx = useSharedValue(0);
  const sTy = useSharedValue(0);
  const iw = map.width;
  const ih = map.height;

  const emit = useCallback(
    (phase: GesturePhase, x: number, y: number) => {
      onGesture?.(phase, { x, y });
    },
    [onGesture],
  );

  const gesture = useMemo(() => {
    const clampT = () => {
      'worklet';
      const mx = ((scale.get() - 1) * width) / 2;
      const my = ((scale.get() - 1) * height) / 2;
      tx.set(Math.min(mx, Math.max(-mx, tx.get())));
      ty.set(Math.min(my, Math.max(-my, ty.get())));
    };
    const pinch = Gesture.Pinch()
      .onStart(() => {
        sScale.set(scale.get());
      })
      .onUpdate((e) => {
        scale.set(Math.min(8, Math.max(1, sScale.get() * e.scale)));
        clampT();
      });
    const pan2 = Gesture.Pan()
      .minPointers(2)
      .onStart(() => {
        sTx.set(tx.get());
        sTy.set(ty.get());
      })
      .onUpdate((e) => {
        tx.set(sTx.get() + e.translationX);
        ty.set(sTy.get() + e.translationY);
        clampT();
      });
    const toImg = (x: number, y: number) => {
      'worklet';
      const lx = (x - width / 2 - tx.get()) / scale.get() + width / 2;
      const ly = (y - height / 2 - ty.get()) / scale.get() + height / 2;
      return {
        x: Math.min(iw - 0.01, Math.max(0, (lx / width) * iw)),
        y: Math.min(ih - 0.01, Math.max(0, (ly / height) * ih)),
      };
    };
    const one = Gesture.Pan()
      .maxPointers(1)
      .minDistance(0)
      .enabled(mode !== 'none')
      .onStart((e) => {
        const p = toImg(e.x, e.y);
        scheduleOnRN(emit, 'start', p.x, p.y);
      })
      .onUpdate((e) => {
        const p = toImg(e.x, e.y);
        scheduleOnRN(emit, 'move', p.x, p.y);
      })
      .onEnd((e) => {
        const p = toImg(e.x, e.y);
        scheduleOnRN(emit, 'end', p.x, p.y);
      });
    return Gesture.Simultaneous(pinch, pan2, one);
  }, [width, height, iw, ih, mode, emit, scale, tx, ty, sScale, sTx, sTy]);

  const inner = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));
  const zoomBadge = useAnimatedStyle(() => ({ opacity: scale.get() > 1.02 ? 1 : 0 }));

  const reset = () => {
    scale.set(1);
    tx.set(0);
    ty.set(0);
  };

  return (
    <View style={[s.wrap, { width, height }]}>
      <GestureDetector gesture={gesture}>
        <View style={{ width, height, overflow: 'hidden' }} accessibilityLabel="Thermal image">
          <Animated.View style={[{ width, height }, inner]}>
            {uri ? <Image source={{ uri }} style={{ width, height }} resizeMode="stretch" fadeDuration={0} /> : null}
            <Overlays map={map} width={width} height={height} scale={scale} {...overlay} />
          </Animated.View>
        </View>
      </GestureDetector>
      <Animated.View style={[s.reset, zoomBadge]}>
        <Pressable accessibilityLabel="Reset zoom" onPress={reset} hitSlop={8}>
          <Ionicons name="scan-outline" size={18} color="#fff" />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: '#000', alignSelf: 'center' },
  pinLabelWrap: { position: 'absolute', top: 1, width: 130, flexDirection: 'row' },
  pinLabel: { backgroundColor: 'rgba(0,0,0,0.62)', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  pinText: { color: '#fff', fontSize: 11, fontWeight: '700', fontFamily: fonts.mono },
  reset: { position: 'absolute', right: 8, top: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
});
