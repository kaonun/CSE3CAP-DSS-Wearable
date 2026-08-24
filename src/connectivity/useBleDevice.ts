import {useCallback, useEffect, useRef, useState} from 'react';
import {connectBleDevice, destroyBle, disconnectBleDevice, scanBleDevices, stopBleScan} from './bleService';
import {BleDeviceInfo, BleReadingHandler, ConnectionHistoryEntry, ConnectionStatus, SensorReading} from './types';

export function useBleDevice(onReading?: BleReadingHandler) {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [devices, setDevices] = useState<BleDeviceInfo[]>([]);
  const [connectedDeviceIds, setConnectedDeviceIds] = useState<string[]>([]);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [heartRateHistory, setHeartRateHistory] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionHistory, setConnectionHistory] = useState<ConnectionHistoryEntry[]>([]);
  const [connectingDeviceId, setConnectingDeviceId] = useState<string | null>(null);

  const callbackRef = useRef(onReading);
  callbackRef.current = onReading;

  // Mirrors of state for use inside callbacks and long-lived BLE subscriptions,
  // so those closures never need to be rebuilt when the values change.
  const connectedIds = useRef(new Set<string>());
  const devicesRef = useRef<BleDeviceInfo[]>([]);
  devicesRef.current = devices;

  useEffect(() => () => {
    stopBleScan();
    destroyBle();
    connectedIds.current.clear();
  }, []);

  /** Publishes the connected-id set to state and clears readings when empty. */
  const publishConnected = useCallback(() => {
    const ids = Array.from(connectedIds.current);
    setConnectedDeviceIds(ids);
    if (ids.length === 0) {
      setHeartRate(null);
      setHeartRateHistory([]);
    }
    return ids;
  }, []);

  // Every returned callback is memoised with a stable identity. Consumers put
  // these in effect dependency arrays (the connect sheet auto-connects on an
  // NFC tag read), and unstable identities there re-fire the effect on every
  // render — which previously produced a connect/fail/reconnect loop.
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

  const connect = useCallback(async (deviceId: string) => {
    // Ignore repeat requests for a device that is already wired up or in flight.
    if (connectedIds.current.has(deviceId)) return;
    setStatus('connecting');
    setError(null);
    setConnectingDeviceId(deviceId);
    try {
      await connectBleDevice(deviceId, (reading: SensorReading) => {
        if (reading.metric === 'heartRate') {
          setHeartRate(reading.value);
          setHeartRateHistory(current => [...current, reading.value].slice(-24));
        }
        callbackRef.current?.(reading);
      }, connectError => {
        connectedIds.current.delete(deviceId);
        const remaining = publishConnected();
        setError(connectError.message);
        setStatus(remaining.length ? 'connected' : 'error');
      });
      connectedIds.current.add(deviceId);
      publishConnected();
      setConnectionHistory(current => [
        {
          id: deviceId,
          // Null when the peripheral never advertised a name; the UI supplies
          // a translated placeholder rather than baking English in here.
          name: devicesRef.current.find(device => device.id === deviceId)?.name ?? null,
          connectedAt: Date.now(),
        },
        ...current.filter(entry => entry.id !== deviceId),
      ].slice(0, 5));
      setStatus('connected');
    } catch (connectError) {
      setStatus('error');
      setError(connectError instanceof Error ? connectError.message : 'BLE connection failed');
    } finally {
      setConnectingDeviceId(null);
    }
  }, [publishConnected]);

  const disconnect = useCallback((deviceId?: string) => {
    setStatus('disconnecting');
    disconnectBleDevice(deviceId);
    if (deviceId) connectedIds.current.delete(deviceId);
    else connectedIds.current.clear();
    const remaining = publishConnected();
    setError(null);
    setStatus(remaining.length ? 'connected' : 'idle');
  }, [publishConnected]);

  return {
    status,
    devices,
    connectingDeviceId,
    connectedDeviceIds,
    connectionHistory,
    heartRate,
    heartRateHistory,
    error,
    scan,
    connect,
    disconnect,
  };
}
