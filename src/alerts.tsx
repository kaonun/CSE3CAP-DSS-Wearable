import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'dss.alertThresholds';
/** Remembers that the "set up alerts?" offer was already made, so it is offered once. */
const PROMPT_KEY = 'dss.alertPromptSeen';

export type ThresholdDirection = 'above' | 'below';

export type ThresholdRule = {
  /** Metric id — built-in ('heartRate') or custom ('custom:<uuid>'). */
  metric: string;
  direction: ThresholdDirection;
  value: number;
  enabled: boolean;
};

export type ThresholdRules = Record<string, ThresholdRule>;

/**
 * Bounds mirror the Firestore rules in firestore.rules — a threshold outside
 * the range a metric can legitimately report could never fire, so there is no
 * point letting one be saved.
 */
export const THRESHOLD_LIMITS: Record<string, { min: number; max: number }> = {
  heartRate: { min: 1, max: 300 },
  cadence: { min: 0, max: 254 },
  calories: { min: 0, max: 100 },
};

const CUSTOM_LIMIT = { min: 0, max: 1_000_000 };

export function thresholdLimitsFor(metric: string): { min: number; max: number } {
  return THRESHOLD_LIMITS[metric] ?? CUSTOM_LIMIT;
}

export function isValidThreshold(metric: string, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const { min, max } = thresholdLimitsFor(metric);
  return value >= min && value <= max;
}

function isDirection(value: unknown): value is ThresholdDirection {
  return value === 'above' || value === 'below';
}

/** Drops anything malformed rather than letting one bad entry break the screen. */
function parseRules(raw: string | null): ThresholdRules {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const rules: ThresholdRules = {};
    for (const [metric, entry] of Object.entries(parsed as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object') continue;
      const candidate = entry as Partial<ThresholdRule>;
      if (typeof candidate.value !== 'number' || !Number.isFinite(candidate.value)) continue;
      if (!isDirection(candidate.direction)) continue;
      rules[metric] = {
        metric,
        direction: candidate.direction,
        value: candidate.value,
        enabled: candidate.enabled !== false,
      };
    }
    return rules;
  } catch {
    return {};
  }
}

type AlertPreferenceValue = {
  rules: ThresholdRules;
  /** Rules that are both enabled and currently valid — what actually fires. */
  activeRules: ThresholdRule[];
  setRule: (rule: ThresholdRule) => void;
  removeRule: (metric: string) => void;
  /** Whether the one-time "set up alerts?" offer has already been shown. */
  promptSeen: boolean;
  markPromptSeen: () => void;
  loading: boolean;
};

const AlertPreferenceContext = createContext<AlertPreferenceValue | null>(null);

export function AlertPreferenceProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<ThresholdRules>({});
  const [promptSeen, setPromptSeen] = useState(true); // assume seen until storage says otherwise
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(PROMPT_KEY)])
      .then(([storedRules, storedPrompt]) => {
        if (!active) return;
        setRules(parseRules(storedRules));
        setPromptSeen(storedPrompt === 'true');
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const markPromptSeen = useCallback(() => {
    setPromptSeen(true);
    void AsyncStorage.setItem(PROMPT_KEY, 'true').catch(() => undefined);
  }, []);

  const setRule = useCallback((rule: ThresholdRule) => {
    setRules(current => {
      const next = { ...current, [rule.metric]: rule };
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const removeRule = useCallback((metric: string) => {
    setRules(current => {
      const next = { ...current };
      delete next[metric];
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const activeRules = useMemo(
    () => Object.values(rules).filter(rule => rule.enabled && isValidThreshold(rule.metric, rule.value)),
    [rules],
  );

  const value = useMemo<AlertPreferenceValue>(
    () => ({ rules, activeRules, setRule, removeRule, promptSeen, markPromptSeen, loading }),
    [rules, activeRules, setRule, removeRule, promptSeen, markPromptSeen, loading],
  );

  return <AlertPreferenceContext.Provider value={value}>{children}</AlertPreferenceContext.Provider>;
}

export function useAlertPreferences() {
  const value = useContext(AlertPreferenceContext);
  if (!value) throw new Error('useAlertPreferences must be used inside AlertPreferenceProvider');
  return value;
}
