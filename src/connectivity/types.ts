export type ConnectionStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

/**
 * Metrics tracked by the app. `heartRate` and `cadence` come straight off
 * standard BLE GATT services; `calories` is never read from a device — it is
 * always derived from heart rate (see connectivity/calories.ts).
 */
export type MetricKey = 'heartRate' | 'cadence' | 'calories';

export type DeviceCapabilities = {
  heartRate: boolean;
  cadence: boolean;
  /** True whenever heartRate is, since that is what the estimate is derived from. */
  calories: boolean;
};

export function capabilitiesFromServices(services: {heartRate: boolean; cadence: boolean}): DeviceCapabilities {
  return {
    heartRate: services.heartRate,
    cadence: services.cadence,
    calories: services.heartRate,
  };
}

export type BleDeviceInfo = {
  id: string;
  /** Advertised name, or null when the peripheral broadcast none. */
  name: string | null;
  /** Advertised signal strength in dBm; null when the platform withheld it. */
  rssi: number | null;
  /** True when the advertisement includes the standard heart-rate service. */
  advertisesHeartRate: boolean;
  /** True when the advertisement includes the Running Speed and Cadence service. */
  advertisesCadence: boolean;
};

/**
 * How a device was found. The transport is always BLE — an NFC tag only
 * supplies the address — so this records the route the user took, which is
 * what makes it recognisable to them in a list.
 */
export type DiscoverySource = 'bluetooth' | 'nfc';

export type ConnectionHistoryEntry = {
  id: string;
  /** Null when the peripheral advertised no name. */
  name: string | null;
  connectedAt: number;
  /** Null while the device is still connected. */
  disconnectedAt: number | null;
  via: DiscoverySource;
};

/** A raw sensor reading. Calories is never one of these — see MetricKey. */
export type SensorReading = {
  metric: 'heartRate' | 'cadence';
  value: number;
  deviceId: string;
  timestamp: number;
};

/**
 * Broader than SensorReading — covers derived metrics like calories too.
 * This is what the app-level sync pipeline (useReadingSync) consumes, as
 * opposed to what the BLE layer itself ever emits.
 */
export type MetricReading = {
  metric: MetricKey;
  value: number;
  deviceId: string;
  timestamp: number;
};

/** Live state for one currently-connected device. */
export type ConnectedDevice = {
  id: string;
  /** Null when the peripheral advertised no name. */
  name: string | null;
  capabilities: DeviceCapabilities;
  /** Most recent value per metric, or null before the first one arrives. */
  readings: Record<MetricKey, number | null>;
  /** Recent values per metric for the sparkline, newest last. */
  history: Record<MetricKey, number[]>;
  /** Timestamp of the most recent reading of any metric. */
  updatedAt: number | null;
};

export type BleReadingHandler = (reading: SensorReading) => void;
