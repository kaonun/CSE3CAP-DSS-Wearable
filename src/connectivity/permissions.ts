import {PermissionsAndroid, Platform} from 'react-native';
import type {Permission} from 'react-native';

export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0;
  const permissions: Permission[] = apiLevel >= 31
    ? [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]
    : apiLevel >= 23
      ? [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]
      : [];

  if (permissions.length === 0) return true;

  const result = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.every(
    permission => result[permission] === PermissionsAndroid.RESULTS.GRANTED,
  );
}
