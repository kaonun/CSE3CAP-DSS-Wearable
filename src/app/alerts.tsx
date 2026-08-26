import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Section } from '@/components/ui/surface';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { METRIC_ORDER, resolveMetricInfo, useMetricPreference } from '@/metrics';
import {
  isValidThreshold,
  thresholdLimitsFor,
  useAlertPreferences,
  type ThresholdDirection,
} from '@/alerts';

export default function AlertsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useI18n();
  const { customMetrics } = useMetricPreference();
  const { rules, setRule, removeRule } = useAlertPreferences();

  // Built-in metrics first, then whatever custom characteristics the user added.
  const metrics = useMemo(
    () => [...METRIC_ORDER, ...customMetrics.map(item => item.id)],
    [customMetrics],
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.settings}
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.5 : 1 }]}
          >
            <Ionicons name="chevron-back" size={26} color={theme.tint} />
          </Pressable>

          <View style={styles.header}>
            <ThemedText type="largeTitle">{t.alerts}</ThemedText>
            <ThemedText type="subhead" themeColor="textSecondary">
              {t.alertsSubtitle}
            </ThemedText>
          </View>

          <Section header={t.alertsThresholds} footer={t.alertsHelp}>
            {metrics.map((metric, index) => (
              <ThresholdEditor
                key={metric}
                metric={metric}
                last={index === metrics.length - 1}
                rule={rules[metric]}
                onChange={setRule}
                onRemove={removeRule}
              />
            ))}
          </Section>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

type EditorProps = {
  metric: string;
  last: boolean;
  rule: ReturnType<typeof useAlertPreferences>['rules'][string] | undefined;
  onChange: ReturnType<typeof useAlertPreferences>['setRule'];
  onRemove: ReturnType<typeof useAlertPreferences>['removeRule'];
};

function ThresholdEditor({ metric, last, rule, onChange, onRemove }: EditorProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const { customMetrics } = useMetricPreference();
  const info = resolveMetricInfo(metric, customMetrics, t);
  const limits = thresholdLimitsFor(metric);

  // Kept as text so a half-typed value is not coerced to 0 mid-edit.
  const [draft, setDraft] = useState(rule ? String(rule.value) : '');
  const parsed = Number(draft);
  const invalid = draft.trim() !== '' && !isValidThreshold(metric, parsed);

  const enabled = rule?.enabled ?? false;
  const direction: ThresholdDirection = rule?.direction ?? 'above';

  const commit = (nextDraft: string, nextDirection: ThresholdDirection, nextEnabled: boolean) => {
    const value = Number(nextDraft);
    if (nextDraft.trim() === '' || !isValidThreshold(metric, value)) {
      // Nothing valid to store — drop the rule rather than persisting a
      // threshold that could never fire.
      if (rule) onRemove(metric);
      return;
    }
    onChange({ metric, direction: nextDirection, value, enabled: nextEnabled });
  };

  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.separator }]}>
      <View style={styles.rowTop}>
        <ThemedText style={styles.emoji}>{info.emoji}</ThemedText>
        <View style={styles.labels}>
          <ThemedText type="body">{info.label}</ThemedText>
          <ThemedText type="footnote" themeColor="textSecondary">
            {info.unit ? `${limits.min}–${limits.max} ${info.unit}` : `${limits.min}–${limits.max}`}
          </ThemedText>
        </View>
        <Switch
          value={enabled}
          onValueChange={next => commit(draft, direction, next)}
          trackColor={{ true: theme.tint }}
          // A rule with no valid number cannot be armed.
          disabled={draft.trim() === '' || invalid}
        />
      </View>

      <View style={styles.controls}>
        <View style={styles.directions}>
          {(['above', 'below'] as const).map(option => {
            const active = direction === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                onPress={() => commit(draft, option, enabled)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.tint : 'transparent',
                    borderColor: active ? theme.tint : theme.separator,
                  },
                ]}
              >
                <ThemedText
                  type="footnote"
                  style={{ color: active ? theme.tintContrast : theme.textSecondary }}
                >
                  {option === 'above' ? t.alertAbove : t.alertBelow}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={draft}
          onChangeText={setDraft}
          onBlur={() => commit(draft, direction, enabled)}
          keyboardType="numeric"
          placeholder={t.alertValue}
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: theme.backgroundElement,
              borderColor: invalid ? theme.danger : theme.separator,
            },
          ]}
        />
      </View>

      {invalid ? (
        <ThemedText type="footnote" style={{ color: theme.danger }}>
          {t.alertOutOfRange.replace('{min}', String(limits.min)).replace('{max}', String(limits.max))}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
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
  row: { padding: Spacing.three, gap: Spacing.two },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  emoji: { fontSize: 22 },
  labels: { flex: 1, gap: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  directions: { flexDirection: 'row', gap: Spacing.one },
  chip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    textAlign: 'right',
  },
});
