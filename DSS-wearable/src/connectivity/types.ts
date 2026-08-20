export type ConnectionStatus =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'error';

export type BleDeviceInfo = {
  id: string;
  name: string;
};

export type ConnectionHistoryEntry = {
  id: string;
  name: string;
  connectedAt: number;
};

export type SensorReading = {
  metric: 'heartRate';
  value: number;
  deviceId: string;
  timestamp: number;
};

export type BleReadingHandler = (reading: SensorReading) => void;
