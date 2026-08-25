import {BleDeviceInfo, BleReadingHandler, capabilitiesFromServices, DeviceCapabilities, SensorReading} from './types';

export const MOCK_DEVICES: BleDeviceInfo[] = [
  {id: 'mock-wristband-01', name: 'Mock Wristband', rssi: -48, advertisesHeartRate: true, advertisesCadence: true},
  {id: 'mock-chest-02', name: 'Mock Chest Strap', rssi: -63, advertisesHeartRate: true, advertisesCadence: false},
  {id: 'mock-ring-03', name: 'Mock Ring', rssi: -71, advertisesHeartRate: false, advertisesCadence: false},
  {id: 'mock-unnamed-04', name: null, rssi: -88, advertisesHeartRate: false, advertisesCadence: false},
];

const timers = new Map<string, ReturnType<typeof setInterval>[]>();

export async function mockScan(): Promise<BleDeviceInfo[]> {
  await new Promise(resolve => setTimeout(resolve, 350));
  return MOCK_DEVICES;
}

export async function mockConnect(
  deviceId: string,
  onReading: BleReadingHandler,
  onCapabilities?: (capabilities: DeviceCapabilities) => void,
): Promise<void> {
  if (timers.has(deviceId)) return;

  const known = MOCK_DEVICES.find(device => device.id === deviceId);
  // An id outside the mock list (e.g. typed in for testing) still gets a
  // heart-rate stream, matching the app's original mock behaviour.
  const heartRate = known?.advertisesHeartRate ?? true;
  const cadence = known?.advertisesCadence ?? false;
  onCapabilities?.(capabilitiesFromServices({heartRate, cadence}));

  const active: ReturnType<typeof setInterval>[] = [];

  if (heartRate) {
    const emitHeartRate = () => {
      const reading: SensorReading = {
        metric: 'heartRate',
        value: 65 + Math.floor(Math.random() * 35),
        deviceId,
        timestamp: Date.now(),
      };
      onReading(reading);
    };
    emitHeartRate();
    active.push(setInterval(emitHeartRate, 1000));
  }

  if (cadence) {
    const emitCadence = () => {
      const reading: SensorReading = {
        metric: 'cadence',
        value: 70 + Math.floor(Math.random() * 40),
        deviceId,
        timestamp: Date.now(),
      };
      onReading(reading);
    };
    emitCadence();
    active.push(setInterval(emitCadence, 1000));
  }

  timers.set(deviceId, active);
}

export function mockDisconnect(deviceId?: string): void {
  const ids = deviceId ? [deviceId] : Array.from(timers.keys());
  ids.forEach(id => {
    timers.get(id)?.forEach(timer => clearInterval(timer));
    timers.delete(id);
  });
}
