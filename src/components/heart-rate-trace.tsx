import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
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

/** A heart that beats once per incoming reading. */
export function BeatingHeart({
  beatKey,
  size = 26,
  idle,
}: {
  /** Changes with every new reading; each change triggers one beat. */
  beatKey: number | null;
  size?: number;
  /** Dimmed and still when no readings are arriving. */
  idle?: boolean;
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
        name="heart"
        size={size}
        color={idle ? theme.textTertiary : theme.danger}
      />
    </Animated.View>
  );
}

/**
 * Recent readings as a bar trace, oldest to newest. The newest bar is
 * emphasised so the eye lands on the current value.
 */
export function HeartRateTrace({ values, color }: { values: number[]; color: string }) {
  const theme = useTheme();
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const midpoint = (min + max) / 2;
  const span = Math.max(max - min, MIN_SPAN_BPM);
  const low = midpoint - span / 2;

  return (
    <View style={styles.trace}>
      {values.map((value, index) => {
        const ratio = Math.min(1, Math.max(0, (value - low) / span));
        const isLatest = index === values.length - 1;
        return (
          <View
            key={index}
            style={[
              styles.bar,
              {
                // A floor keeps every reading visible rather than collapsing
                // the lowest one to nothing.
                height: 6 + ratio * (TRACE_HEIGHT - 6),
                backgroundColor: isLatest ? color : theme.separator,
                opacity: isLatest ? 1 : 0.55 + ratio * 0.35,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  trace: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: TRACE_HEIGHT,
  },
  bar: { flex: 1, maxWidth: 7, borderRadius: 3, minWidth: 2 },
});

export { TRACE_HEIGHT, MIN_SPAN_BPM };
