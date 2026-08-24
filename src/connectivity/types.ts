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

export type BleReadingHandler = (reading: SensorReading) => void;
