import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useBleDevice, useNfc } from '@/connectivity';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

function formatClock(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  return (
    <View style={styles.sparkline}>
      {values.map((value, index) => {
        const ratio = (value - min) / range;
        const height = 4 + ratio * 20;
        return <View key={index} style={[styles.sparkBar, { height, opacity: 0.35 + ratio * 0.65 }]} />;
      })}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  variant,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant: 'scan' | 'disconnect';
}) {
  const backgroundColor = variant === 'disconnect' ? '#E5484D' : '#3C87F7';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryButton,
        { backgroundColor, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}>
      <ThemedText type="smallBold" style={styles.primaryButtonLabel}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export default function WearableScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const statusCopy: Record<string, string> = {
    idle: t.ready,
    scanning: t.searching,
    connecting: t.connecting,
    connected: t.active,
    disconnecting: t.connecting,
    error: t.connectionError,
  };
  const ble = useBleDevice();
  const nfc = useNfc();

  const isConnected = ble.connectedDeviceIds.length > 0;
  const isBusy = ble.status === 'scanning' || ble.status === 'connecting' || ble.status === 'disconnecting';

  const primaryLabel = useMemo(() => {
    if (ble.status === 'scanning') return `${t.searching}...`;
    if (ble.status === 'connecting') return `${t.connecting}...`;
    if (isConnected) return t.disconnect;
    return t.scanForWearables;
  }, [ble.status, isConnected]);

  const onPrimaryPress = () => {
    if (isConnected) {
      ble.disconnect();
    } else {
      ble.scan();
    }
  };

  const onNfcConnect = () => {
    if (nfc.tagId) ble.connect(nfc.tagId);
  };

  const nfcStatusLabel = nfc.error
    ? 'Read failed'
    : nfc.reading
      ? 'Waiting for tag'
      : nfc.tagId
        ? 'Tag ready'
        : 'Not scanned';

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.eyebrow}>
              FUSION FIVE
            </ThemedText>
            <ThemedText type="subtitle">Wearable</ThemedText>
            <ThemedText themeColor="textSecondary">A quiet view of your live connection.</ThemedText>
          </View>

          <ThemedView type="backgroundSelected" style={styles.statusBar}>
            <View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
                CONNECTION
              </ThemedText>
              <ThemedText type="smallBold">{statusCopy[ble.status] ?? ble.status}</ThemedText>
            </View>
            <View style={styles.statusBarSignal}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
                SIGNAL
              </ThemedText>
              <ThemedText type="smallBold">{ble.heartRate ? `${ble.heartRate} bpm` : '--'}</ThemedText>
            </View>
          </ThemedView>

          {ble.error ? (
            <ThemedView type="backgroundElement" style={styles.errorBanner}>
              <ThemedText type="small" themeColor="text">
                {ble.error}
              </ThemedText>
            </ThemedView>
          ) : null}

          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
                  BLUETOOTH
                </ThemedText>
                <ThemedText type="smallBold">Nearby devices</ThemedText>
              </View>
              <View style={[styles.dot, { backgroundColor: isConnected ? '#30B855' : theme.textSecondary }]} />
            </View>

            <ThemedText type="small" themeColor="textSecondary">
              {isConnected ? 'Connected' : 'Not connected'}
            </ThemedText>

            <ThemedText type="title" style={styles.bpmValue}>
              {ble.heartRate ? `${ble.heartRate} bpm` : '-- bpm'}
            </ThemedText>
            {ble.heartRateHistory.length > 1 ? (
              <Sparkline values={ble.heartRateHistory} />
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                No live reading yet
              </ThemedText>
            )}

            <PrimaryButton
              label={primaryLabel}
              onPress={onPrimaryPress}
              disabled={isBusy}
              variant={isConnected ? 'disconnect' : 'scan'}
            />

            {ble.devices.length > 0 ? (
              <View style={styles.deviceList}>
                {ble.devices.map((device) => {
                  const connected = ble.connectedDeviceIds.includes(device.id);
                  return (
                    <View key={device.id} style={styles.deviceRow}>
                      <View style={styles.deviceInfo}>
                        <ThemedText type="smallBold">{device.name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary" selectable>
                          {device.id}
                        </ThemedText>
                      </View>
                      {connected ? (
                        <ThemedText type="smallBold" style={styles.connectedLabel}>
                          Connected
                        </ThemedText>
                      ) : (
                        <Pressable
                          onPress={() => ble.connect(device.id)}
                          disabled={isBusy}
                          style={({ pressed }) => [
                            styles.connectChip,
                            { backgroundColor: theme.backgroundSelected, opacity: pressed ? 0.7 : 1 },
                          ]}>
                          <ThemedText type="smallBold">Connect</ThemedText>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : null}
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View>
                <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
                  NFC
                </ThemedText>
                <ThemedText type="smallBold">Quick connect</ThemedText>
              </View>
              <ThemedText type="small" style={styles.linkPrimary}>
                NFC
              </ThemedText>
            </View>

            <ThemedText type="small" themeColor="textSecondary" style={styles.upper}>
              {nfcStatusLabel.toUpperCase()}
            </ThemedText>

            {nfc.error ? (
              <ThemedText type="small" themeColor="text">
                {nfc.error}
              </ThemedText>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Use an NFC tag to identify a wearable.
              </ThemedText>
            )}

            <Pressable
              onPress={nfc.reading ? nfc.cancel : nfc.tagId ? onNfcConnect : nfc.readTag}
              disabled={false}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: nfc.reading ? '#E5484D' : '#3C87F7', opacity: pressed ? 0.85 : 1 },
              ]}>
              <ThemedText type="smallBold" style={styles.primaryButtonLabel}>
                {nfc.reading ? 'Cancel NFC search' : nfc.tagId ? 'Connect tag device' : 'Read NFC tag'}
              </ThemedText>
            </Pressable>
          </ThemedView>

          {ble.connectionHistory.length > 0 ? (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
                RECENT ACTIVITY
              </ThemedText>
              <ThemedText type="smallBold">Connected devices</ThemedText>
              <View style={styles.historyList}>
                {ble.connectionHistory.map((entry, index) => (
                  <View key={`${entry.id}-${entry.connectedAt}-${index}`} style={styles.historyRow}>
                    <View>
                      <ThemedText type="smallBold">{entry.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Bluetooth wearable
                      </ThemedText>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatClock(entry.connectedAt)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </ThemedView>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.three,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  header: { paddingTop: Spacing.four, gap: Spacing.one },
  eyebrow: { letterSpacing: 1.5, textTransform: 'uppercase' },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  statusBarSignal: { alignItems: 'flex-end' },
  label: { textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.half },
  errorBanner: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderLeftWidth: 3,
    borderLeftColor: '#E5484D',
  },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: Spacing.one },
  bpmValue: { fontSize: 40, lineHeight: 44 },
  sparkline: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 24, marginBottom: Spacing.one },
  sparkBar: { width: 4, borderRadius: 2, backgroundColor: '#3C87F7' },
  primaryButton: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.two },
  primaryButtonLabel: { color: '#FFFFFF' },
  deviceList: { marginTop: Spacing.two, gap: Spacing.three },
  deviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.25)',
  },
  deviceInfo: { flexShrink: 1, paddingRight: Spacing.two },
  connectChip: { borderRadius: Spacing.five, paddingVertical: Spacing.one, paddingHorizontal: Spacing.three },
  connectedLabel: { color: '#30B855' },
  linkPrimary: { color: '#3C87F7' },
  upper: { textTransform: 'uppercase', letterSpacing: 1 },
  historyList: { marginTop: Spacing.one, gap: Spacing.two },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.25)',
  },
});
