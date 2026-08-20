import {useEffect, useRef, useState} from 'react';
import {connectBleDevice, destroyBle, disconnectBleDevice, scanBleDevices, stopBleScan} from './bleService';
import {BleDeviceInfo, BleReadingHandler, ConnectionHistoryEntry, ConnectionStatus, SensorReading} from './types';

export function useBleDevice(onReading?: BleReadingHandler) {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [devices, setDevices] = useState<BleDeviceInfo[]>([]);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [heartRateHistory, setHeartRateHistory] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionHistory, setConnectionHistory] = useState<ConnectionHistoryEntry[]>([]);
  const callbackRef = useRef(onReading);
  const connectedIds = useRef(new Set<string>());
  callbackRef.current = onReading;

  useEffect(() => () => {
    stopBleScan();
    destroyBle();
    connectedIds.current.clear();
  }, []);

  const scan = async () => {
    setStatus('scanning'); setError(null);
    try { setDevices(await scanBleDevices()); setStatus(connectedIds.current.size ? 'connected' : 'idle'); }
    catch (scanError) { setStatus('error'); setError(scanError instanceof Error ? scanError.message : 'BLE scan failed'); }
  };

  const connect = async (deviceId: string) => {
    setStatus('connecting'); setError(null);
    try {
      await connectBleDevice(deviceId, (reading: SensorReading) => {
        if (reading.metric === 'heartRate') {
          setHeartRate(reading.value);
          setHeartRateHistory(current => [...current, reading.value].slice(-24));
        }
        callbackRef.current?.(reading);
      }, connectError => {
        connectedIds.current.delete(deviceId);
        if (connectedIds.current.size === 0) {
          setHeartRate(null);
          setHeartRateHistory([]);
        }
        setError(connectError.message);
        setStatus(connectedIds.current.size ? 'connected' : 'error');
      });
      connectedIds.current.add(deviceId);
      setConnectionHistory(current => [
        {
          id: deviceId,
          name: devices.find(device => device.id === deviceId)?.name || 'Wearable',
          connectedAt: Date.now(),
        },
        ...current.filter(entry => entry.id !== deviceId),
      ].slice(0, 5));
      setStatus('connected');
    } catch (connectError) { setStatus('error'); setError(connectError instanceof Error ? connectError.message : 'BLE connection failed'); }
  };

  const disconnect = (deviceId?: string) => {
    setStatus('disconnecting'); disconnectBleDevice(deviceId);
    if (deviceId) connectedIds.current.delete(deviceId); else connectedIds.current.clear();
    if (connectedIds.current.size === 0) {
      setHeartRate(null);
      setHeartRateHistory([]);
    }
    setStatus(connectedIds.current.size ? 'connected' : 'idle');
  };

  return {
    status,
    devices,
    connectedDeviceIds: Array.from(connectedIds.current),
    connectionHistory,
    heartRate,
    heartRateHistory,
    error,
    scan,
    connect,
    disconnect,
  };
}
