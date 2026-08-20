# BLE/NFC Connectivity

This module provides the wearable connectivity boundary without depending on the app UI.

## Public API

```ts
import {useBleDevice, useNfc} from '@/connectivity';
```

`useBleDevice()` exposes `scan`, `connect`, `disconnect`, `devices`, `connectedDeviceIds`, `heartRate`, `heartRateHistory`, `status`, and `error`.

`useNfc()` exposes `readTag`, `tagId`, `reading`, and `error`. NFC reads an NDEF UTF-8 Text record containing a BLE device identifier, then the UI can pass that identifier to `ble.connect(tagId)`.

## Native requirements

- Android 12+: `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT` runtime permissions.
- Android 6-11: `ACCESS_FINE_LOCATION` for BLE discovery.
- NFC is requested only when `readTag()` is called.
- The device must advertise Bluetooth Low Energy. Visibility in Android Bluetooth settings alone does not guarantee BLE advertisement.

## BLE data contract

The service subscribes to the standard Heart Rate Measurement characteristic (`0x2A37`) after connecting. Payloads support 8-bit and little-endian 16-bit BPM values. Accepted values are `1..300`.

The module scans broadly so devices are discoverable even before their advertised services are known. The connected wearable must still expose the expected heart-rate characteristic for live BPM notifications.

## Integration notes

The module intentionally contains no screen components, styling, navigation, or UI state beyond connectivity state. App screens should map `status`, `error`, `devices`, and `heartRate` into the repository's existing themed components.
