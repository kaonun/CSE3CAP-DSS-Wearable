import {toByteArray} from 'base64-js';

/** Every custom metric's id is prefixed this way, distinguishing it from the three built-ins. */
export const CUSTOM_METRIC_PREFIX = 'custom:';

export function isCustomMetricId(metric: string): boolean {
  return metric.startsWith(CUSTOM_METRIC_PREFIX);
}

export function customMetricId(characteristicUuid: string): string {
  return `${CUSTOM_METRIC_PREFIX}${characteristicUuid}`;
}

export function characteristicUuidFromMetricId(metric: string): string | null {
  return isCustomMetricId(metric) ? metric.slice(CUSTOM_METRIC_PREFIX.length) : null;
}

const BLUETOOTH_BASE_UUID_SUFFIX = '-0000-1000-8000-00805f9b34fb';
const FULL_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Expands whatever a user types — "0x2A37", "2A37", or a full UUID — into the
 * full 128-bit UUID react-native-ble-plx expects. Short forms are defined
 * against the standard Bluetooth Base UUID (Bluetooth Core Spec, Vol 3, Part
 * B, §2.5.1), which is how 16-bit and 32-bit assigned numbers like the Heart
 * Rate Measurement characteristic (0x2A37) resolve to their real UUID.
 */
export function normalizeCharacteristicUuid(input: string): string | null {
  const trimmed = input.trim().replace(/^0x/i, '');
  if (!trimmed) return null;

  if (/^[0-9a-f]{4}$/i.test(trimmed)) {
    return `0000${trimmed.toLowerCase()}${BLUETOOTH_BASE_UUID_SUFFIX}`;
  }
  if (/^[0-9a-f]{8}$/i.test(trimmed)) {
    return `${trimmed.toLowerCase()}${BLUETOOTH_BASE_UUID_SUFFIX}`;
  }
  const lower = trimmed.toLowerCase();
  if (FULL_UUID_RE.test(lower)) return lower;

  return null;
}

/** Widest plausible bound for an unknown sensor value — bounded, but generous. */
export const CUSTOM_METRIC_MAX_VALUE = 1_000_000;

/**
 * There is no universal byte layout for a custom characteristic, so this
 * reads the payload as a plain little-endian unsigned integer — the simplest
 * interpretation, and the one most DIY/hobbyist BLE peripherals use for a
 * single gauge-style value. Longer payloads only use their first 4 bytes.
 * Not every device will decode correctly; that trade-off is inherent to
 * supporting arbitrary, unknown characteristics.
 */
export function decodeCustomValue(encoded: string): number {
  if (typeof encoded !== 'string' || encoded.length === 0) {
    throw new Error('Empty custom metric payload');
  }

  let bytes: Uint8Array;
  try {
    bytes = toByteArray(encoded);
  } catch {
    throw new Error('Invalid custom metric payload encoding');
  }

  if (bytes.length === 0) throw new Error('Empty custom metric payload');

  let value = 0;
  const width = Math.min(bytes.length, 4);
  for (let i = 0; i < width; i += 1) {
    value += bytes[i] * 2 ** (8 * i);
  }

  if (!Number.isFinite(value) || value < 0 || value > CUSTOM_METRIC_MAX_VALUE) {
    throw new Error('Custom metric value is outside the accepted range');
  }
  return Math.round(value);
}
