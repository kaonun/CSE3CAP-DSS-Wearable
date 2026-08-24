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

export type ConnectionHistoryEntry = {
  id: string;
  /** Null when the peripheral advertised no name. */
  name: string | null;
  connectedAt: number;
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
