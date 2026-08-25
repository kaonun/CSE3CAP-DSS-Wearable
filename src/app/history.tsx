import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HistoryChart } from '@/components/history-chart';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/surface';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  computeStats,
  devicesIn,
  filterByRange,
  toChartPoints,
  type RangeKey,
} from '@/data/analytics';
import { useReadingSyncContext } from '@/data/reading-sync-context';
import { fetchSummaries, type Summary } from '@/data/summaries';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { METRIC_INFO, METRIC_ORDER, metricColor, type MetricKey } from '@/metrics';

function StatTile({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
}) {
  return (
    <View style={styles.statTile}>
      <ThemedText type="footnote" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
      <View style={styles.statValueRow}>
        <ThemedText type="title2" style={color ? { color } : undefined}>
          {value}
        </ThemedText>
        {unit ? (
          <ThemedText type="footnote" themeColor="textTertiary">
            {unit}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const sync = useReadingSyncContext();

  const [range, setRange] = useState<RangeKey>('today');
  const [metric, setMetric] = useState<MetricKey>('heartRate');
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Force out whatever is still buffered locally first — otherwise a
      // device connected moments ago shows nothing, since a bucket only
      // writes itself once its minute closes on its own.
      await sync.flush(true);
      setSummaries(await fetchSummaries());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t.errGeneric);
    }
  }, [t, sync.flush]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    load().finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [load]);

  // Different metrics are not comparable (bpm vs steps/min vs kcal), so stats
  // and the chart only ever look at one metric at a time.
  const availableMetrics = useMemo(
    () => METRIC_ORDER.filter(candidate => summaries.some(summary => summary.metric === candidate)),
    [summaries],
  );

  // Keep the selection pinned to a metric that actually has data.
  useEffect(() => {
    if (availableMetrics.length > 0 && !availableMetrics.includes(metric)) {
      setMetric(availableMetrics[0]);
    }
  }, [availableMetrics, metric]);

  const metricSummaries = useMemo(
    () => summaries.filter(summary => summary.metric === metric),
    [summaries, metric],
  );

  const inRange = useMemo(() => filterByRange(metricSummaries, range), [metricSummaries, range]);
  const stats = useMemo(() => computeStats(inRange), [inRange]);
  const points = useMemo(() => toChartPoints(inRange, range), [inRange, range]);
  const contributors = useMemo(() => devicesIn(inRange), [inRange]);
  const unit = t[METRIC_INFO[metric].unitKey];
  const color = metricColor(metric, theme);

  const ranges: { key: RangeKey; label: string }[] = [
    { key: 'today', label: t.rangeToday },
    { key: 'week', label: t.rangeWeek },
    { key: 'month', label: t.rangeMonth },
  ];

  const show = (value: number | null) => (value === null ? '--' : String(value));

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={theme.tint}
              onRefresh={() => {
                setRefreshing(true);
                load().finally(() => setRefreshing(false));
              }}
            />
          }>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.wearable}
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.5 : 1 }]}>
            <Ionicons name="chevron-back" size={26} color={theme.tint} />
          </Pressable>

          <View style={styles.header}>
            <ThemedText type="largeTitle">{t.history}</ThemedText>
            <ThemedText type="subhead" themeColor="textSecondary">
              {t.historySubtitle}
            </ThemedText>
          </View>

          {/* Only worth choosing between metrics once more than one has data. */}
          {availableMetrics.length > 1 ? (
            <View style={styles.metricChips}>
              {availableMetrics.map(option => {
                const selected = option === metric;
                const info = METRIC_INFO[option];
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setMetric(option)}
                    style={[
                      styles.metricChip,
                      { borderColor: theme.separator },
                      selected && { backgroundColor: theme.tint, borderColor: theme.tint },
                    ]}>
                    <Text style={styles.metricChipEmoji}>{info.emoji}</Text>
                    <ThemedText
                      type="footnote"
                      style={{ color: selected ? theme.tintContrast : theme.textSecondary }}>
                      {t[info.labelKey]}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Range selector, styled after the iOS segmented control. */}
          <View style={[styles.segmented, { backgroundColor: theme.fill }]}>
            {ranges.map(option => {
              const selected = option.key === range;
              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setRange(option.key)}
                  style={[
                    styles.segment,
                    selected && { backgroundColor: theme.backgroundElement },
                  ]}>
                  <ThemedText
                    type="footnote"
                    style={{ color: selected ? theme.text : theme.textSecondary }}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={theme.tint} />
            </View>
          ) : error ? (
            <View style={[styles.banner, { backgroundColor: theme.fill, borderLeftColor: theme.danger }]}>
              <Ionicons name="warning" size={16} color={theme.danger} />
              <ThemedText type="footnote" style={styles.flex}>
                {error}
              </ThemedText>
            </View>
          ) : inRange.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="stats-chart-outline" size={30} color={theme.textTertiary} />
              <ThemedText type="body" themeColor="textSecondary">
                {t.noHistory}
              </ThemedText>
              <ThemedText type="footnote" themeColor="textTertiary" style={styles.centeredText}>
                {t.noHistoryHelp}
              </ThemedText>
            </Card>
          ) : (
            <>
              <Card style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartHeaderEmoji}>{METRIC_INFO[metric].emoji}</Text>
                  <ThemedText type="headline">{t[METRIC_INFO[metric].labelKey]}</ThemedText>
                </View>
                <HistoryChart points={points} color={color} />
              </Card>

              <View style={styles.statGrid}>
                <Card style={styles.statCard}>
                  <StatTile label={t.average} value={show(stats.average)} unit={unit} color={color} />
                </Card>
                <Card style={styles.statCard}>
                  <StatTile label={t.resting} value={show(stats.resting)} unit={unit} />
                </Card>
                <Card style={styles.statCard}>
                  <StatTile label={t.minimum} value={show(stats.minimum)} unit={unit} />
                </Card>
                <Card style={styles.statCard}>
                  <StatTile label={t.maximum} value={show(stats.maximum)} unit={unit} />
                </Card>
              </View>

              <Card style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <ThemedText type="subhead" themeColor="textSecondary">
                    {t.activeMinutes}
                  </ThemedText>
                  <ThemedText type="headline">{stats.activeMinutes}</ThemedText>
                </View>
              </Card>

              {contributors.length > 0 ? (
                <View style={styles.section}>
                  <ThemedText type="footnote" themeColor="textSecondary" style={styles.sectionHeader}>
                    {t.devices.toUpperCase()}
                  </ThemedText>
                  <Card>
                    {contributors.map((device, index) => (
                      <View key={device.id}>
                        <View style={styles.deviceRow}>
                          <View style={[styles.deviceIcon, { backgroundColor: theme.fill }]}>
                            <Ionicons name="watch-outline" size={18} color={theme.tint} />
                          </View>
                          <View style={styles.flex}>
                            <ThemedText type="body" numberOfLines={1}>
                              {device.name || t.unnamedDevice}
                            </ThemedText>
                            <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1}>
                              {device.id}
                            </ThemedText>
                          </View>
                        </View>
                        {index < contributors.length - 1 ? (
                          <View style={[styles.separator, { backgroundColor: theme.separator }]} />
                        ) : null}
                      </View>
                    ))}
                  </Card>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing.two,
    marginTop: Spacing.two,
  },
  header: { gap: Spacing.half },

  metricChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metricChipEmoji: { fontSize: 14 },

  segmented: { flexDirection: 'row', borderRadius: Radius.sm, padding: 2 },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.sm - 2,
  },

  centered: { paddingVertical: Spacing.six, alignItems: 'center' },
  centeredText: { textAlign: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderLeftWidth: 3,
  },
  emptyCard: { alignItems: 'center', gap: Spacing.two, padding: Spacing.five },

  chartCard: { padding: Spacing.three, gap: Spacing.two },
  chartHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  chartHeaderEmoji: { fontSize: 18 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  statCard: { flexGrow: 1, flexBasis: '47%', padding: Spacing.three },
  statTile: { gap: Spacing.half },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.one },

  summaryCard: { padding: Spacing.three },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  section: { gap: Spacing.two },
  sectionHeader: { marginLeft: Spacing.three, letterSpacing: 0.6 },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  deviceIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three },
});
