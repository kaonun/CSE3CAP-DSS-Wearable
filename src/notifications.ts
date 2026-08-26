import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Local notifications only — there is no push server, and none is wanted:
 * thresholds are evaluated on-device from readings the app already holds, so
 * nothing about a user's vitals needs to leave the phone to alert them.
 */

const ANDROID_CHANNEL_ID = 'dss-threshold-alerts';

let configured = false;

/**
 * Installs the foreground presentation behaviour and the Android channel.
 *
 * Android 8+ refuses to show a notification that has no channel, and the
 * channel must exist before the permission prompt appears, so this runs once
 * at startup rather than lazily at the first alert.
 */
export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    // Without a handler the OS suppresses notifications while the app is
    // foregrounded — which is exactly when threshold alerts fire, since
    // readings only arrive over an active BLE connection.
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Threshold alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    }).catch(() => undefined);
  }
}

/**
 * Asks for permission, returning whether alerts can actually be delivered.
 *
 * Checked before prompting, because the OS only shows the system dialog once —
 * re-requesting after a denial silently resolves as denied.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) return true;
    if (!existing.canAskAgain) return false;

    const requested = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    return requested.granted;
  } catch {
    return false;
  }
}

/**
 * Asks for notification permission once the app is past the login screen.
 *
 * Deliberately not at cold start: a permission dialog thrown at someone who
 * has not signed in yet has no visible reason attached to it, and Android
 * only ever shows the system prompt once — a denial there is permanent.
 */
export function useNotificationPermissionPrompt(active: boolean): void {
  const asked = useRef(false);

  useEffect(() => {
    if (!active || asked.current) return;
    asked.current = true;

    void (async () => {
      await configureNotifications();
      // Resolves immediately as denied if the user already refused, so this
      // costs nothing on later launches.
      await ensureNotificationPermission();
    })();
  }, [active]);
}

/**
 * Fires a threshold alert as close to immediately as the platform allows.
 *
 * On Android the channel decides whether a notification is allowed to appear
 * as a heads-up banner, and `channelId` is only accepted on a *trigger* — a
 * `null` trigger has nowhere to carry it, so the alert silently lands in
 * expo-notifications' low-importance fallback channel and never pops up. A
 * one-second interval trigger is the documented way to name a channel.
 *
 * iOS has no channels, so it keeps the immediate `null` trigger.
 */
export async function presentThresholdAlert(title: string, body: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger:
        Platform.OS === 'android'
          ? {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: 1,
              channelId: ANDROID_CHANNEL_ID,
            }
          : null,
    });
  } catch {
    // A failed alert must never take the reading pipeline down with it.
  }
}
