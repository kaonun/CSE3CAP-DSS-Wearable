import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

/** Small coloured status chip, mirroring the iOS "capsule" affordance. */
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
              { height: 6 + ratio * 30, backgroundColor: color, opacity: 0.3 + ratio * 0.7 },
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

  const isConnected = ble.connectedDeviceIds.length > 0;
  const isBusy =
    ble.status === 'scanning' || ble.status === 'connecting' || ble.status === 'disconnecting';

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

  const primaryLabel = useMemo(() => {
    if (ble.status === 'scanning') return `${t.searching}...`;
    if (ble.status === 'connecting') return `${t.connecting}...`;
    return isConnected ? t.disconnect : t.scanForWearables;
  }, [ble.status, isConnected, t]);

  const nfcStatusLabel = nfc.error
    ? t.readFailed
    : nfc.reading
      ? t.waitingForTag
      : nfc.tagId
        ? t.tagReady
        : t.notScanned;

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

          {/* Live reading hero */}
          <Card style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.heroLabels}>
                <ThemedText type="footnote" themeColor="textSecondary" style={styles.label}>
                  {t.connection}
                </ThemedText>
                <ThemedText type="headline">{statusCopy[ble.status] ?? ble.status}</ThemedText>
              </View>
              <StatusPill
                label={isConnected ? t.connected : t.notConnected}
                color={statusColor}
              />
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
              <ThemedText type="footnote" themeColor="textTertiary">
                {t.noLiveReading}
              </ThemedText>
            )}

            <Button
              label={primaryLabel}
              onPress={isConnected ? () => ble.disconnect() : () => ble.scan()}
              disabled={isBusy}
              loading={isBusy}
              variant={isConnected ? 'destructive' : 'filled'}
              icon={isConnected ? undefined : 'bluetooth'}
            />
          </Card>

          {ble.error ? (
            <View style={[styles.errorBanner, { backgroundColor: theme.fill, borderLeftColor: theme.danger }]}>
              <Ionicons name="warning" size={16} color={theme.danger} />
              <ThemedText type="footnote" style={styles.flex}>
                {ble.error}
              </ThemedText>
            </View>
          ) : null}

          {/* Discovered devices */}
          {ble.devices.length > 0 ? (
            <View style={styles.section}>
              <ThemedText type="footnote" themeColor="textSecondary" style={styles.sectionHeader}>
                {t.nearbyDevices.toUpperCase()}
              </ThemedText>
              <Card>
                {ble.devices.map((device, index) => {
                  const connected = ble.connectedDeviceIds.includes(device.id);
                  return (
                    <View key={device.id}>
                      <View style={styles.deviceRow}>
                        <View style={[styles.deviceIcon, { backgroundColor: theme.fill }]}>
                          <Ionicons name="watch-outline" size={18} color={theme.tint} />
                        </View>
                        <View style={styles.deviceInfo}>
                          <ThemedText type="body" numberOfLines={1}>
                            {device.name}
                          </ThemedText>
                          <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1} selectable>
                            {device.id}
                          </ThemedText>
                        </View>
                        {connected ? (
                          <StatusPill label={t.connected} color={theme.live} />
                        ) : (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => ble.connect(device.id)}
                            disabled={isBusy}
                            style={({ pressed }) => [
                              styles.connectChip,
                              { backgroundColor: theme.fill, opacity: isBusy ? 0.4 : pressed ? 0.7 : 1 },
                            ]}>
                            <ThemedText type="footnote" style={{ color: theme.tint }}>
                              {t.connect}
                            </ThemedText>
                          </Pressable>
                        )}
                      </View>
                      {index < ble.devices.length - 1 ? (
                        <View style={[styles.separator, { backgroundColor: theme.separator }]} />
                      ) : null}
                    </View>
                  );
                })}
              </Card>
            </View>
          ) : null}

          {/* NFC quick connect */}
          <View style={styles.section}>
            <ThemedText type="footnote" themeColor="textSecondary" style={styles.sectionHeader}>
              {t.nfc.toUpperCase()}
            </ThemedText>
            <Card style={styles.nfcCard}>
              <View style={styles.nfcHeader}>
                <View style={[styles.deviceIcon, { backgroundColor: theme.fill }]}>
                  <Ionicons name="radio-outline" size={18} color={theme.tint} />
                </View>
                <View style={styles.flex}>
                  <ThemedText type="body">{t.quickConnect}</ThemedText>
                  <ThemedText type="footnote" themeColor="textSecondary">
                    {nfcStatusLabel}
                  </ThemedText>
                </View>
              </View>

              <ThemedText type="footnote" themeColor="textTertiary">
                {nfc.error ?? t.nfcHelp}
              </ThemedText>

              <Button
                label={
                  nfc.reading ? t.cancelNfcSearch : nfc.tagId ? t.connectTagDevice : t.readNfcTag
                }
                variant={nfc.reading ? 'destructive' : 'tinted'}
                onPress={
                  nfc.reading
                    ? nfc.cancel
                    : nfc.tagId
                      ? () => ble.connect(nfc.tagId as string)
                      : nfc.readTag
                }
              />
            </Card>
          </View>

          {/* History */}
          {ble.connectionHistory.length > 0 ? (
            <View style={styles.section}>
              <ThemedText type="footnote" themeColor="textSecondary" style={styles.sectionHeader}>
                {t.recentActivity.toUpperCase()}
              </ThemedText>
              <Card>
                {ble.connectionHistory.map((entry, index) => (
                  <View key={`${entry.id}-${entry.connectedAt}-${index}`}>
                    <View style={styles.historyRow}>
                      <View style={styles.flex}>
                        <ThemedText type="body" numberOfLines={1}>
                          {entry.name}
                        </ThemedText>
                        <ThemedText type="footnote" themeColor="textSecondary">
                          {t.bluetoothWearable}
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
                ))}
              </Card>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
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
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: { paddingTop: Spacing.three, gap: Spacing.half },
  label: { textTransform: 'uppercase', letterSpacing: 0.6 },

  hero: { padding: Spacing.four, gap: Spacing.three },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  heroLabels: { gap: Spacing.half },
  metricRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  unit: { marginBottom: Spacing.one },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 1,
    borderRadius: Radius.full,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },

  sparkline: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 36 },
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

  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  deviceIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceInfo: { flex: 1, gap: 1 },
  connectChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.full,
  },

  nfcCard: { padding: Spacing.three, gap: Spacing.three },
  nfcHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three },
});
