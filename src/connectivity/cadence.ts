import {toByteArray} from 'base64-js';

/** Running Speed and Cadence service — the standard GATT source for step cadence. */
export const CADENCE_SERVICE_UUID = '00001814-0000-1000-8000-00805F9B34FB';
export const CADENCE_MEASUREMENT_UUID = '00002A53-0000-1000-8000-00805F9B34FB';

/**
 * Decodes the RSC Measurement characteristic and returns instantaneous
 * cadence in steps per minute. The characteristic also carries speed and
 * optional stride length / total distance fields, none of which the app
 * currently surfaces.
 */
export function decodeCadenceMeasurement(encoded: string): number {
  if (typeof encoded !== 'string' || encoded.length === 0) {
    throw new Error('Empty cadence payload');
  }

  let bytes: Uint8Array;
  try {
    bytes = toByteArray(encoded);
  } catch {
    throw new Error('Invalid cadence payload encoding');
  }

  // Flags (1 byte) + Instantaneous Speed (uint16) + Instantaneous Cadence (uint8).
  if (bytes.length < 4) throw new Error('Truncated cadence payload');
  const cadence = bytes[3];
  if (!Number.isInteger(cadence) || cadence < 0 || cadence > 254) {
    throw new Error('Cadence value is outside the accepted range');
  }
  return cadence;
}
