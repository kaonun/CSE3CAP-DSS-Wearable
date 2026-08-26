import { useCallback, useEffect, useRef } from 'react';

import { useAlertPreferences, type ThresholdRule } from '@/alerts';
import { useI18n } from '@/i18n';
import { useMetricPreference, resolveMetricInfo } from '@/metrics';
import { configureNotifications, ensureNotificationPermission, presentThresholdAlert } from '@/notifications';
import type { MetricReading } from '@/connectivity/types';

/**
 * A metric that sits past its threshold reports every second or so. Firing on
 * each of those would bury the phone, so an alert is *edge*-triggered: it
 * fires on the reading that crosses the line, then stays silent until the
 * metric has come back within range.
 *
 * The cooldown is a second, independent guard for a value hovering exactly on
 * the boundary, which would otherwise cross back and forth continuously.
 */
// Secondary guard only. Hysteresis below does the real work of stopping
// repeat alerts, so this can be short enough that a genuine second episode
// still gets through rather than being silently swallowed.
const COOLDOWN_MS = 2 * 60 * 1000;

/**
 * How far back inside the limit a reading must come before the alert re-arms.
 *
 * Without this, a metric hovering on the boundary (81, 79, 82, 78 …) clears the
 * breach on every dip and re-alerts on every rise — the classic flapping
 * problem. Re-arming only after a real recovery means one alert per genuine
 * episode. 5% of the threshold scales sensibly across metrics (4 bpm at 80,
 * 1 kcal/min at 20) with a floor so small thresholds still get a usable band.
 */
const HYSTERESIS_FRACTION = 0.05;
const HYSTERESIS_MIN = 1;

function hysteresisFor(rule: ThresholdRule): number {
  return Math.max(HYSTERESIS_MIN, Math.abs(rule.value) * HYSTERESIS_FRACTION);
}

function breaches(rule: ThresholdRule, value: number): boolean {
  return rule.direction === 'above' ? value > rule.value : value < rule.value;
}

/**
 * Whether a reading has recovered far enough past the threshold to re-arm.
 * Deliberately stricter than simply "no longer breaching".
 */
function hasRecovered(rule: ThresholdRule, value: number): boolean {
  const band = hysteresisFor(rule);
  return rule.direction === 'above' ? value <= rule.value - band : value >= rule.value + band;
}

export function useThresholdAlerts() {
  const { activeRules } = useAlertPreferences();
  const { customMetrics } = useMetricPreference();
  const { t } = useI18n();

  // Read through refs so `evaluate` keeps a stable identity — it is handed to
  // useBleDevice, and a changing callback there would tear down live
  // characteristic subscriptions on every preference edit.
  const rulesRef = useRef(activeRules);
  const customRef = useRef(customMetrics);
  const messagesRef = useRef(t);

  rulesRef.current = activeRules;
  customRef.current = customMetrics;
  messagesRef.current = t;

  /** Metrics currently past their threshold, so we only alert on the crossing. */
  const breaching = useRef(new Set<string>());
  const lastAlertAt = useRef(new Map<string, number>());
  const permission = useRef<boolean | null>(null);

  useEffect(() => {
    void configureNotifications();
  }, []);

  // Drop remembered state for rules that were switched off or deleted,
  // otherwise re-enabling one leaves it wrongly marked as already breaching
  // and the next crossing is swallowed.
  useEffect(() => {
    const live = new Set(activeRules.map(rule => rule.metric));
    for (const metric of [...breaching.current]) {
      if (!live.has(metric)) breaching.current.delete(metric);
    }
    for (const metric of [...lastAlertAt.current.keys()]) {
      if (!live.has(metric)) lastAlertAt.current.delete(metric);
    }
  }, [activeRules]);

  const evaluate = useCallback((reading: MetricReading) => {
    const rule = rulesRef.current.find(item => item.metric === reading.metric);
    if (!rule) return;

    if (!breaches(rule, reading.value)) {
      // Only re-arm once the reading has recovered past the hysteresis band.
      // Merely dipping back over the line is not enough — that is what made a
      // value hovering on the boundary alert over and over.
      if (hasRecovered(rule, reading.value)) breaching.current.delete(rule.metric);
      return;
    }

    if (breaching.current.has(rule.metric)) return;
    breaching.current.add(rule.metric);

    const now = Date.now();
    const previous = lastAlertAt.current.get(rule.metric);
    if (previous !== undefined && now - previous < COOLDOWN_MS) return;
    lastAlertAt.current.set(rule.metric, now);

    const messages = messagesRef.current;
    const info = resolveMetricInfo(rule.metric, customRef.current, messages);
    const unit = info.unit ? ` ${info.unit}` : '';
    const body = (rule.direction === 'above' ? messages.alertBodyAbove : messages.alertBodyBelow)
      .replace('{metric}', info.label)
      .replace('{value}', `${Math.round(reading.value)}${unit}`)
      .replace('{threshold}', `${rule.value}${unit}`);

    // Fire-and-forget: a notification must never delay or break recording.
    void (async () => {
      if (permission.current === null) permission.current = await ensureNotificationPermission();
      if (!permission.current) return;
      await presentThresholdAlert(`${info.emoji} ${messages.alertTitle}`, body);
    })();
  }, []);

  return evaluate;
}
