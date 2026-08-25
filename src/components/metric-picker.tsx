import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import type { DeviceCapabilities } from '@/connectivity';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { METRIC_INFO, METRIC_ORDER, useMetricPreference, type MetricKey } from '@/metrics';

/**
 * Which metrics can currently be turned on. With nothing connected yet there
 * is nothing to grey out — the preference is remembered for the next device.
 */
const ALL_SUPPORTED: DeviceCapabilities = { heartRate: true, cadence: true, calories: true };

export function MetricPicker({
  visible,
  onClose,
  capabilities,
}: {
  visible: boolean;
  onClose: () => void;
  /** Union of what currently-connected devices support; null when nothing is connected. */
  capabilities: DeviceCapabilities | null;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const { mode, enabled, setAuto, toggleMetric } = useMetricPreference();
  const effectiveCapabilities = capabilities ?? ALL_SUPPORTED;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={[styles.toolbar, { borderBottomColor: theme.separator }]}>
            <ThemedText type="headline">{t.chooseMetrics}</ThemedText>
            <Pressable accessibilityRole="button" hitSlop={12} onPress={onClose}>
              <ThemedText type="body" style={{ color: theme.tint }}>
                {t.done}
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            <View style={[styles.card, Shadow.card, { backgroundColor: theme.backgroundElement }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'auto' }}
                onPress={setAuto}
                style={({ pressed }) => [pressed && { backgroundColor: theme.backgroundSelected }]}>
                <View style={styles.row}>
                  <Text style={styles.emoji}>✨</Text>
                  <View style={styles.rowLabels}>
                    <ThemedText type="body">{t.autoRecommended}</ThemedText>
                    <ThemedText type="footnote" themeColor="textSecondary">
                      {t.autoRecommendedHelp}
                    </ThemedText>
                  </View>
                  {mode === 'auto' ? <Ionicons name="checkmark" size={20} color={theme.tint} /> : null}
                </View>
              </Pressable>
              <View style={[styles.separator, { backgroundColor: theme.separator }]} />

              {METRIC_ORDER.map((metric, index) => (
                <MetricRow
                  key={metric}
                  metric={metric}
                  supported={effectiveCapabilities[metric]}
                  checked={mode === 'auto' ? effectiveCapabilities[metric] : enabled.includes(metric)}
                  onPress={() => toggleMetric(metric)}
                  separator={index < METRIC_ORDER.length - 1}
                />
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function MetricRow({
  metric,
  supported,
  checked,
  onPress,
  separator,
}: {
  metric: MetricKey;
  supported: boolean;
  checked: boolean;
  onPress: () => void;
  separator: boolean;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const info = METRIC_INFO[metric];

  const body = (
    <View style={styles.row}>
      <Text style={[styles.emoji, !supported && styles.dimmed]}>{info.emoji}</Text>
      <View style={styles.rowLabels}>
        <ThemedText type="body" themeColor={supported ? 'text' : 'textTertiary'}>
          {t[info.labelKey]}
        </ThemedText>
        <ThemedText type="footnote" themeColor="textSecondary">
          {supported ? t[info.unitKey] : t.metricUnavailable}
        </ThemedText>
      </View>
      {checked && supported ? <Ionicons name="checkmark" size={20} color={theme.tint} /> : null}
    </View>
  );

  return (
    <View>
      {supported ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: checked }}
          onPress={onPress}
          style={({ pressed }) => [pressed && { backgroundColor: theme.backgroundSelected }]}>
          {body}
        </Pressable>
      ) : (
        body
      )}
      {separator ? <View style={[styles.separator, { backgroundColor: theme.separator }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  safeArea: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  list: { padding: Spacing.three },
  card: { borderRadius: Radius.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  emoji: { fontSize: 22 },
  dimmed: { opacity: 0.35 },
  rowLabels: { flex: 1, gap: 1 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three },
});
