import {useCallback, useEffect, useRef, useState} from 'react';
import {connectBleDevice, destroyBle, disconnectBleDevice, scanBleDevices, stopBleScan} from './bleService';
import {
  BleDeviceInfo,
  BleReadingHandler,
  ConnectedDevice,
  ConnectionHistoryEntry,
  ConnectionStatus,
  SensorReading,
} from './types';

/** How many readings each device keeps for its sparkline. */
const TRACE_LENGTH = 24;

export function useBleDevice(onReading?: BleReadingHandler) {
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

  // Mirrors of state for use inside long-lived BLE subscriptions, so those
  // closures never need rebuilding when the values change.
  const connectedIds = useRef(new Set<string>());
  const devicesRef = useRef<BleDeviceInfo[]>([]);
  devicesRef.current = devices;

  useEffect(() => () => {
    stopBleScan();
    destroyBle();
    connectedIds.current.clear();
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
  const connect = useCallback(async (deviceId: string) => {
    // Ignore repeat requests for a device that is already wired up.
    if (connectedIds.current.has(deviceId)) return;
    setStatus('connecting');
    setError(null);
    setConnectingDeviceId(deviceId);
    try {
      await connectBleDevice(deviceId, (reading: SensorReading) => {
        if (reading.metric === 'heartRate') {
          setConnectedDevices(current =>
            current.map(device =>
              device.id === reading.deviceId
                ? {
                    ...device,
                    heartRate: reading.value,
                    history: [...device.history, reading.value].slice(-TRACE_LENGTH),
                    updatedAt: reading.timestamp,
                  }
                : device,
            ),
          );
        }
        callbackRef.current?.(reading);
      }, connectError => {
        connectedIds.current.delete(deviceId);
        setConnectedDevices(current => current.filter(device => device.id !== deviceId));
        setError(connectError.message);
        setStatus(connectedIds.current.size ? 'connected' : 'error');
      }, resolvedName => {
        // A name read over GATT after connecting, for peripherals that do not
        // advertise one. Update both the live card and the history entry.
        setConnectedDevices(current =>
          current.map(device =>
            device.id === deviceId ? {...device, name: resolvedName} : device,
          ),
        );
        setConnectionHistory(current =>
          current.map(entry => (entry.id === deviceId ? {...entry, name: resolvedName} : entry)),
        );
      });

      connectedIds.current.add(deviceId);
      // Null name when the peripheral never advertised one, or when the device
      // came from an NFC tag and was never in a scan result. The UI supplies a
      // translated placeholder rather than baking English in here.
      const name = devicesRef.current.find(device => device.id === deviceId)?.name ?? null;

      setConnectedDevices(current =>
        current.some(device => device.id === deviceId)
          ? current
          : [...current, {id: deviceId, name, heartRate: null, history: [], updatedAt: null}],
      );
      setConnectionHistory(current => [
        {id: deviceId, name, connectedAt: Date.now()},
        ...current.filter(entry => entry.id !== deviceId),
      ].slice(0, 5));
      setStatus('connected');
    } catch (connectError) {
      setStatus('error');
      setError(connectError instanceof Error ? connectError.message : 'BLE connection failed');
    } finally {
      setConnectingDeviceId(null);
    }
  }, []);

  /** Disconnects one device, or every device when no id is given. */
  const disconnect = useCallback((deviceId?: string) => {
    setStatus('disconnecting');

    // Capture names before the entries are removed, so the confirmation can
    // say which device it was.
    setConnectedDevices(current => {
      const removed = deviceId ? current.filter(device => device.id === deviceId) : current;
      const names = removed.map(device => device.name || device.id);
      if (names.length > 0) setDisconnectedNames(names);
      return deviceId ? current.filter(device => device.id !== deviceId) : [];
    });

    disconnectBleDevice(deviceId);
    if (deviceId) connectedIds.current.delete(deviceId);
    else connectedIds.current.clear();

    setError(null);
    setStatus(connectedIds.current.size ? 'connected' : 'idle');
  }, []);

  /** Clears the disconnect confirmation after a moment. */
  useEffect(() => {
    if (disconnectedNames.length === 0) return;
    const timer = setTimeout(() => setDisconnectedNames([]), 4000);
    return () => clearTimeout(timer);
  }, [disconnectedNames]);

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
  };
}
