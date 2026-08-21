import {toByteArray} from 'base64-js';

export const HEART_RATE_SERVICE_UUID = '0000180D-0000-1000-8000-00805F9B34FB';
export const HEART_RATE_MEASUREMENT_UUID = '00002A37-0000-1000-8000-00805F9B34FB';

export function decodeHeartRateMeasurement(encoded: string): number {
  if (typeof encoded !== 'string' || encoded.length === 0) {
    throw new Error('Empty heart-rate payload');
  }

  let bytes: Uint8Array;
  try {
    bytes = toByteArray(encoded);
  } catch {
    throw new Error('Invalid heart-rate payload encoding');
  }

  if (bytes.length < 2) throw new Error('Truncated heart-rate payload');
  const flags = bytes[0];
  const isUint16 = (flags & 0x01) !== 0;
  if (isUint16 && bytes.length < 3) throw new Error('Truncated 16-bit heart-rate payload');
  const value = isUint16 ? bytes[1] | (bytes[2] << 8) : bytes[1];
  if (!Number.isInteger(value) || value <= 0 || value > 300) {
    throw new Error('Heart-rate value is outside the accepted range');
  }
  return value;
}
