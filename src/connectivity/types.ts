import type {DeviceKind} from './appearance';

export type ConnectionStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

/**
 * The three built-in metrics. `heartRate` and `cadence` come straight off
 * standard BLE GATT services; `calories` is never read from a device — it is
 * always derived from heart rate (see connectivity/calories.ts).
 *
 * A device can also expose any number of user-defined custom metrics (see
 * connectivity/customMetric.ts) — those are identified by a `custom:<uuid>`
 * string rather than a member of this union, so most of the pipeline below
 * keys metrics by plain `string` to carry both kinds.
 */
export type MetricKey = 'heartRate' | 'cadence' | 'calories';

/** Whether a connected device supports each metric — built-in or custom, keyed by metric id. */
export type DeviceCapabilities = Record<string, boolean>;

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
  /** Broad category read off the advertisement's GAP Appearance field, if set. */
  deviceKind: DeviceKind | null;
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

/**
 * A raw sensor reading. Calories is never one of these — see MetricKey.
 * `metric` is a plain string rather than a literal union so a custom
 * (`custom:<uuid>`) characteristic can flow through the same path as the two
 * built-in sensor metrics.
 */
export type SensorReading = {
  metric: string;
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
  metric: string;
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
  readings: Record<string, number | null>;
  /** Recent values per metric for the sparkline, newest last. */
  history: Record<string, number[]>;
  /** Timestamp of the most recent reading of any metric. */
  updatedAt: number | null;
};

export type BleReadingHandler = (reading: SensorReading) => void;
