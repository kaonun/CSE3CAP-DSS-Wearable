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
  Ndef: {TNF_WELL_KNOWN: number; RTD_TEXT: number[] | string};
};

let nativeNfcStarted = false;

function validateTagId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9:_-]{1,128}$/.test(value)) {
    throw new Error('NFC tag does not contain a valid device identifier');
  }
  return value;
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
  const bytes = asBytes(payload);
  if (bytes.length < 2) throw new Error('Truncated NDEF text payload');

  const status = bytes[0];
  const languageLength = status & 0x3f;
  const textStart = 1 + languageLength;
  if (textStart >= bytes.length) throw new Error('NFC text payload is empty');
  if ((status & 0x80) !== 0) throw new Error('NFC tag uses unsupported UTF-16 text encoding');

  try {
    return validateTagId(new TextDecoder('utf-8', {fatal: true}).decode(bytes.slice(textStart)));
  } catch (error: unknown) {
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

export async function readNfcTag(): Promise<string> {
  if (isMockMode) return mockNfcRead();

  // Native NFC is loaded only at point of use, preserving Expo Go mock mode.
  const NfcManagerModule = require('react-native-nfc-manager') as NfcModule;
  const nfc = NfcManagerModule.default;
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
    const record = tag?.ndefMessage?.find(item => isTextRecord(item, NfcManagerModule.Ndef));
    return decodeNdefDeviceId(record?.payload);
  } finally {
    await nfc.cancelTechnologyRequest().catch(() => undefined);
  }
}
