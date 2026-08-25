import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'dss.deviceNames';

type DeviceNamesValue = {
  /** A user-confirmed name for this device id, or null if it was never named. */
  getName: (deviceId: string) => string | null;
  setName: (deviceId: string, name: string) => void;
  loading: boolean;
};

const DeviceNamesContext = createContext<DeviceNamesValue | null>(null);

/**
 * Persists a user-chosen name per device id, so a device only has to be
 * named once — later connections reuse it silently rather than asking again.
 */
export function DeviceNamesProvider({ children }: { children: ReactNode }) {
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  // Reads must see a same-render write immediately (the naming prompt sets a
  // name and connects in the same action), so this mirrors state without
  // waiting for the next render.
  const namesRef = useRef(names);
  namesRef.current = names;

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(stored => {
        if (!active || !stored) return;
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object') setNames(parsed);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const getName = useCallback((deviceId: string) => namesRef.current[deviceId] ?? null, []);

  const setName = useCallback((deviceId: string, name: string) => {
    const next = { ...namesRef.current, [deviceId]: name };
    namesRef.current = next;
    setNames(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  return (
    <DeviceNamesContext.Provider value={{ getName, setName, loading }}>{children}</DeviceNamesContext.Provider>
  );
}

export function useDeviceNames() {
  const value = useContext(DeviceNamesContext);
  if (!value) throw new Error('useDeviceNames must be used inside DeviceNamesProvider');
  return value;
}
