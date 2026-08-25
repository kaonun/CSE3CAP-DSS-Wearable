import type { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { DeviceCapabilities, MetricKey } from '@/connectivity';
import type { ThemeColor } from '@/constants/theme';
import type { Messages } from '@/i18n';

export type { MetricKey };

/** Display order used everywhere the full metric list is shown. */
export const METRIC_ORDER: readonly MetricKey[] = ['heartRate', 'cadence', 'calories'];

export const METRIC_INFO: Record<
  MetricKey,
  { emoji: string; labelKey: keyof Messages; unitKey: keyof Messages; derived?: boolean }
> = {
  heartRate: { emoji: '❤️', labelKey: 'metricHeartRate', unitKey: 'bpm' },
  cadence: { emoji: '👣', labelKey: 'metricCadence', unitKey: 'spm' },
  calories: { emoji: '🔥', labelKey: 'metricCalories', unitKey: 'kcal', derived: true },
};

export function metricIcon(metric: MetricKey): keyof typeof Ionicons.glyphMap {
  if (metric === 'heartRate') return 'heart';
  if (metric === 'cadence') return 'walk';
  return 'flame';
}

/** Each metric gets a signature colour rather than a flat neutral grey. */
export function metricColor(metric: MetricKey, theme: Record<ThemeColor, string>): string {
  if (metric === 'heartRate') return theme.danger;
  if (metric === 'cadence') return theme.tint;
  return theme.warning;
}

const STORAGE_KEY = 'dss.metricPreference';

type StoredPreference = {
  mode: 'auto' | 'manual';
  enabled: MetricKey[];
};

const DEFAULT_PREFERENCE: StoredPreference = { mode: 'auto', enabled: [...METRIC_ORDER] };

function isMetricKey(value: unknown): value is MetricKey {
  return typeof value === 'string' && (METRIC_ORDER as string[]).includes(value);
}

function sanitize(value: unknown): StoredPreference {
  if (!value || typeof value !== 'object') return DEFAULT_PREFERENCE;
  const record = value as Partial<StoredPreference>;
  const mode = record.mode === 'manual' ? 'manual' : 'auto';
  const enabled = Array.isArray(record.enabled) ? record.enabled.filter(isMetricKey) : DEFAULT_PREFERENCE.enabled;
  return { mode, enabled };
}

/** Which of a device's supported metrics should actually be shown, given the current preference. */
export function visibleMetrics(preference: StoredPreference, capabilities: DeviceCapabilities): MetricKey[] {
  return METRIC_ORDER.filter(metric => {
    if (!capabilities[metric]) return false;
    return preference.mode === 'auto' || preference.enabled.includes(metric);
  });
}

type MetricPreferenceValue = {
  mode: 'auto' | 'manual';
  enabled: MetricKey[];
  loading: boolean;
  setAuto: () => void;
  toggleMetric: (metric: MetricKey) => void;
  visibleFor: (capabilities: DeviceCapabilities) => MetricKey[];
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
  const toggleMetric = useCallback((metric: MetricKey) => {
    const enabled = preference.enabled.includes(metric)
      ? preference.enabled.filter(item => item !== metric)
      : [...preference.enabled, metric];
    persist({ mode: 'manual', enabled });
  }, [persist, preference]);

  const value = useMemo<MetricPreferenceValue>(
    () => ({
      mode: preference.mode,
      enabled: preference.enabled,
      loading,
      setAuto,
      toggleMetric,
      visibleFor: capabilities => visibleMetrics(preference, capabilities),
    }),
    [preference, loading, setAuto, toggleMetric],
  );

  return <MetricPreferenceContext.Provider value={value}>{children}</MetricPreferenceContext.Provider>;
}

export function useMetricPreference() {
  const value = useContext(MetricPreferenceContext);
  if (!value) throw new Error('useMetricPreference must be used inside MetricPreferenceProvider');
  return value;
}
