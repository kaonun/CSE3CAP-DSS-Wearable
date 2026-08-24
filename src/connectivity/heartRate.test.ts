import assert from 'node:assert/strict';
import test from 'node:test';
import {fromByteArray} from 'base64-js';

import {decodeHeartRateMeasurement} from './heartRate';

const encode = (bytes: number[]): string => fromByteArray(Uint8Array.from(bytes));

test('decodes 8-bit and little-endian 16-bit Heart Rate measurements', () => {
  assert.equal(decodeHeartRateMeasurement(encode([0x00, 72])), 72);
  assert.equal(decodeHeartRateMeasurement(encode([0x01, 0x2c, 0x01])), 300);
});

test('rejects truncated, non-positive, and out-of-range Heart Rate measurements', () => {
  assert.throws(() => decodeHeartRateMeasurement(encode([0x01, 0x48])));
  assert.throws(() => decodeHeartRateMeasurement(encode([0x00, 0x00])));
  assert.throws(() => decodeHeartRateMeasurement(encode([0x01, 0x2d, 0x01])));
});
