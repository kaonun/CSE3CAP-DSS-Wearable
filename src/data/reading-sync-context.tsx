import { createContext, useContext, type ReactNode } from 'react';

import { useReadingSync } from './use-reading-sync';

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
 */
export function ReadingSyncProvider({ children }: { children: ReactNode }) {
  const sync = useReadingSync();
  return <ReadingSyncContext.Provider value={sync}>{children}</ReadingSyncContext.Provider>;
}

export function useReadingSyncContext() {
  const value = useContext(ReadingSyncContext);
  if (!value) throw new Error('useReadingSyncContext must be used inside ReadingSyncProvider');
  return value;
}
