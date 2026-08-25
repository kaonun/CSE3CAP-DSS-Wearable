import type { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { DeviceCapabilities, MetricKey } from '@/connectivity';
import {
  CUSTOM_METRIC_PREFIX,
  customMetricId,
  isCustomMetricId,
  normalizeCharacteristicUuid,
} from '@/connectivity/customMetric';
import type { ThemeColor } from '@/constants/theme';
import type { Messages } from '@/i18n';

export type { MetricKey };
export { isCustomMetricId };

/** Display order used everywhere the full built-in metric list is shown. */
export const METRIC_ORDER: readonly MetricKey[] = ['heartRate', 'cadence', 'calories'];

export const METRIC_INFO: Record<
  MetricKey,
  { emoji: string; labelKey: keyof Messages; unitKey: keyof Messages; derived?: boolean }
> = {
  heartRate: { emoji: '❤️', labelKey: 'metricHeartRate', unitKey: 'bpm' },
  cadence: { emoji: '👣', labelKey: 'metricCadence', unitKey: 'spm' },
  calories: { emoji: '🔥', labelKey: 'metricCalories', unitKey: 'kcal', derived: true },
};

/** A user-defined metric, identified by the BLE characteristic it reads. */
export type CustomMetricDef = {
  /** `custom:<full 128-bit uuid>` — this is what flows through readings/summaries as the metric id. */
  id: string;
  /** What the user actually typed (e.g. "0x2A37"), kept for display/editing. */
  rawId: string;
  /** User-given label. Falls back to rawId when left blank. */
  name: string;
};

/** There is no way to know what a custom characteristic represents, so it gets one neutral glyph. */
export const CUSTOM_METRIC_EMOJI = '📡';

export function metricIcon(metric: string): keyof typeof Ionicons.glyphMap {
  if (metric === 'heartRate') return 'heart';
  if (metric === 'cadence') return 'walk';
  if (metric === 'calories') return 'flame';
  return 'hardware-chip-outline';
}

/** Each built-in metric gets a signature colour; a custom one stays neutral since its meaning is unknown. */
export function metricColor(metric: string, theme: Record<ThemeColor, string>): string {
  if (metric === 'heartRate') return theme.danger;
  if (metric === 'cadence') return theme.tint;
  if (metric === 'calories') return theme.warning;
  return theme.textSecondary;
}

export type ResolvedMetricInfo = {
  emoji: string;
  label: string;
  unit: string;
  derived: boolean;
  custom: boolean;
};

/** Resolves a metric id — built-in or custom — into what the UI needs to display it. */
export function resolveMetricInfo(
  metricId: string,
  customMetrics: readonly CustomMetricDef[],
  t: Messages,
): ResolvedMetricInfo {
  if (metricId === 'heartRate' || metricId === 'cadence' || metricId === 'calories') {
    const info = METRIC_INFO[metricId];
    return { emoji: info.emoji, label: t[info.labelKey], unit: t[info.unitKey], derived: !!info.derived, custom: false };
  }
  const def = customMetrics.find(item => item.id === metricId);
  return {
    emoji: CUSTOM_METRIC_EMOJI,
    label: def?.name || def?.rawId || metricId,
    unit: '',
    derived: false,
    custom: true,
  };
}

const STORAGE_KEY = 'dss.metricPreference';

type StoredPreference = {
  mode: 'auto' | 'manual';
  /** Metric ids (built-in keys or `custom:<uuid>`) explicitly on, when mode is 'manual'. */
  enabled: string[];
  customMetrics: CustomMetricDef[];
};

const DEFAULT_PREFERENCE: StoredPreference = { mode: 'auto', enabled: [...METRIC_ORDER], customMetrics: [] };

function isCustomMetricDef(value: unknown): value is CustomMetricDef {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<CustomMetricDef>;
  return (
    typeof record.id === 'string' &&
    record.id.startsWith(CUSTOM_METRIC_PREFIX) &&
    typeof record.rawId === 'string' &&
    typeof record.name === 'string'
  );
}

function sanitize(value: unknown): StoredPreference {
  if (!value || typeof value !== 'object') return DEFAULT_PREFERENCE;
  const record = value as Partial<StoredPreference>;
  const mode = record.mode === 'manual' ? 'manual' : 'auto';
  const customMetrics = Array.isArray(record.customMetrics) ? record.customMetrics.filter(isCustomMetricDef) : [];
  const knownIds = new Set<string>([...METRIC_ORDER, ...customMetrics.map(item => item.id)]);
  const enabled = Array.isArray(record.enabled)
    ? record.enabled.filter((item): item is string => typeof item === 'string' && knownIds.has(item))
    : [...METRIC_ORDER];
  return { mode, enabled, customMetrics };
}

/** Which of a device's supported metrics should actually be shown, given the current preference. */
export function visibleMetrics(preference: StoredPreference, capabilities: DeviceCapabilities): string[] {
  const allIds = [...METRIC_ORDER, ...preference.customMetrics.map(item => item.id)];
  return allIds.filter(metric => {
    if (!capabilities[metric]) return false;
    return preference.mode === 'auto' || preference.enabled.includes(metric);
  });
}

export type AddCustomMetricResult = { ok: true } | { ok: false; error: 'invalid' | 'duplicate' };

type MetricPreferenceValue = {
  mode: 'auto' | 'manual';
  enabled: string[];
  customMetrics: CustomMetricDef[];
  loading: boolean;
  setAuto: () => void;
  toggleMetric: (metric: string) => void;
  visibleFor: (capabilities: DeviceCapabilities) => string[];
  addCustomMetric: (rawId: string, name: string) => AddCustomMetricResult;
  removeCustomMetric: (id: string) => void;
};

const MetricPreferenceContext = createContext<MetricPreferenceValue | null>(null);

export function MetricPreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<StoredPreference>(DEFAULT_PREFERENCE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(stored => {
        if (!active || !stored) return;
        setPreference(sanitize(JSON.parse(stored)));
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((next: StoredPreference) => {
    setPreference(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const setAuto = useCallback(() => {
    persist({ ...preference, mode: 'auto' });
  }, [persist, preference]);

  // Ticking an individual metric is always an explicit manual override.
  const toggleMetric = useCallback((metric: string) => {
    const enabled = preference.enabled.includes(metric)
      ? preference.enabled.filter(item => item !== metric)
      : [...preference.enabled, metric];
    persist({ ...preference, mode: 'manual', enabled });
  }, [persist, preference]);

  const addCustomMetric = useCallback((rawId: string, name: string): AddCustomMetricResult => {
    const normalized = normalizeCharacteristicUuid(rawId);
    if (!normalized) return { ok: false, error: 'invalid' };

    const id = customMetricId(normalized);
    if (preference.customMetrics.some(item => item.id === id)) return { ok: false, error: 'duplicate' };

    const def: CustomMetricDef = { id, rawId: rawId.trim(), name: name.trim() || rawId.trim() };
    persist({
      ...preference,
      customMetrics: [...preference.customMetrics, def],
      // A metric the user just added should show up immediately even in manual mode.
      enabled: [...preference.enabled, id],
    });
    return { ok: true };
  }, [persist, preference]);

  const removeCustomMetric = useCallback((id: string) => {
    persist({
      ...preference,
      customMetrics: preference.customMetrics.filter(item => item.id !== id),
      enabled: preference.enabled.filter(item => item !== id),
    });
  }, [persist, preference]);

  const value = useMemo<MetricPreferenceValue>(
    () => ({
      mode: preference.mode,
      enabled: preference.enabled,
      customMetrics: preference.customMetrics,
      loading,
      setAuto,
      toggleMetric,
      visibleFor: capabilities => visibleMetrics(preference, capabilities),
      addCustomMetric,
      removeCustomMetric,
    }),
    [preference, loading, setAuto, toggleMetric, addCustomMetric, removeCustomMetric],
  );

  return <MetricPreferenceContext.Provider value={value}>{children}</MetricPreferenceContext.Provider>;
}

export function useMetricPreference() {
  const value = useContext(MetricPreferenceContext);
  if (!value) throw new Error('useMetricPreference must be used inside MetricPreferenceProvider');
  return value;
}
