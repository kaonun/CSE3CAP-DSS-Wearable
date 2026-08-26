import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';

import type { MetricReading } from '@/connectivity/types';
import { useReadingSync } from './use-reading-sync';
import { useThresholdAlerts } from './use-threshold-alerts';

type ReadingSyncValue = ReturnType<typeof useReadingSync>;

const ReadingSyncContext = createContext<ReadingSyncValue | null>(null);

/**
 * One instance shared across every screen, rather than one per screen.
 *
 * Readings are recorded here from the home screen (the only place BLE
 * connects), but History and the Data export button both need to force a
 * flush of whatever is still buffered before they read — otherwise a device
 * connected moments ago shows no data yet, since a bucket only writes itself
 * once its minute closes or something explicitly forces it out early.
 *
 * Threshold alerts are evaluated here too, by wrapping `record`. Every reading
 * already passes through it, so this is the one place that sees them all
 * without the sync layer needing to know that alerts exist.
 */
export function ReadingSyncProvider({ children }: { children: ReactNode }) {
  const sync = useReadingSync();
  const evaluateThresholds = useThresholdAlerts();

  const record = useCallback(
    (reading: MetricReading) => {
      sync.record(reading);
      evaluateThresholds(reading);
    },
    [sync, evaluateThresholds],
  );

  const value = useMemo<ReadingSyncValue>(() => ({ ...sync, record }), [sync, record]);

  return <ReadingSyncContext.Provider value={value}>{children}</ReadingSyncContext.Provider>;
}

export function useReadingSyncContext() {
  const value = useContext(ReadingSyncContext);
  if (!value) throw new Error('useReadingSyncContext must be used inside ReadingSyncProvider');
  return value;
}
