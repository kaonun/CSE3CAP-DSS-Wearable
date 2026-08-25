import {toByteArray} from 'base64-js';

/**
 * GAP Appearance value → broad device category, for the handful of
 * categories worth badging in a scan list. Values are the official
 * Bluetooth SIG assigned numbers (Core Spec Supplement, GAP Appearance),
 * computed as (category << 6) | subcategory:
 * https://bitbucket.org/bluetooth-SIG/public/src/main/assigned_numbers/core/appearance_values.yaml
 *
 * Not every device sets this correctly or at all — this is best-effort,
 * same as the heart-rate/cadence service badges.
 */
export type DeviceKind = 'watch' | 'headphones' | 'speaker' | 'tv';

const APPEARANCE_KIND: Record<number, DeviceKind> = {
  0x00c0: 'watch', // Generic Watch
  0x00c1: 'watch', // Sports Watch
  0x00c2: 'watch', // Smartwatch
  0x0940: 'headphones', // Generic Wearable Audio Device
  0x0941: 'headphones', // Earbud
  0x0942: 'headphones', // Headset
  0x0943: 'headphones', // Headphones
  0x0840: 'speaker', // Generic Audio Sink
  0x0841: 'speaker', // Standalone Speaker
  0x0842: 'speaker', // Soundbar
  0x0a00: 'tv', // Generic Display Equipment
  0x0a01: 'tv', // Television
};

export function deviceKindFromAppearance(appearance: number | null): DeviceKind | null {
  if (appearance === null) return null;
  return APPEARANCE_KIND[appearance] ?? null;
}

/** GAP Advertising Data type for Appearance (Core Spec Supplement, Part A, §1.12). */
const APPEARANCE_AD_TYPE = 0x19;

/**
 * Walks the raw advertisement's AD structures (each a
 * [length][type][data...] triplet) looking for the Appearance field, and
 * decodes its 16-bit little-endian value.
 */
export function parseAppearanceFromScanRecord(rawScanRecord: string | null | undefined): number | null {
  if (!rawScanRecord) return null;

  let bytes: Uint8Array;
  try {
    bytes = toByteArray(rawScanRecord);
  } catch {
    return null;
  }

  let i = 0;
  while (i < bytes.length) {
    const length = bytes[i];
    if (length === 0) break; // padding — nothing meaningful follows
    const type = bytes[i + 1];
    if (type === APPEARANCE_AD_TYPE && length >= 3 && i + 3 < bytes.length) {
      return bytes[i + 2] | (bytes[i + 3] << 8);
    }
    i += 1 + length;
  }
  return null;
}
