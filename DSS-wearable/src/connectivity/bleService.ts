import {Platform} from 'react-native';
import {requestBlePermissions} from './permissions';
import {decodeHeartRateMeasurement, HEART_RATE_MEASUREMENT_UUID, HEART_RATE_SERVICE_UUID} from './heartRate';
import {mockConnect, mockDisconnect, mockScan} from './mock';
import {BleDeviceInfo, BleReadingHandler} from './types';

type ErrorHandler = (error: Error) => void;

type BleManagerLike = {
  state: () => Promise<string>;
  startDeviceScan: (uuids: string[] | null, options: object | null, listener: (error: Error | null, device: {id: string; name?: string | null} | null) => void) => void;
  stopDeviceScan: () => void;
  connectToDevice: (id: string) => Promise<{discoverAllServicesAndCharacteristics: () => Promise<unknown>; cancelConnection: () => Promise<unknown>; monitorCharacteristicForService: (service: string, characteristic: string, listener: (error: Error | null, characteristic: {value?: string | null} | null) => void) => {remove: () => void}; onDisconnected: (listener: (error: Error | null) => void) => {remove: () => void}}>;
  destroy: () => void;
};

const isMockMode = process.env.EXPO_PUBLIC_CONNECTIVITY_MOCK === 'true';
const connections = new Map<string, {device: {cancelConnection: () => Promise<unknown>}; remove: () => void}>();
let manager: BleManagerLike | undefined;
let stopActiveScan: (() => void) | undefined;

function getManager(): BleManagerLike {
  if (!manager) {
    // Native BLE is loaded only after the mock branch and only at point of use.
    const {BleManager} = require('react-native-ble-plx') as {BleManager: new () => BleManagerLike};
    manager = new BleManager();
  }
  return manager;
}

export async function scanBleDevices(): Promise<BleDeviceInfo[]> {
  if (isMockMode) return mockScan();
  if (!(await requestBlePermissions())) throw new Error('Bluetooth permissions were not granted');

  const bleManager = getManager();
  const bluetoothState = await bleManager.state();
  if (bluetoothState !== 'PoweredOn') {
    throw new Error(`Bluetooth is not ready (${bluetoothState}). Turn on Bluetooth and try again.`);
  }

  stopBleScan();
  return new Promise((resolve, reject) => {
    const found = new Map<string, BleDeviceInfo>();
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      bleManager.stopDeviceScan();
      if (stopActiveScan === finish) stopActiveScan = undefined;
      if (error) reject(error); else resolve(Array.from(found.values()));
    };
    const timeout = setTimeout(() => finish(), 8000);
    stopActiveScan = finish;
    try {
      bleManager.startDeviceScan(null, {allowDuplicates: false}, (error, device) => {
        if (error) {
          finish(new Error(`Bluetooth scan could not start: ${error.message}`));
          return;
        }
        if (device?.id) found.set(device.id, {id: device.id, name: device.name?.trim() || 'Unnamed wearable'});
      });
    } catch (error: unknown) {
      finish(error instanceof Error ? new Error(`Bluetooth scan could not start: ${error.message}`) : new Error('BLE scan could not start'));
    }
  });
}

export function stopBleScan(): void {
  if (isMockMode) return;
  stopActiveScan?.();
}

export async function connectBleDevice(deviceId: string, onReading: BleReadingHandler, onError: ErrorHandler): Promise<void> {
  if (!/^[A-Za-z0-9:_-]{1,128}$/.test(deviceId)) throw new Error('Invalid device identifier');
  if (isMockMode) return mockConnect(deviceId, onReading);
  if (!(await requestBlePermissions())) throw new Error('Bluetooth permissions were not granted');
  stopBleScan();
  if (connections.has(deviceId)) return;

  const device = await getManager().connectToDevice(deviceId);
  try {
    await device.discoverAllServicesAndCharacteristics();
    const characteristicSubscription = device.monitorCharacteristicForService(
      HEART_RATE_SERVICE_UUID,
      HEART_RATE_MEASUREMENT_UUID,
      (error, characteristic) => {
        if (error) {
          onError(error);
          return;
        }
        if (!characteristic?.value) return;
        try {
          onReading({metric: 'heartRate', value: decodeHeartRateMeasurement(characteristic.value), deviceId, timestamp: Date.now()});
        } catch (decodeError) {
          onError(decodeError instanceof Error ? decodeError : new Error('Invalid sensor payload'));
        }
      },
    );
    const disconnectSubscription = device.onDisconnected(error => {
      connections.get(deviceId)?.remove();
      connections.delete(deviceId);
      if (error) onError(error);
    });
    connections.set(deviceId, {
      device,
      remove: () => {characteristicSubscription.remove(); disconnectSubscription.remove();},
    });
  } catch (error: unknown) {
    await device.cancelConnection().catch(() => undefined);
    throw error;
  }
}

export function disconnectBleDevice(deviceId?: string): void {
  if (isMockMode) {
    mockDisconnect(deviceId);
    return;
  }
  const ids = deviceId ? [deviceId] : Array.from(connections.keys());
  ids.forEach(id => {
    const connection = connections.get(id);
    connection?.remove();
    connections.delete(id);
    void connection?.device.cancelConnection();
  });
}

export function destroyBle(): void {
  stopBleScan();
  disconnectBleDevice();
  if (manager && Platform.OS !== 'web') manager.destroy();
  manager = undefined;
}
