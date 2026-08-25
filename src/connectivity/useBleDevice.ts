import {useCallback, useEffect, useRef, useState} from 'react';
import {estimateCaloriesPerMinute} from './calories';
import {connectBleDevice, CustomMetricTarget, destroyBle, disconnectBleDevice, scanBleDevices, stopBleScan} from './bleService';
import {
  BleDeviceInfo,
  ConnectedDevice,
  ConnectionHistoryEntry,
  ConnectionStatus,
  DeviceCapabilities,
  DiscoverySource,
  MetricKey,
  MetricReading,
  SensorReading,
} from './types';

/** How many readings each device/metric keeps for its sparkline. */
const TRACE_LENGTH = 24;

const NO_CAPABILITIES: DeviceCapabilities = {heartRate: false, cadence: false, calories: false};

function emptyReadings(): Record<MetricKey, number | null> {
  return {heartRate: null, cadence: null, calories: null};
}

function emptyHistory(): Record<MetricKey, number[]> {
  return {heartRate: [], cadence: [], calories: []};
}

export function useBleDevice(
  onReading?: (reading: MetricReading) => void,
  customMetrics: CustomMetricTarget[] = [],
) {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [devices, setDevices] = useState<BleDeviceInfo[]>([]);
  // One entry per live connection. The BLE service already supports several
  // simultaneous connections (it keys them by id); this mirrors that shape so
  // readings never collapse into a single device's value.
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionHistory, setConnectionHistory] = useState<ConnectionHistoryEntry[]>([]);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);
  /** Names of devices just disconnected, shown briefly as confirmation. */
  const [disconnectedNames, setDisconnectedNames] = useState<string[]>([]);

  const callbackRef = useRef(onReading);
  callbackRef.current = onReading;
  // A ref rather than a connect() dependency, so a change to the configured
  // custom metrics never has to rebuild (and thus re-identity) the memoised
  // connect callback — it just takes effect on the next connection attempt.
  const customMetricsRef = useRef(customMetrics);
  customMetricsRef.current = customMetrics;

  // Mirrors of state for use inside long-lived BLE subscriptions, so those
  // closures never need rebuilding when the values change.
  const connectedIds = useRef(new Set<string>());
  /** Devices connected with a deliberate (caller-supplied) name this session. */
  const namedDevices = useRef(new Set<string>());
  const devicesRef = useRef<BleDeviceInfo[]>([]);
  devicesRef.current = devices;
  const connectedRef = useRef<ConnectedDevice[]>([]);
  connectedRef.current = connectedDevices;
  // Running sum/count per device, used to average heart rate for the calorie
  // estimate rather than reacting to every single noisy reading.
  const heartRateAccumulator = useRef(new Map<string, {sum: number; count: number}>());
  // Capabilities arrive mid-connection, before the device's entry exists in
  // connectedDevices — stashed here so the entry can be created with them
  // already in place instead of the connect/error-prone NO_CAPABILITIES.
  const pendingCapabilities = useRef(new Map<string, DeviceCapabilities>());

  useEffect(() => () => {
    stopBleScan();
    destroyBle();
    connectedIds.current.clear();
  }, []);

  /** Stamps the end of a session so its duration stops advancing. */
  const closeHistoryEntry = useCallback((deviceId?: string) => {
    const endedAt = Date.now();
    setConnectionHistory(current =>
      current.map(entry =>
        (deviceId === undefined || entry.id === deviceId) && entry.disconnectedAt === null
          ? {...entry, disconnectedAt: endedAt}
          : entry,
      ),
    );
  }, []);

  const scan = useCallback(async () => {
    setStatus('scanning');
    setError(null);
    try {
      setDevices(await scanBleDevices());
      setStatus(connectedIds.current.size ? 'connected' : 'idle');
    } catch (scanError) {
      setStatus('error');
      setError(scanError instanceof Error ? scanError.message : 'BLE scan failed');
    }
  }, []);

  // Every returned callback is memoised with a stable identity. Consumers put
  // these in effect dependency arrays (the connect sheet auto-connects on an
  // NFC tag read), and unstable identities there re-fire the effect on every
  // render — which previously produced a connect/fail/reconnect loop.
  const connect = useCallback(async (
    deviceId: string,
    via: DiscoverySource = 'bluetooth',
    /** Name supplied by the caller, e.g. read off an NFC tag. */
    nameHint?: string | null,
  ) => {
    // Ignore repeat requests for a device that is already wired up.
    if (connectedIds.current.has(deviceId)) return;
    setStatus('connecting');
    setError(null);
    setConnectingDeviceId(deviceId);
    heartRateAccumulator.current.delete(deviceId);
    pendingCapabilities.current.delete(deviceId);
    // A caller-supplied name is a deliberate choice (a stored override, or
    // one just confirmed in the naming prompt) — it must never be silently
    // replaced by a name resolved off the device later.
    if (nameHint) namedDevices.current.add(deviceId);
    else namedDevices.current.delete(deviceId);
    try {
      await connectBleDevice(
        deviceId,
        (reading: SensorReading) => {
          // Calories is derived, not read — recomputed from a running average
          // of heart rate each time a new heart-rate value lands. The
          // accumulator is a ref mutation, so it must happen outside the
          // state updater below, which React may invoke more than once.
          //
          // Two different numbers come out of this: `cumulativeCalories` is
          // "how much has this session burned so far", which is what the
          // live card shows — a satisfying running total. `rateCalories` is
          // "kcal per minute right now", which is what actually gets synced.
          // A cumulative counter cannot be meaningfully averaged or summed
          // across buckets (each later bucket's value already includes every
          // earlier one), so storing it would make History's stats — and any
          // attempt to total up calories burned over a range — nonsensical.
          // A rate can be averaged, peaked, and integrated over the stored
          // per-bucket duration to reconstruct a correct total.
          let cumulativeCalories: number | null = null;
          let rateCalories: number | null = null;
          if (reading.metric === 'heartRate') {
            const accumulator = heartRateAccumulator.current.get(reading.deviceId) ?? {sum: 0, count: 0};
            accumulator.sum += reading.value;
            accumulator.count += 1;
            heartRateAccumulator.current.set(reading.deviceId, accumulator);
            const averageHeartRate = accumulator.sum / accumulator.count;
            const elapsedMinutes = accumulator.count / 60;
            rateCalories = Math.round(estimateCaloriesPerMinute(averageHeartRate));
            cumulativeCalories = Math.round(estimateCaloriesPerMinute(averageHeartRate) * elapsedMinutes);
          }

          setConnectedDevices(current =>
            current.map(device => {
              if (device.id !== reading.deviceId) return device;

              const readings = {...device.readings, [reading.metric]: reading.value};
              const history = {
                ...device.history,
                // A metric id not seeded up front (a custom one) starts with no history yet.
                [reading.metric]: [...(device.history[reading.metric] ?? []), reading.value].slice(-TRACE_LENGTH),
              };

              if (cumulativeCalories !== null) {
                readings.calories = cumulativeCalories;
                history.calories = [...device.history.calories, cumulativeCalories].slice(-TRACE_LENGTH);
              }

              return {...device, readings, history, updatedAt: reading.timestamp};
            }),
          );

          callbackRef.current?.(reading);
          if (rateCalories !== null) {
            callbackRef.current?.({
              metric: 'calories',
              value: rateCalories,
              deviceId: reading.deviceId,
              timestamp: reading.timestamp,
            });
          }
        },
        connectError => {
          connectedIds.current.delete(deviceId);
          setConnectedDevices(current => current.filter(device => device.id !== deviceId));
          closeHistoryEntry(deviceId);
          setError(connectError.message);
          setStatus(connectedIds.current.size ? 'connected' : 'error');
        },
        resolvedName => {
          // A name read over GATT after connecting, for peripherals that do not
          // advertise one. Never overwrite a name the user deliberately chose.
          if (namedDevices.current.has(deviceId)) return;
          setConnectedDevices(current =>
            current.map(device =>
              device.id === deviceId ? {...device, name: resolvedName} : device,
            ),
          );
          setConnectionHistory(current =>
            current.map(entry => (entry.id === deviceId ? {...entry, name: resolvedName} : entry)),
          );
        },
        capabilities => {
          // This fires mid-connection, before the device below has been added
          // to state — stash it here as well so the entry starts correct
          // rather than waiting on this map to find a match that isn't there yet.
          pendingCapabilities.current.set(deviceId, capabilities);
          setConnectedDevices(current =>
            current.map(device => (device.id === deviceId ? {...device, capabilities} : device)),
          );
        },
        customMetricsRef.current,
      );

      connectedIds.current.add(deviceId);
      // A deliberate name (a stored override, or one just confirmed in the
      // naming prompt) always wins over whatever the peripheral advertised.
      // Null when neither is available — the UI supplies a translated
      // placeholder rather than baking English in here.
      const name =
        nameHint ?? devicesRef.current.find(device => device.id === deviceId)?.name ?? null;

      setConnectedDevices(current =>
        current.some(device => device.id === deviceId)
          ? current
          : [
              ...current,
              {
                id: deviceId,
                name,
                capabilities: pendingCapabilities.current.get(deviceId) ?? NO_CAPABILITIES,
                readings: emptyReadings(),
                history: emptyHistory(),
                updatedAt: null,
              },
            ],
      );
      setConnectionHistory(current => [
        {id: deviceId, name, connectedAt: Date.now(), disconnectedAt: null, via},
        ...current.filter(entry => entry.id !== deviceId),
      ].slice(0, 5));
      setStatus('connected');
    } catch (connectError) {
      setStatus('error');
      setError(connectError instanceof Error ? connectError.message : 'BLE connection failed');
    } finally {
      setConnectingDeviceId(null);
    }
  }, [closeHistoryEntry]);

  /** Renames an already-connected device — updates the live card immediately. */
  const renameDevice = useCallback((deviceId: string, name: string) => {
    // Marks it as deliberately named, same as a name supplied at connect
    // time, so a GATT-resolved name arriving later can't overwrite this.
    namedDevices.current.add(deviceId);
    setConnectedDevices(current =>
      current.map(device => (device.id === deviceId ? {...device, name} : device)),
    );
    setConnectionHistory(current =>
      current.map(entry => (entry.id === deviceId ? {...entry, name} : entry)),
    );
  }, []);

  /** Disconnects one device, or every device when no id is given. */
  const disconnect = useCallback((deviceId?: string) => {
    setStatus('disconnecting');

    // Capture names before the entries go, so the confirmation can say which
    // device it was. Read from the ref rather than inside the updater below —
    // a state updater must be pure, and setting other state from within one
    // triggers "state update on a component that hasn't mounted yet".
    const removed = deviceId
      ? connectedRef.current.filter(device => device.id === deviceId)
      : connectedRef.current;
    const names = removed.map(device => device.name || device.id);
    if (names.length > 0) setDisconnectedNames(names);

    setConnectedDevices(current =>
      deviceId ? current.filter(device => device.id !== deviceId) : [],
    );

    if (deviceId) {
      heartRateAccumulator.current.delete(deviceId);
      pendingCapabilities.current.delete(deviceId);
    } else {
      heartRateAccumulator.current.clear();
      pendingCapabilities.current.clear();
    }

    disconnectBleDevice(deviceId);
    closeHistoryEntry(deviceId);
    if (deviceId) connectedIds.current.delete(deviceId);
    else connectedIds.current.clear();

    setError(null);
    setStatus(connectedIds.current.size ? 'connected' : 'idle');
  }, [closeHistoryEntry]);

  /** Clears the disconnect confirmation after a moment. */
  useEffect(() => {
    if (disconnectedNames.length === 0) return;
    const timer = setTimeout(() => setDisconnectedNames([]), 4000);
    return () => clearTimeout(timer);
  }, [disconnectedNames]);

  /**
   * Errors clear themselves too. They describe a moment that has passed — a
   * scan that failed, a connection that dropped — so leaving one pinned to the
   * screen misrepresents the current state long after it stopped being true.
   */
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setError(null);
      // 'error' is a terminal status; once the message goes, reflect whatever
      // is actually connected now.
      setStatus(current => (current === 'error' ? (connectedIds.current.size ? 'connected' : 'idle') : current));
    }, 6000);
    return () => clearTimeout(timer);
  }, [error]);

  return {
    status,
    devices,
    connectingDeviceId,
    connectedDevices,
    connectedDeviceIds: connectedDevices.map(device => device.id),
    connectionHistory,
    disconnectedNames,
    error,
    scan,
    connect,
    disconnect,
    renameDevice,
  };
}
