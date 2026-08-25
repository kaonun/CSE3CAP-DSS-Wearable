import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import type { DeviceCapabilities } from '@/connectivity';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { CUSTOM_METRIC_EMOJI, METRIC_ORDER, resolveMetricInfo, useMetricPreference } from '@/metrics';

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
  const { mode, enabled, customMetrics, setAuto, toggleMetric, addCustomMetric, removeCustomMetric } =
    useMetricPreference();
  const [addingCustom, setAddingCustom] = useState(false);
  const [customId, setCustomId] = useState('');
  const [customName, setCustomName] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  // With nothing connected yet there is nothing to grey out — the
  // preference is remembered for whatever connects next.
  const isSupported = (metric: string) => capabilities === null || !!capabilities[metric];

  const dismiss = () => {
    setAddingCustom(false);
    setCustomId('');
    setCustomName('');
    setCustomError(null);
    onClose();
  };

  const submitCustom = () => {
    const result = addCustomMetric(customId, customName);
    if (!result.ok) {
      setCustomError(result.error === 'duplicate' ? t.customMetricDuplicate : t.customMetricInvalidId);
      return;
    }
    setAddingCustom(false);
    setCustomId('');
    setCustomName('');
    setCustomError(null);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={dismiss}>
      <View style={[styles.sheet, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={[styles.toolbar, { borderBottomColor: theme.separator }]}>
            <ThemedText type="headline">{t.chooseMetrics}</ThemedText>
            <Pressable accessibilityRole="button" hitSlop={12} onPress={dismiss}>
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
                  supported={isSupported(metric)}
                  checked={mode === 'auto' ? isSupported(metric) : enabled.includes(metric)}
                  onPress={() => toggleMetric(metric)}
                  separator={index < METRIC_ORDER.length - 1}
                />
              ))}
            </View>

            <ThemedText type="footnote" themeColor="textSecondary" style={styles.sectionHeader}>
              {t.customMetrics.toUpperCase()}
            </ThemedText>
            <View style={[styles.card, Shadow.card, { backgroundColor: theme.backgroundElement }]}>
              {customMetrics.map(def => (
                <View key={def.id}>
                  <MetricRow
                    metric={def.id}
                    customMetrics={customMetrics}
                    supported={isSupported(def.id)}
                    checked={mode === 'auto' ? isSupported(def.id) : enabled.includes(def.id)}
                    onPress={() => toggleMetric(def.id)}
                    onRemove={() => removeCustomMetric(def.id)}
                    separator
                  />
                </View>
              ))}

              {addingCustom ? (
                <View style={styles.addForm}>
                  <TextField
                    value={customId}
                    onChangeText={value => {
                      setCustomId(value);
                      setCustomError(null);
                    }}
                    placeholder={t.customMetricIdLabel}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <ThemedText type="footnote" themeColor="textTertiary">
                    {t.customMetricIdHelp}
                  </ThemedText>
                  <TextField
                    value={customName}
                    onChangeText={setCustomName}
                    placeholder={t.customMetricNameLabel}
                    autoCapitalize="words"
                  />
                  {customError ? (
                    <ThemedText type="footnote" style={{ color: theme.danger }}>
                      {customError}
                    </ThemedText>
                  ) : null}
                  <View style={styles.addFormActions}>
                    <Button
                      label={t.cancel}
                      variant="plain"
                      block={false}
                      onPress={() => {
                        setAddingCustom(false);
                        setCustomId('');
                        setCustomName('');
                        setCustomError(null);
                      }}
                    />
                    <Button label={t.add} block={false} onPress={submitCustom} />
                  </View>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAddingCustom(true)}
                  style={({ pressed }) => [pressed && { backgroundColor: theme.backgroundSelected }]}>
                  <View style={styles.row}>
                    <Ionicons name="add-circle-outline" size={22} color={theme.tint} />
                    <ThemedText type="body" style={{ color: theme.tint }}>
                      {t.addCustomMetric}
                    </ThemedText>
                  </View>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function MetricRow({
  metric,
  customMetrics = [],
  supported,
  checked,
  onPress,
  onRemove,
  separator,
}: {
  metric: string;
  customMetrics?: { id: string; rawId: string; name: string }[];
  supported: boolean;
  checked: boolean;
  onPress: () => void;
  onRemove?: () => void;
  separator: boolean;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const info = resolveMetricInfo(metric, customMetrics, t);
  const emoji = info.custom ? CUSTOM_METRIC_EMOJI : info.emoji;

  const body = (
    <View style={styles.row}>
      <Text style={[styles.emoji, !supported && styles.dimmed]}>{emoji}</Text>
      <View style={styles.rowLabels}>
        <ThemedText type="body" themeColor={supported ? 'text' : 'textTertiary'} numberOfLines={1}>
          {info.label}
        </ThemedText>
        <ThemedText type="footnote" themeColor="textSecondary">
          {supported ? info.unit || undefined : t.metricUnavailable}
        </ThemedText>
      </View>
      {checked && supported ? <Ionicons name="checkmark" size={20} color={theme.tint} /> : null}
      {onRemove ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onRemove} style={styles.removeCustom}>
          <Ionicons name="trash-outline" size={18} color={theme.textTertiary} />
        </Pressable>
      ) : null}
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
  list: { padding: Spacing.three, gap: Spacing.two },
  card: { borderRadius: Radius.lg, overflow: 'hidden' },
  sectionHeader: { marginLeft: Spacing.three, marginTop: Spacing.two, letterSpacing: 0.6 },
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
  removeCustom: { padding: Spacing.one },
  addForm: { padding: Spacing.three, gap: Spacing.two },
  addFormActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
});
