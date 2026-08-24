import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line, Polyline, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ChartPoint } from '@/data/analytics';

const CHART_HEIGHT = 180;
const AXIS_WIDTH = 34;
const COLUMN_MIN_WIDTH = 3;

/**
 * Heart rate over a period is a range, not a single line — each column spans
 * the min and max seen in that slice, with the average drawn through it. A
 * plain line chart of averages would hide how much the rate actually moved.
 */
export function HistoryChart({ points }: { points: ChartPoint[] }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  if (points.length === 0) return null;

  const lowest = Math.min(...points.map(point => point.min));
  const highest = Math.max(...points.map(point => point.max));
  // Pad the scale so bars never touch the edges, and guard the flat case where
  // every reading is identical.
  const padding = Math.max(4, Math.round((highest - lowest) * 0.15));
  const scaleMin = Math.max(0, lowest - padding);
  const scaleMax = highest + padding;
  const span = Math.max(1, scaleMax - scaleMin);

  const plotWidth = Math.max(0, width - AXIS_WIDTH);
  const columnWidth = points.length > 0 ? plotWidth / points.length : 0;
  const barWidth = Math.max(COLUMN_MIN_WIDTH, Math.min(10, columnWidth * 0.55));

  const yFor = (value: number) => CHART_HEIGHT - ((value - scaleMin) / span) * CHART_HEIGHT;
  const xFor = (index: number) => index * columnWidth + columnWidth / 2;

  const gridValues = [scaleMax, Math.round((scaleMax + scaleMin) / 2), scaleMin];
  const averageLine = points.map((point, index) => `${xFor(index)},${yFor(point.avg)}`).join(' ');

  return (
    <View style={styles.wrapper} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <View style={styles.axis}>
        {gridValues.map(value => (
          <ThemedText key={value} type="caption" themeColor="textTertiary">
            {value}
          </ThemedText>
        ))}
      </View>

      {plotWidth > 0 ? (
        <Svg width={plotWidth} height={CHART_HEIGHT}>
          {gridValues.map(value => (
            <Line
              key={`grid-${value}`}
              x1={0}
              y1={yFor(value)}
              x2={plotWidth}
              y2={yFor(value)}
              stroke={theme.separator}
              strokeWidth={StyleSheet.hairlineWidth}
            />
          ))}

          {points.map((point, index) => {
            const top = yFor(point.max);
            const height = Math.max(2, yFor(point.min) - top);
            return (
              <Rect
                key={point.start}
                x={xFor(index) - barWidth / 2}
                y={top}
                width={barWidth}
                height={height}
                rx={barWidth / 2}
                fill={theme.tint}
                opacity={0.25}
              />
            );
          })}

          {points.length > 1 ? (
            <Polyline
              points={averageLine}
              fill="none"
              stroke={theme.tint}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', gap: Spacing.one },
  axis: {
    width: AXIS_WIDTH - Spacing.one,
    height: CHART_HEIGHT,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
});
