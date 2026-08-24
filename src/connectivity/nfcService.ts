import {mockNfcRead} from './nfcMock';
import {toByteArray} from 'base64-js';

const isMockMode = process.env.EXPO_PUBLIC_CONNECTIVITY_MOCK === 'true';

type NdefRecordLike = {
  tnf?: number;
  type?: number[] | string;
  payload?: unknown;
};

type NfcModule = {
  default: {
    isSupported: () => Promise<boolean>;
    start: () => Promise<void>;
    requestTechnology: (technology: unknown, options?: {alertMessage?: string}) => Promise<void>;
    getTag: () => Promise<{ndefMessage?: NdefRecordLike[]} | null>;
    cancelTechnologyRequest: () => Promise<void>;
  };
  NfcTech: {Ndef: unknown};
  Ndef: {TNF_WELL_KNOWN: number; TNF_MIME_MEDIA: number; RTD_TEXT: number[] | string};
};

/** application/vnd.bluetooth.ep.oob — the NFC-Forum "Bluetooth Secure Simple
 *  Pairing" handover record. Common NFC-writing apps (e.g. NFC Tools' "Bluetooth"
 *  record type) use this instead of plain text to store a device address. */
const BLUETOOTH_OOB_MIME = 'application/vnd.bluetooth.ep.oob';

let nativeNfcStarted = false;
let activeNfc: NfcModule['default'] | undefined;

function validateTagId(value: unknown): string {
  const normalized = typeof value === 'string' ? value.replace(/[\u0000\u0001]/g, '').trim() : '';
  const compactMac = normalized.replace(/[-\s]/g, ':').replace(/:{2,}/g, ':');
  const isBluetoothAddress = /^([A-Fa-f0-9]{2}:){5}[A-Fa-f0-9]{2}$/.test(compactMac);
  const isDeviceIdentifier = /^[A-Za-z0-9_-]{1,128}$/.test(normalized);
  if (!isBluetoothAddress && !isDeviceIdentifier) {
    const shown = normalized.length > 40 ? `${normalized.slice(0, 40)}…` : normalized;
    throw new Error(`NFC tag does not contain a valid device identifier (read: "${shown}")`);
  }
  return isBluetoothAddress ? compactMac.toUpperCase() : normalized;
}

function asBytes(payload: unknown): Uint8Array {
  if (typeof payload === 'string') {
    try {
      return toByteArray(payload);
    } catch {
      throw new Error('Invalid NDEF payload encoding');
    }
  }
  if (payload instanceof Uint8Array) return payload;
  if (Array.isArray(payload) && payload.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
    return Uint8Array.from(payload);
  }
  throw new Error('NFC tag has no valid NDEF payload');
}

function decodeNdefDeviceId(payload: unknown): string {
  if (typeof payload === 'string' && /^([A-Fa-f0-9]{2}:){5}[A-Fa-f0-9]{2}$/.test(payload.trim())) {
    return validateTagId(payload);
  }

  try {
  const bytes = asBytes(payload);
  if (bytes.length < 2) throw new Error('Truncated NDEF text payload');

  const status = bytes[0];
  const languageLength = status & 0x3f;
  const textStart = 1 + languageLength;
  if (textStart >= bytes.length) throw new Error('NFC text payload is empty');
  if ((status & 0x80) !== 0) throw new Error('NFC tag uses unsupported UTF-16 text encoding');

    return validateTagId(new TextDecoder('utf-8', {fatal: true}).decode(bytes.slice(textStart)));
  } catch (error: unknown) {
    if (typeof payload === 'string') return validateTagId(payload);
    if (error instanceof Error && error.message.startsWith('NFC tag')) throw error;
    throw new Error('NFC tag text is not valid UTF-8');
  }
}

function isTextRecord(record: NdefRecordLike, ndef: NfcModule['Ndef']): boolean {
  if (record.tnf !== ndef.TNF_WELL_KNOWN) return false;
  if (record.type === ndef.RTD_TEXT) return true;
  const expectedBytes = Array.isArray(ndef.RTD_TEXT)
    ? ndef.RTD_TEXT
    : Array.from(ndef.RTD_TEXT, character => character.charCodeAt(0));
  return Array.isArray(record.type)
    && record.type.length === expectedBytes.length
    && record.type.every((value, index) => value === expectedBytes[index]);
}

function isBluetoothOobRecord(record: NdefRecordLike, ndef: NfcModule['Ndef']): boolean {
  if (record.tnf !== ndef.TNF_MIME_MEDIA) return false;
  if (record.type === BLUETOOTH_OOB_MIME) return true;
  if (!Array.isArray(record.type)) return false;
  const expectedBytes = Array.from(BLUETOOTH_OOB_MIME, character => character.charCodeAt(0));
  return record.type.length === expectedBytes.length
    && record.type.every((value, index) => value === expectedBytes[index]);
}

/**
 * Parses the "Bluetooth Secure Simple Pairing Using NFC" OOB payload:
 * 2-byte little-endian length, then the 6-byte device address stored
 * in reverse (least-significant byte first), then optional EIR data
 * we don't need. See NFC Forum AD-BTSSP-1.3.
 */
function decodeBluetoothOobAddress(payload: unknown): string {
  const bytes = asBytes(payload);
  if (bytes.length < 8) throw new Error('Bluetooth pairing record on this tag is truncated');
  const address = Array.from(bytes.slice(2, 8))
    .reverse()
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join(':');
  return validateTagId(address);
}

export async function readNfcTag(): Promise<string> {
  if (isMockMode) return mockNfcRead();

  // Native NFC is loaded only at point of use, preserving Expo Go mock mode.
  const NfcManagerModule = require('react-native-nfc-manager') as NfcModule;
  const nfc = NfcManagerModule.default;
  activeNfc = nfc;
  if (!(await nfc.isSupported())) throw new Error('NFC is not supported on this device');
  if (!nativeNfcStarted) {
    await nfc.start();
    nativeNfcStarted = true;
  }

  try {
    await nfc.requestTechnology(NfcManagerModule.NfcTech.Ndef, {
      alertMessage: 'Hold the DSS wearable NFC tag near this phone',
    });
    const tag = await nfc.getTag();
    const records = tag?.ndefMessage ?? [];

    const textRecord = records.find(item => isTextRecord(item, NfcManagerModule.Ndef));
    if (textRecord) return decodeNdefDeviceId(textRecord.payload);

    const bluetoothRecord = records.find(item => isBluetoothOobRecord(item, NfcManagerModule.Ndef));
    if (bluetoothRecord) return decodeBluetoothOobAddress(bluetoothRecord.payload);

    const fallback = records.find(item => item.payload !== undefined);
    return decodeNdefDeviceId(fallback?.payload);
  } finally {
    await nfc.cancelTechnologyRequest().catch(() => undefined);
    activeNfc = undefined;
  }
}

export async function cancelNfcRead(): Promise<void> {
  await activeNfc?.cancelTechnologyRequest().catch(() => undefined);
  activeNfc = undefined;
}
