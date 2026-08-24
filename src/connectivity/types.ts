export type ConnectionStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export type BleDeviceInfo = {
  id: string;
  /** Advertised name, or null when the peripheral broadcast none. */
  name: string | null;
  /** Advertised signal strength in dBm; null when the platform withheld it. */
  rssi: number | null;
  /** True when the advertisement includes the standard heart-rate service. */
  advertisesHeartRate: boolean;
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

export type SensorReading = {
  metric: 'heartRate';
  value: number;
  deviceId: string;
  timestamp: number;
};

/** Live state for one currently-connected device. */
export type ConnectedDevice = {
  id: string;
  /** Null when the peripheral advertised no name. */
  name: string | null;
  /** Most recent reading, or null before the first one arrives. */
  heartRate: number | null;
  /** Recent readings for the sparkline, newest last. */
  history: number[];
  /** Timestamp of the most recent reading. */
  updatedAt: number | null;
};

export type BleReadingHandler = (reading: SensorReading) => void;
