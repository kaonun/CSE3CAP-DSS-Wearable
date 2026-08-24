import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConnectSheet } from '@/components/connect-sheet';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/surface';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useBleDevice, useNfc } from '@/connectivity';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

function formatClock(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function StatusPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}1F` }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <ThemedText type="caption" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  return (
    <View style={styles.sparkline}>
      {values.map((value, index) => {
        const ratio = (value - min) / range;
        return (
          <View
            key={index}
            style={[
              styles.sparkBar,
              { height: 8 + ratio * 44, backgroundColor: color, opacity: 0.3 + ratio * 0.7 },
            ]}
          />
        );
      })}
    </View>
  );
}

export default function WearableScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const ble = useBleDevice();
  const nfc = useNfc();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isConnected = ble.connectedDeviceIds.length > 0;
  const isBusy = ble.status === 'connecting' || ble.status === 'disconnecting';

  const statusCopy: Record<string, string> = {
    idle: t.ready,
    scanning: t.searching,
    connecting: t.connecting,
    connected: t.active,
    disconnecting: t.connecting,
    error: t.connectionError,
  };

  const statusColor =
    ble.status === 'error' ? theme.danger : isConnected ? theme.live : theme.textSecondary;

  // The most recent history entry names whichever device is live right now.
  const activeDevice = useMemo(
    () => ble.connectionHistory.find(entry => ble.connectedDeviceIds.includes(entry.id)),
    [ble.connectionHistory, ble.connectedDeviceIds],
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="largeTitle">{t.wearable}</ThemedText>
            <ThemedText type="subhead" themeColor="textSecondary">
              {t.homeSubtitle}
            </ThemedText>
          </View>

          {/* Live metrics */}
          <Card style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroLabels}>
                <ThemedText type="footnote" themeColor="textSecondary" style={styles.label}>
                  {t.connection}
                </ThemedText>
                <ThemedText type="headline" numberOfLines={1}>
                  {isConnected && activeDevice
                    ? (activeDevice.name || t.unnamedDevice)
                    : (statusCopy[ble.status] ?? ble.status)}
                </ThemedText>
              </View>
              <StatusPill label={isConnected ? t.connected : t.notConnected} color={statusColor} />
            </View>

            <View style={styles.metricRow}>
              <ThemedText type="metric" themeColor={ble.heartRate ? 'text' : 'textTertiary'}>
                {ble.heartRate ?? '--'}
              </ThemedText>
              <ThemedText type="title3" themeColor="textSecondary" style={styles.unit}>
                {t.bpm}
              </ThemedText>
            </View>

            {ble.heartRateHistory.length > 1 ? (
              <Sparkline values={ble.heartRateHistory} color={theme.tint} />
            ) : (
              <View style={styles.emptyTrace}>
                <ThemedText type="footnote" themeColor="textTertiary">
                  {t.noLiveReading}
                </ThemedText>
              </View>
            )}
          </Card>

          {/* One connection entry point for both Bluetooth and NFC */}
          {isConnected ? (
            <Button
              label={t.disconnect}
              variant="destructive"
              loading={isBusy}
              disabled={isBusy}
              onPress={() => ble.disconnect()}
            />
          ) : (
            <Button
              label={t.connectDevice}
              icon="add-circle-outline"
              loading={isBusy}
              disabled={isBusy}
              onPress={() => setSheetOpen(true)}
            />
          )}

          {ble.error && !sheetOpen ? (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: theme.fill, borderLeftColor: theme.danger },
              ]}>
              <Ionicons name="warning" size={16} color={theme.danger} />
              <ThemedText type="footnote" style={styles.flex}>
                {ble.error}
              </ThemedText>
            </View>
          ) : null}

          {/* History */}
          {ble.connectionHistory.length > 0 ? (
            <View style={styles.section}>
              <ThemedText type="footnote" themeColor="textSecondary" style={styles.sectionHeader}>
                {t.recentActivity.toUpperCase()}
              </ThemedText>
              <Card>
                {ble.connectionHistory.map((entry, index) => {
                  const live = ble.connectedDeviceIds.includes(entry.id);
                  return (
                    <View key={`${entry.id}-${entry.connectedAt}-${index}`}>
                      <View style={styles.historyRow}>
                        <View style={[styles.historyIcon, { backgroundColor: theme.fill }]}>
                          <Ionicons name="watch-outline" size={18} color={theme.tint} />
                        </View>
                        <View style={styles.flex}>
                          <ThemedText type="body" numberOfLines={1}>
                            {entry.name || t.unnamedDevice}
                          </ThemedText>
                          <ThemedText type="footnote" themeColor="textSecondary">
                            {live ? t.connected : t.bluetoothWearable}
                          </ThemedText>
                        </View>
                        <ThemedText type="footnote" themeColor="textTertiary">
                          {formatClock(entry.connectedAt)}
                        </ThemedText>
                      </View>
                      {index < ble.connectionHistory.length - 1 ? (
                        <View style={[styles.separator, { backgroundColor: theme.separator }]} />
                      ) : null}
                    </View>
                  );
                })}
              </Card>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      <ConnectSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        devices={ble.devices}
        scanning={ble.status === 'scanning'}
        connectingId={ble.status === 'connecting' ? ble.connectingDeviceId : null}
        connectedIds={ble.connectedDeviceIds}
        bleError={ble.error}
        onScan={ble.scan}
        onConnect={ble.connect}
        nfc={nfc}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: { paddingTop: Spacing.three, gap: Spacing.half },
  label: { textTransform: 'uppercase', letterSpacing: 0.6 },

  hero: { padding: Spacing.four, gap: Spacing.three },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.two },
  heroLabels: { flex: 1, gap: Spacing.half },
  metricRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  unit: { marginBottom: Spacing.one },
  emptyTrace: { height: 52, justifyContent: 'center' },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 1,
    borderRadius: Radius.full,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },

  sparkline: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 52 },
  sparkBar: { flex: 1, maxWidth: 6, borderRadius: 3 },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderLeftWidth: 3,
  },

  section: { gap: Spacing.two },
  sectionHeader: { marginLeft: Spacing.three, letterSpacing: 0.6 },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  historyIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three },
});
