import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConnectSheet } from '@/components/connect-sheet';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/surface';
import { MaxContentWidth, Radius, Shadow, Spacing } from '@/constants/theme';
import { useBleDevice, useNfc } from '@/connectivity';
import { useReadingSync } from '@/data/use-reading-sync';
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
  const router = useRouter();
  const sync = useReadingSync();
  // Readings flow straight into the aggregator, which batches them into
  // one-minute summaries before they reach Firestore.
  const ble = useBleDevice(sync.record);
  const nfc = useNfc();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Keep the aggregator's device-name lookup current so stored summaries carry
  // a readable name alongside the id.
  const { setDeviceName } = sync;
  useEffect(() => {
    ble.connectedDevices.forEach(device => setDeviceName(device.id, device.name));
  }, [ble.connectedDevices, setDeviceName]);

  const connectedCount = ble.connectedDevices.length;
  const isConnected = connectedCount > 0;
  const isBusy = ble.status === 'connecting' || ble.status === 'disconnecting';

  const statusCopy: Record<string, string> = {
    idle: t.ready,
    scanning: t.searching,
    connecting: t.connecting,
    connected: t.active,
    disconnecting: t.connecting,
    error: t.connectionError,
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <ThemedText type="largeTitle">{t.appName}</ThemedText>
              <ThemedText type="subhead" themeColor="textSecondary">
                {t.metrics}
              </ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.settings}
              hitSlop={12}
              onPress={() => router.push('/settings')}
              style={({ pressed }) => [
                styles.headerButton,
                { backgroundColor: theme.fill, opacity: pressed ? 0.6 : 1 },
              ]}>
              <Ionicons name="settings-outline" size={20} color={theme.tint} />
            </Pressable>
          </View>

          {/* One live card per connected device. */}
          {isConnected ? (
            ble.connectedDevices.map(device => (
              <Card key={device.id} style={styles.hero}>
                <View style={styles.heroTop}>
                  <View style={styles.heroLabels}>
                    <ThemedText type="footnote" themeColor="textSecondary" style={styles.label}>
                      {t.connection}
                    </ThemedText>
                    <ThemedText type="headline" numberOfLines={1}>
                      {device.name || t.unnamedDevice}
                    </ThemedText>
                  </View>
                  <View style={styles.heroActions}>
                    <StatusPill label={t.connected} color={theme.live} />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${t.disconnect} ${device.name ?? t.unnamedDevice}`}
                      hitSlop={10}
                      disabled={isBusy}
                      onPress={() => ble.disconnect(device.id)}
                      style={({ pressed }) => [styles.cardAction, { opacity: pressed ? 0.5 : 1 }]}>
                      <Ionicons name="close-circle" size={22} color={theme.danger} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.metricRow}>
                  <ThemedText type="metric" themeColor={device.heartRate ? 'text' : 'textTertiary'}>
                    {device.heartRate ?? '--'}
                  </ThemedText>
                  <ThemedText type="title3" themeColor="textSecondary" style={styles.unit}>
                    {t.bpm}
                  </ThemedText>
                </View>

                {device.history.length > 1 ? (
                  <Sparkline values={device.history} color={theme.tint} />
                ) : (
                  <View style={styles.emptyTrace}>
                    <ThemedText type="footnote" themeColor="textTertiary">
                      {t.noLiveReading}
                    </ThemedText>
                  </View>
                )}
              </Card>
            ))
          ) : (
            <Card style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.heroLabels}>
                  <ThemedText type="footnote" themeColor="textSecondary" style={styles.label}>
                    {t.connection}
                  </ThemedText>
                  <ThemedText type="headline">{statusCopy[ble.status] ?? ble.status}</ThemedText>
                </View>
                <StatusPill
                  label={t.notConnected}
                  color={ble.status === 'error' ? theme.danger : theme.textSecondary}
                />
              </View>
              <View style={styles.emptyState}>
                <Ionicons name="pulse-outline" size={30} color={theme.textTertiary} />
                <ThemedText type="body" themeColor="textSecondary">
                  {t.noDeviceConnected}
                </ThemedText>
                <ThemedText type="footnote" themeColor="textTertiary" style={styles.centered}>
                  {t.noDeviceConnectedHelp}
                </ThemedText>
              </View>
            </Card>
          )}

          {/* One connection entry point for both Bluetooth and NFC */}
          <Button
            label={isConnected ? t.connectAnother : t.connectDevice}
            icon="add-circle-outline"
            variant={isConnected ? 'tinted' : 'filled'}
            loading={isBusy}
            disabled={isBusy}
            onPress={() => setSheetOpen(true)}
          />

          {connectedCount > 1 ? (
            <Button
              label={t.disconnectAll}
              variant="plain"
              disabled={isBusy}
              onPress={() => ble.disconnect()}
            />
          ) : null}

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

      {/* Floating history entry point, anchored bottom-centre and clear of the
          system navigation bar. */}
      <SafeAreaView style={styles.floatingLayer} edges={['bottom']} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.history}
          onPress={() => router.push('/history')}
          style={({ pressed }) => [
            styles.historyButton,
            Shadow.floating,
            { backgroundColor: theme.backgroundElement, borderColor: theme.separator },
            pressed && { opacity: 0.75 },
          ]}>
          <Ionicons name="stats-chart" size={17} color={theme.tint} />
          <ThemedText type="footnote" style={{ color: theme.tint }}>
            {t.history}
          </ThemedText>
        </Pressable>
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
    // Extra room so the floating history button never covers the last card.
    paddingBottom: Spacing.six + Spacing.five,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    paddingTop: Spacing.three,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  headerText: { flex: 1, gap: Spacing.half },
  floatingLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: Spacing.three,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  label: { textTransform: 'uppercase', letterSpacing: 0.6 },

  hero: { padding: Spacing.four, gap: Spacing.three },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.two },
  heroLabels: { flex: 1, gap: Spacing.half },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardAction: { padding: Spacing.half },
  emptyState: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  centered: { textAlign: 'center' },
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
