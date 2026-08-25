import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useDeviceNames } from '@/device-names';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, type Messages } from '@/i18n';
import type { BleDeviceInfo, DeviceKind } from '@/connectivity';

/**
 * Bluetooth and NFC are not competing transports here — NFC only identifies
 * *which* device to reach, and the connection itself is always BLE. So the
 * sheet presents one goal ("connect a device") with two ways to pick the
 * target, rather than two parallel features.
 */
type Method = 'choose' | 'bluetooth' | 'nfc' | 'naming';

type PendingConnection = { deviceId: string; via: 'bluetooth' | 'nfc'; defaultName: string | null };

export type ConnectSheetProps = {
  visible: boolean;
  onClose: () => void;
  devices: BleDeviceInfo[];
  scanning: boolean;
  connectingId: string | null;
  connectedIds: string[];
  bleError: string | null;
  onScan: () => void;
  onConnect: (deviceId: string, via: 'bluetooth' | 'nfc', nameHint?: string | null) => void;
  nfc: {
    tagId: string | null;
    tagName: string | null;
    reading: boolean;
    error: string | null;
    readTag: () => void;
    cancel: () => void;
    reset: () => void;
  };
};

export function ConnectSheet({
  visible,
  onClose,
  devices,
  scanning,
  connectingId,
  connectedIds,
  bleError,
  onScan,
  onConnect,
  nfc,
}: ConnectSheetProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const deviceNames = useDeviceNames();
  const [method, setMethod] = useState<Method>('choose');
  const [pending, setPending] = useState<PendingConnection | null>(null);
  const [nameInput, setNameInput] = useState('');
  // Remembers which tag we already acted on. Without this, any extra run of the
  // effect below fires a second connect for the same tag, and the resulting
  // connect/fail/retry churn shows up as rapid flicker between states.
  const handledTag = useRef<string | null>(null);

  // Reset to the menu each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setMethod('choose');
      setPending(null);
      handledTag.current = null;
    }
  }, [visible]);

  /**
   * Connects immediately if this device already has a chosen name — asking
   * again every time would be repetitive. A never-before-seen device instead
   * goes to the naming step, pre-filled with whatever name is already known.
   */
  const beginConnect = (deviceId: string, via: 'bluetooth' | 'nfc', defaultName: string | null) => {
    const existing = deviceNames.getName(deviceId);
    if (existing) {
      onConnect(deviceId, via, existing);
      onClose();
      return;
    }
    setPending({ deviceId, via, defaultName });
    setNameInput(defaultName ?? '');
    setMethod('naming');
  };

  const confirmName = () => {
    if (!pending) return;
    const trimmed = nameInput.trim();
    if (trimmed) deviceNames.setName(pending.deviceId, trimmed);
    onConnect(pending.deviceId, pending.via, trimmed || null);
    onClose();
  };

  // A tag read hands back a device id; start the connect (or naming) flow.
  useEffect(() => {
    if (method !== 'nfc' || !nfc.tagId) return;
    if (handledTag.current === nfc.tagId) return;
    handledTag.current = nfc.tagId;
    beginConnect(nfc.tagId, 'nfc', nfc.tagName);
  }, [method, nfc.tagId, nfc.tagName]);

  const dismiss = () => {
    if (nfc.reading) nfc.cancel();
    nfc.reset();
    onClose();
  };

  const openBluetooth = () => {
    setMethod('bluetooth');
    onScan();
  };

  const openNfc = () => {
    // Clear any tag left over from a previous read first. Without this the
    // auto-connect effect below fires the instant this view opens, so the
    // "hold your tag near the phone" state is never seen.
    handledTag.current = null;
    nfc.reset();
    setMethod('nfc');
    nfc.readTag();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={dismiss}>
      <View style={[styles.sheet, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={styles.flex}>
          <View style={[styles.toolbar, { borderBottomColor: theme.separator }]}>
            {method === 'choose' ? (
              <View style={styles.toolbarSpacer} />
            ) : (
              <Pressable accessibilityRole="button" hitSlop={12} onPress={() => setMethod('choose')}>
                <Ionicons name="chevron-back" size={24} color={theme.tint} />
              </Pressable>
            )}
            <ThemedText type="headline">{method === 'naming' ? t.nameDevice : t.connectDevice}</ThemedText>
            <Pressable accessibilityRole="button" hitSlop={12} onPress={dismiss}>
              <ThemedText type="body" style={{ color: theme.tint }}>
                {t.cancel}
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {method === 'choose' ? (
              <>
                <ThemedText type="subhead" themeColor="textSecondary" style={styles.prompt}>
                  {t.chooseMethod}
                </ThemedText>
                <View style={[styles.card, Shadow.card, { backgroundColor: theme.backgroundElement }]}>
                  <MethodRow
                    icon="bluetooth"
                    title={t.scanNearby}
                    subtitle={t.scanNearbyHelp}
                    onPress={openBluetooth}
                  />
                  <View style={[styles.separator, { backgroundColor: theme.separator }]} />
                  <MethodRow
                    icon="radio"
                    title={t.readNfcTag}
                    subtitle={t.tapTagHelp}
                    onPress={openNfc}
                  />
                </View>
              </>
            ) : null}

            {method === 'bluetooth' ? (
              <>
                {bleError ? (
                  <View style={[styles.notice, { backgroundColor: theme.fill, borderLeftColor: theme.danger }]}>
                    <ThemedText type="footnote">{bleError}</ThemedText>
                  </View>
                ) : null}

                {scanning ? (
                  <View style={styles.centered}>
                    <ActivityIndicator color={theme.tint} />
                    <ThemedText type="subhead" themeColor="textSecondary">
                      {t.searching}
                    </ThemedText>
                  </View>
                ) : devices.length === 0 ? (
                  <View style={styles.centered}>
                    <Ionicons name="bluetooth-outline" size={32} color={theme.textTertiary} />
                    <ThemedText type="subhead" themeColor="textSecondary">
                      {t.noDevicesFound}
                    </ThemedText>
                    <Button label={t.scanNearby} variant="tinted" block={false} onPress={onScan} />
                  </View>
                ) : (
                  <View style={[styles.card, Shadow.card, { backgroundColor: theme.backgroundElement }]}>
                    {devices.map((device, index) => (
                      <View key={device.id}>
                        <DeviceRow
                          device={device}
                          connected={connectedIds.includes(device.id)}
                          connecting={connectingId === device.id}
                          onPress={() => beginConnect(device.id, 'bluetooth', device.name)}
                        />
                        {index < devices.length - 1 ? (
                          <View style={[styles.separator, { backgroundColor: theme.separator }]} />
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}

                {!scanning && devices.length > 0 ? (
                  <Button label={t.scanNearby} variant="plain" icon="refresh" onPress={onScan} />
                ) : null}
              </>
            ) : null}

            {method === 'nfc' ? (
              <View style={styles.centered}>
                <NfcHalo active={nfc.reading} failed={!!nfc.error} />
                <ThemedText type="title3">
                  {nfc.reading ? t.waitingForTag : nfc.error ? t.readFailed : t.readNfcTag}
                </ThemedText>
                <ThemedText type="subhead" themeColor="textSecondary" style={styles.prompt}>
                  {nfc.error ?? t.tapTagHelp}
                </ThemedText>
                <Button
                  label={nfc.reading ? t.cancelNfcSearch : t.readNfcTag}
                  variant={nfc.reading ? 'destructive' : 'filled'}
                  onPress={nfc.reading ? nfc.cancel : nfc.readTag}
                />
              </View>
            ) : null}

            {method === 'naming' ? (
              <>
                <ThemedText type="subhead" themeColor="textSecondary" style={styles.prompt}>
                  {t.nameDeviceHelp}
                </ThemedText>
                <TextField
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder={pending?.defaultName ?? t.unnamedDevice}
                  autoCapitalize="words"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={confirmName}
                />
                <Button label={t.connect} onPress={confirmName} />
              </>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/**
 * Android shows no system UI while waiting for a tag, so the app has to make
 * the waiting state obvious itself. The pulse signals "still scanning" rather
 * than leaving a static icon that looks indistinguishable from a frozen screen.
 */
function NfcHalo({ active, failed }: { active: boolean; failed: boolean }) {
  const theme = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const color = failed ? theme.danger : theme.tint;

  return (
    <View style={styles.haloWrap}>
      {active ? (
        <Animated.View
          style={[
            styles.nfcHalo,
            styles.haloRing,
            { backgroundColor: color, opacity, transform: [{ scale }] },
          ]}
        />
      ) : null}
      <View style={[styles.nfcHalo, { backgroundColor: theme.fill }]}>
        <Ionicons name="radio" size={44} color={color} />
      </View>
    </View>
  );
}

function MethodRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [pressed && { backgroundColor: theme.backgroundSelected }]}>
      <View style={styles.methodRow}>
        <View style={[styles.methodIcon, { backgroundColor: theme.tint }]}>
          <Ionicons name={icon} size={20} color={theme.tintContrast} />
        </View>
        <View style={styles.flex}>
          <ThemedText type="body">{title}</ThemedText>
          <ThemedText type="footnote" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={17} color={theme.textTertiary} />
      </View>
    </Pressable>
  );
}

/** Maps RSSI (dBm) onto a 0–3 bar strength, the way OS Wi-Fi/BT pickers do. */
function signalBars(rssi: number | null): number {
  if (rssi === null) return 0;
  if (rssi >= -60) return 3;
  if (rssi >= -75) return 2;
  return 1;
}

function deviceKindIcon(kind: DeviceKind): keyof typeof Ionicons.glyphMap {
  if (kind === 'watch') return 'watch-outline';
  if (kind === 'headphones') return 'headset-outline';
  if (kind === 'speaker') return 'volume-high-outline';
  return 'tv-outline';
}

function deviceKindLabel(kind: DeviceKind, t: Messages): string {
  if (kind === 'watch') return t.deviceKindWatch;
  if (kind === 'headphones') return t.deviceKindHeadphones;
  if (kind === 'speaker') return t.deviceKindSpeaker;
  return t.deviceKindTv;
}

function DeviceRow({
  device,
  connected,
  connecting,
  onPress,
}: {
  device: BleDeviceInfo;
  connected: boolean;
  connecting: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const bars = signalBars(device.rssi);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: connected, busy: connecting }}
      disabled={connected || connecting}
      onPress={onPress}
      style={({ pressed }) => [pressed && { backgroundColor: theme.backgroundSelected }]}>
      <View style={styles.deviceRow}>
        <View style={styles.flex}>
          <View style={styles.deviceTitleRow}>
            <ThemedText
              type="body"
              numberOfLines={1}
              themeColor={device.name ? 'text' : 'textSecondary'}
              style={styles.flexShrink}>
              {device.name ?? t.unnamedDevice}
            </ThemedText>
            {device.advertisesHeartRate ? (
              <View style={[styles.badge, { backgroundColor: `${theme.live}22` }]}>
                <Ionicons name="heart" size={10} color={theme.live} />
                <ThemedText type="caption" style={{ color: theme.live }}>
                  {t.heartRateSensor}
                </ThemedText>
              </View>
            ) : null}
            {device.advertisesCadence ? (
              <View style={[styles.badge, { backgroundColor: `${theme.tint}22` }]}>
                <Ionicons name="walk" size={10} color={theme.tint} />
                <ThemedText type="caption" style={{ color: theme.tint }}>
                  {t.cadenceSensor}
                </ThemedText>
              </View>
            ) : null}
            {device.deviceKind ? (
              <View style={[styles.badge, { backgroundColor: `${theme.textSecondary}22` }]}>
                <Ionicons name={deviceKindIcon(device.deviceKind)} size={10} color={theme.textSecondary} />
                <ThemedText type="caption" themeColor="textSecondary">
                  {deviceKindLabel(device.deviceKind, t)}
                </ThemedText>
              </View>
            ) : null}
          </View>

          {/* The address is always shown — for peripherals that advertise no
              name it is the only way to tell them apart. */}
          <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1} selectable>
            {device.id}
            {device.rssi !== null ? `  ·  ${device.rssi} dBm` : ''}
          </ThemedText>
        </View>

        <View style={styles.signal}>
          {[1, 2, 3].map(level => (
            <View
              key={level}
              style={[
                styles.signalBar,
                { height: 4 + level * 3 },
                { backgroundColor: level <= bars ? theme.textSecondary : theme.separator },
              ]}
            />
          ))}
        </View>

        {connecting ? <ActivityIndicator size="small" color={theme.tint} /> : null}
        {connected ? <Ionicons name="checkmark-circle" size={20} color={theme.live} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  flex: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarSpacer: { width: 24 },
  content: { padding: Spacing.three, gap: Spacing.three },
  prompt: { textAlign: 'center' },
  card: { borderRadius: Radius.lg, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  methodIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    minHeight: 56,
  },
  flexShrink: { flexShrink: 1 },
  deviceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  signal: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  signalBar: { width: 3, borderRadius: 1.5 },
  centered: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.five },
  haloWrap: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  haloRing: { position: 'absolute' },
  nfcHalo: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  notice: {
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderLeftWidth: 3,
  },
});
