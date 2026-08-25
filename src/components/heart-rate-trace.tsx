import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Polygon, Polyline } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

/**
 * Smallest span the trace will scale to, in bpm.
 *
 * Scaling purely to the visible min and max means a two-beat wobble fills the
 * whole height, which reads as a dramatic swing that never happened — and with
 * only two readings the first is always pinned to the floor and the second to
 * the ceiling. Holding a minimum span keeps small variation looking small.
 */
const MIN_SPAN_BPM = 12;

const TRACE_HEIGHT = 44;

/** An icon that pulses once per incoming reading — a heart by default. */
export function BeatingHeart({
  beatKey,
  size = 26,
  idle,
  icon = 'heart',
  activeColor,
}: {
  /** Changes with every new reading; each change triggers one beat. */
  beatKey: number | null;
  size?: number;
  /** Dimmed and still when no readings are arriving. */
  idle?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Colour while live. Defaults to the danger red, which suits the heart icon. */
  activeColor?: string;
}) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (beatKey === null) return;
    // Quick contraction, softer release — closer to a real pulse than a
    // symmetrical pulse would be.
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.28, duration: 110, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
    ]).start();
  }, [beatKey, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons
        name={icon}
        size={size}
        color={idle ? theme.textTertiary : (activeColor ?? theme.danger)}
      />
    </Animated.View>
  );
}

/** Vertical breathing room so a peak or trough never touches the edge. */
const TRACE_PADDING = 5;

/**
 * Recent readings as a continuous monitor-style line, oldest to newest —
 * closer to a hospital vitals trace than a bar chart, which reads as a jagged
 * staircase once the value stops climbing steadily.
 */
export function HeartRateTrace({ values, color }: { values: number[]; color: string }) {
  const [width, setWidth] = useState(0);
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const midpoint = (min + max) / 2;
  const span = Math.max(max - min, MIN_SPAN_BPM);
  const low = midpoint - span / 2;

  const plotHeight = TRACE_HEIGHT - TRACE_PADDING * 2;
  const yFor = (value: number) => {
    const ratio = Math.min(1, Math.max(0, (value - low) / span));
    return TRACE_HEIGHT - TRACE_PADDING - ratio * plotHeight;
  };
  const xFor = (index: number) =>
    values.length > 1 ? (index / (values.length - 1)) * width : width / 2;

  const points = values.map((value, index) => `${xFor(index)},${yFor(value)}`);
  const linePoints = points.join(' ');
  const fillPoints = [`${xFor(0)},${TRACE_HEIGHT}`, ...points, `${xFor(values.length - 1)},${TRACE_HEIGHT}`].join(' ');
  const lastIndex = values.length - 1;

  return (
    <View style={styles.trace} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={TRACE_HEIGHT}>
          <Polygon points={fillPoints} fill={color} opacity={0.12} />
          {values.length > 1 ? (
            <Polyline
              points={linePoints}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          <Circle cx={xFor(lastIndex)} cy={yFor(values[lastIndex])} r={4} fill={color} />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  trace: { height: TRACE_HEIGHT },
});

export { TRACE_HEIGHT, MIN_SPAN_BPM };
