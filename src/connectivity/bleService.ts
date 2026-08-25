import {Platform} from 'react-native';
import {toByteArray} from 'base64-js';
import {requestBlePermissions} from './permissions';
import {CADENCE_MEASUREMENT_UUID, CADENCE_SERVICE_UUID, decodeCadenceMeasurement} from './cadence';
import {decodeHeartRateMeasurement, HEART_RATE_MEASUREMENT_UUID, HEART_RATE_SERVICE_UUID} from './heartRate';
import {mockConnect, mockDisconnect, mockScan} from './mock';
import {BleDeviceInfo, BleReadingHandler, capabilitiesFromServices, DeviceCapabilities} from './types';

type ErrorHandler = (error: Error) => void;

type ScannedDevice = {
  id: string;
  name?: string | null;
  localName?: string | null;
  rssi?: number | null;
  serviceUUIDs?: string[] | null;
};

type ConnectedPeripheral = {
  name?: string | null;
  localName?: string | null;
  discoverAllServicesAndCharacteristics: () => Promise<unknown>;
  cancelConnection: () => Promise<unknown>;
  services: () => Promise<{uuid: string}[]>;
  readCharacteristicForService?: (
    service: string,
    characteristic: string,
  ) => Promise<{value?: string | null} | null>;
  monitorCharacteristicForService: (
    service: string,
    characteristic: string,
    listener: (error: Error | null, characteristic: {value?: string | null} | null) => void,
  ) => {remove: () => void};
  onDisconnected: (listener: (error: Error | null) => void) => {remove: () => void};
};

type BleManagerLike = {
  state: () => Promise<string>;
  startDeviceScan: (uuids: string[] | null, options: object | null, listener: (error: Error | null, device: ScannedDevice | null) => void) => void;
  stopDeviceScan: () => void;
  connectToDevice: (id: string) => Promise<ConnectedPeripheral>;
  destroy: () => void;
};

/** Generic Access service and its Device Name characteristic. */
const GENERIC_ACCESS_SERVICE_UUID = '00001800-0000-1000-8000-00805F9B34FB';
const DEVICE_NAME_CHARACTERISTIC_UUID = '00002A00-0000-1000-8000-00805F9B34FB';

/**
 * Many peripherals leave the name out of their advertisement packet, so a scan
 * alone often yields nothing to display. Once connected, the name is usually
 * available over GATT — this is how dedicated scanners show a real name where a
 * plain advertisement scan shows none. Best-effort: plenty of devices do not
 * expose the characteristic at all.
 */
async function readDeviceName(peripheral: ConnectedPeripheral): Promise<string | null> {
  const advertised = (peripheral.name ?? peripheral.localName)?.trim();
  if (advertised) return advertised;
  if (!peripheral.readCharacteristicForService) return null;

  try {
    const characteristic = await peripheral.readCharacteristicForService(
      GENERIC_ACCESS_SERVICE_UUID,
      DEVICE_NAME_CHARACTERISTIC_UUID,
    );
    if (!characteristic?.value) return null;
    const decoded = new TextDecoder('utf-8', {fatal: false})
      .decode(toByteArray(characteristic.value))
      // Some peripherals pad the value with NULs.
      .replace(/\u0000+$/, '')
      .trim();
    return decoded || null;
  } catch {
    return null;
  }
}

const isMockMode = process.env.EXPO_PUBLIC_CONNECTIVITY_MOCK === 'true';
const connections = new Map<string, {device: {cancelConnection: () => Promise<unknown>}; remove: () => void}>();
/**
 * Devices the user chose to disconnect. Tearing down a subscription makes the
 * BLE stack report the in-flight operation as cancelled; that is the expected
 * consequence of disconnecting, not a fault worth showing.
 */
const intentionalDisconnects = new Set<string>();
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

/**
 * Folds one advertisement packet into what is already known about a device.
 *
 * A peripheral emits several packet types: the advertisement is capped at 31
 * bytes and frequently omits the name, while the scan response carries it.
 * Replacing the whole entry on every packet lets a later nameless one erase a
 * name already seen — the reason most devices previously listed as unnamed.
 * Details are therefore accumulated rather than overwritten.
 *
 * Exported for tests.
 */
export function mergeScanResult(
  existing: BleDeviceInfo | undefined,
  packet: ScannedDevice,
): BleDeviceInfo {
  const advertised = (packet.name ?? packet.localName)?.trim() || null;
  const advertisedUuids = (packet.serviceUUIDs ?? []).map(uuid => uuid.toLowerCase());
  const advertisesHeartRate = advertisedUuids.includes(HEART_RATE_SERVICE_UUID.toLowerCase());
  const advertisesCadence = advertisedUuids.includes(CADENCE_SERVICE_UUID.toLowerCase());

  return {
    id: packet.id,
    name: advertised ?? existing?.name ?? null,
    // The newest reading best reflects current proximity.
    rssi: typeof packet.rssi === 'number' ? packet.rssi : (existing?.rssi ?? null),
    // Once a device has advertised the service, it has the service.
    advertisesHeartRate: advertisesHeartRate || !!existing?.advertisesHeartRate,
    advertisesCadence: advertisesCadence || !!existing?.advertisesCadence,
  };
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
      if (error) {
        reject(error);
        return;
      }
      // Rank what the user most likely wants first: real heart-rate sensors,
      // then anything that bothered to advertise a name, then by signal
      // strength. Without this a nearby TV or soundbar outranks the wearable.
      const ranked = Array.from(found.values()).sort((first, second) => {
        if (first.advertisesHeartRate !== second.advertisesHeartRate) {
          return first.advertisesHeartRate ? -1 : 1;
        }
        if (!!first.name !== !!second.name) return first.name ? -1 : 1;
        return (second.rssi ?? -999) - (first.rssi ?? -999);
      });
      resolve(ranked);
    };
    const timeout = setTimeout(() => finish(), 8000);
    stopActiveScan = finish;
    try {
      // Duplicates are allowed on purpose: a device's name often arrives in a
      // later scan-response packet, and filtering repeats hides it. Results are
      // merged by id below, so the extra callbacks cost nothing.
      bleManager.startDeviceScan(null, {allowDuplicates: true}, (error, device) => {
        if (error) {
          finish(new Error(`Bluetooth scan could not start: ${error.message}`));
          return;
        }
        if (!device?.id) return;
        found.set(device.id, mergeScanResult(found.get(device.id), device));
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

export async function connectBleDevice(
  deviceId: string,
  onReading: BleReadingHandler,
  onError: ErrorHandler,
  /** Called with a name resolved over GATT, when the scan produced none. */
  onName?: (name: string) => void,
  /** Called once with what the device's real, discovered GATT services support. */
  onCapabilities?: (capabilities: DeviceCapabilities) => void,
): Promise<void> {
  if (!/^[A-Za-z0-9:_-]{1,128}$/.test(deviceId)) throw new Error('Invalid device identifier');
  if (isMockMode) return mockConnect(deviceId, onReading, onCapabilities);
  if (!(await requestBlePermissions())) throw new Error('Bluetooth permissions were not granted');
  stopBleScan();
  if (connections.has(deviceId)) return;

  // A first attempt often fails: discoverAllServicesAndCharacteristics can
  // return immediately from a stale GATT cache, and subscribing before the
  // peripheral's services are really available fails, which then tears the
  // connection down. The second attempt succeeds because the first populated
  // the cache. Retrying here spares the user from having to tap twice.
  try {
    await attemptConnection(deviceId, onReading, onError, onName, onCapabilities);
  } catch (firstError) {
    await delay(RETRY_DELAY_MS);
    try {
      await attemptConnection(deviceId, onReading, onError, onName, onCapabilities);
    } catch {
      // Report the original failure — it describes why the device refused.
      throw firstError;
    }
  }
}

/** Pause between a failed connection and the retry, letting the stack settle. */
const RETRY_DELAY_MS = 700;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function attemptConnection(
  deviceId: string,
  onReading: BleReadingHandler,
  onError: ErrorHandler,
  onName?: (name: string) => void,
  onCapabilities?: (capabilities: DeviceCapabilities) => void,
): Promise<void> {
  if (connections.has(deviceId)) return;

  const device = await getManager().connectToDevice(deviceId);
  try {
    await device.discoverAllServicesAndCharacteristics();

    // Capability is read off what the device actually discovered, not the
    // advertisement — a device connected via an NFC tag never went through a
    // scan, so advertised service UUIDs are not always available.
    const discovered = await device.services().catch(() => [] as {uuid: string}[]);
    const discoveredUuids = discovered.map(service => service.uuid.toLowerCase());
    const hasHeartRate = discoveredUuids.includes(HEART_RATE_SERVICE_UUID.toLowerCase());
    const hasCadence = discoveredUuids.includes(CADENCE_SERVICE_UUID.toLowerCase());
    onCapabilities?.(capabilitiesFromServices({heartRate: hasHeartRate, cadence: hasCadence}));

    const subscriptions: {remove: () => void}[] = [];

    if (hasHeartRate) {
      subscriptions.push(
        device.monitorCharacteristicForService(
          HEART_RATE_SERVICE_UUID,
          HEART_RATE_MEASUREMENT_UUID,
          (error, characteristic) => {
            if (error) {
              if (!intentionalDisconnects.has(deviceId)) onError(error);
              return;
            }
            if (!characteristic?.value) return;
            try {
              onReading({metric: 'heartRate', value: decodeHeartRateMeasurement(characteristic.value), deviceId, timestamp: Date.now()});
            } catch (decodeError) {
              onError(decodeError instanceof Error ? decodeError : new Error('Invalid sensor payload'));
            }
          },
        ),
      );
    }

    if (hasCadence) {
      subscriptions.push(
        device.monitorCharacteristicForService(
          CADENCE_SERVICE_UUID,
          CADENCE_MEASUREMENT_UUID,
          (error, characteristic) => {
            if (error) {
              if (!intentionalDisconnects.has(deviceId)) onError(error);
              return;
            }
            if (!characteristic?.value) return;
            try {
              onReading({metric: 'cadence', value: decodeCadenceMeasurement(characteristic.value), deviceId, timestamp: Date.now()});
            } catch (decodeError) {
              onError(decodeError instanceof Error ? decodeError : new Error('Invalid sensor payload'));
            }
          },
        ),
      );
    }

    const disconnectSubscription = device.onDisconnected(error => {
      connections.get(deviceId)?.remove();
      connections.delete(deviceId);
      // An unexpected drop is worth reporting; one the user asked for is not.
      if (error && !intentionalDisconnects.has(deviceId)) onError(error);
      intentionalDisconnects.delete(deviceId);
    });
    connections.set(deviceId, {
      device,
      remove: () => {subscriptions.forEach(subscription => subscription.remove()); disconnectSubscription.remove();},
    });

    // Deliberately after the subscription is live, and deliberately not
    // awaited. Android serialises GATT operations, so issuing this read
    // between discovery and the notify registration made the notify fail
    // ("notify change failed"), which is why a first connection attempt would
    // error and a retry would succeed. The name is cosmetic — it must never
    // sit on the path that delivers readings.
    if (onName) {
      void readDeviceName(device)
        .then(resolved => {
          // Ignore a late result for a connection that has since dropped.
          if (resolved && connections.has(deviceId)) onName(resolved);
        })
        .catch(() => undefined);
    }
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
    // Flag before tearing down, so the resulting "operation cancelled" from
    // the subscription is recognised as expected rather than surfaced.
    intentionalDisconnects.add(id);
    connection?.remove();
    connections.delete(id);
    void connection?.device.cancelConnection().catch(() => undefined);
    // Clear the flag once the stack has settled, so a genuine drop later is
    // still reported.
    setTimeout(() => intentionalDisconnects.delete(id), 3000);
  });
}

export function destroyBle(): void {
  stopBleScan();
  disconnectBleDevice();
  if (manager && Platform.OS !== 'web') manager.destroy();
  manager = undefined;
}
