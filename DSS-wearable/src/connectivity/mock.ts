import {BleDeviceInfo, BleReadingHandler, SensorReading} from './types';

export const MOCK_DEVICES: BleDeviceInfo[] = [
  {id: 'mock-wristband-01', name: 'Mock Wristband'},
  {id: 'mock-chest-02', name: 'Mock Chest Strap'},
  {id: 'mock-ring-03', name: 'Mock Ring'},
];

const timers = new Map<string, ReturnType<typeof setInterval>>();

export async function mockScan(): Promise<BleDeviceInfo[]> {
  await new Promise(resolve => setTimeout(resolve, 350));
  return MOCK_DEVICES;
}

export async function mockConnect(deviceId: string, onReading: BleReadingHandler): Promise<void> {
  if (timers.has(deviceId)) return;
  const emit = () => {
    const reading: SensorReading = {
      metric: 'heartRate',
      value: 65 + Math.floor(Math.random() * 35),
      deviceId,
      timestamp: Date.now(),
    };
    onReading(reading);
  };
  emit();
  timers.set(deviceId, setInterval(emit, 1000));
}

export function mockDisconnect(deviceId?: string): void {
  const ids = deviceId ? [deviceId] : Array.from(timers.keys());
  ids.forEach(id => {
    const timer = timers.get(id);
    if (timer) clearInterval(timer);
    timers.delete(id);
  });
}
