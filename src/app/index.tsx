import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConnectSheet } from '@/components/connect-sheet';
import { BeatingHeart, HeartRateTrace } from '@/components/heart-rate-trace';
import { MetricPicker } from '@/components/metric-picker';
import { RenameDeviceModal } from '@/components/rename-device-modal';
import { SessionDuration } from '@/components/session-duration';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/surface';
import { MaxContentWidth, Radius, Shadow, Spacing } from '@/constants/theme';
import { ConnectedDevice, DeviceCapabilities, useBleDevice, useNfc } from '@/connectivity';
import { characteristicUuidFromMetricId } from '@/connectivity/customMetric';
import { useAlertPreferences } from '@/alerts';
import { useReadingSyncContext } from '@/data/reading-sync-context';
import { useDeviceNames } from '@/device-names';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, type Messages } from '@/i18n';
import { metricColor, metricIcon, resolveMetricInfo, useMetricPreference, type CustomMetricDef } from '@/metrics';

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

/** The main figure for a device's card — the first of its active metrics. */
function PrimaryMetric({
  metric,
  device,
  customMetrics,
  theme,
  t,
}: {
  metric: string;
  device: ConnectedDevice;
  customMetrics: CustomMetricDef[];
  theme: ReturnType<typeof useTheme>;
  t: Messages;
}) {
  const value = device.readings[metric];
  const history = device.history[metric] ?? [];
  const info = resolveMetricInfo(metric, customMetrics, t);

  return (
    <>
      <View style={styles.metricRow}>
        <BeatingHeart
          beatKey={device.updatedAt}
          idle={value === null}
          icon={metricIcon(metric)}
          activeColor={metricColor(metric, theme)}
        />
        <ThemedText type="metric" themeColor={value !== null ? 'text' : 'textTertiary'}>
          {value ?? '--'}
        </ThemedText>
        <View style={styles.unitCol}>
          {info.unit ? (
            <ThemedText type="title3" themeColor="textSecondary">
              {info.unit}
            </ThemedText>
          ) : null}
          {info.derived ? (
            <ThemedText type="caption" themeColor="textTertiary">
              {t.estimated}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {history.length > 1 ? (
        <HeartRateTrace values={history} color={metricColor(metric, theme)} />
      ) : (
        <View style={styles.emptyTrace}>
          <ThemedText type="footnote" themeColor="textTertiary">
            {t.noLiveReading}
          </ThemedText>
        </View>
      )}
    </>
  );
}

/** A compact secondary reading shown alongside the primary metric. */
function SecondaryMetric({
  metric,
  device,
  customMetrics,
  t,
  onRemove,
}: {
  metric: string;
  device: ConnectedDevice;
  customMetrics: CustomMetricDef[];
  t: Messages;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const value = device.readings[metric];
  const info = resolveMetricInfo(metric, customMetrics, t);

  return (
    <View style={styles.metricTile}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.removeMetric.replace('{metric}', info.label)}
        hitSlop={8}
        onPress={onRemove}
        style={({ pressed }) => [styles.removeMetric, { opacity: pressed ? 0.5 : 1 }]}>
        <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
      </Pressable>
      <Ionicons name={metricIcon(metric)} size={15} color={value !== null ? metricColor(metric, theme) : theme.textTertiary} />
      <ThemedText type="title2" themeColor={value !== null ? 'text' : 'textTertiary'}>
        {value ?? '--'}
      </ThemedText>
      <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
        {info.unit || info.label}
        {info.derived ? ` · ${t.estimated}` : ''}
      </ThemedText>
    </View>
  );
}

/** Same footprint as a metric tile — an inline shortcut to add another one. */
function AddMetricTile({ onPress, t }: { onPress: () => void; t: Messages }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.addMetrics}
      onPress={onPress}
      style={({ pressed }) => [styles.metricTile, styles.addMetricTile, { borderColor: theme.separator, opacity: pressed ? 0.6 : 1 }]}>
      <Ionicons name="add-circle-outline" size={22} color={theme.tint} />
      <ThemedText type="caption" themeColor="textSecondary">
        {t.addMetrics}
      </ThemedText>
    </Pressable>
  );
}

export default function WearableScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const sync = useReadingSyncContext();
  const metricPreference = useMetricPreference();
  const customMetricTargets = metricPreference.customMetrics.map(def => ({
    id: def.id,
    characteristicUuid: characteristicUuidFromMetricId(def.id) ?? '',
  }));
  // Readings flow straight into the aggregator, which batches them into
  // one-minute summaries before they reach Firestore.
  const ble = useBleDevice(sync.record, customMetricTargets);
  const nfc = useNfc();
  const deviceNames = useDeviceNames();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [metricPickerOpen, setMetricPickerOpen] = useState(false);
  const [renamingDeviceId, setRenamingDeviceId] = useState<string | null>(null);

  // Keep the aggregator's device-name lookup current so stored summaries carry
  // a readable name alongside the id.
  const { setDeviceName } = sync;
  useEffect(() => {
    ble.connectedDevices.forEach(device => setDeviceName(device.id, device.name));
  }, [ble.connectedDevices, setDeviceName]);

  // Offer to set up threshold alerts the first time a device connects, so the
  // feature is discovered at the moment it becomes useful. Only once, and only
  // while no thresholds exist — someone who already set one does not need it.
  const alerts = useAlertPreferences();
  const wasConnected = useRef(false);
  useEffect(() => {
    const nowConnected = ble.connectedDevices.length > 0;
    const justConnected = nowConnected && !wasConnected.current;
    wasConnected.current = nowConnected;

    if (!justConnected || alerts.loading || alerts.promptSeen) return;
    if (Object.keys(alerts.rules).length > 0) return;

    alerts.markPromptSeen();
    Alert.alert(t.alertPromptTitle, t.alertPromptBody, [
      { text: t.alertPromptDismiss, style: 'cancel' },
      { text: t.alertPromptConfirm, onPress: () => router.push('/alerts') },
    ]);
  }, [ble.connectedDevices, alerts, router, t]);

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

  // What the metric picker should grey out — the union of every connected
  // device's real, GATT-discovered capabilities. Nothing to grey out yet
  // when no device is connected.
  const unionCapabilities: DeviceCapabilities | null = isConnected
    ? ble.connectedDevices.reduce<DeviceCapabilities>((union, device) => {
        const merged: DeviceCapabilities = { ...union };
        for (const [metric, supported] of Object.entries(device.capabilities)) {
          merged[metric] = merged[metric] || supported;
        }
        return merged;
      }, {})
    : null;

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
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.changeMetrics}
                hitSlop={12}
                onPress={() => setMetricPickerOpen(true)}
                style={({ pressed }) => [
                  styles.headerButton,
                  { backgroundColor: theme.fill, opacity: pressed ? 0.6 : 1 },
                ]}>
                <Ionicons name="options-outline" size={20} color={theme.tint} />
              </Pressable>
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
          </View>

          {/* One live card per connected device. */}
          {isConnected ? (
            ble.connectedDevices.map(device => {
              const activeMetrics = metricPreference.visibleFor(device.capabilities);
              const [primaryMetric, ...secondaryMetrics] = activeMetrics;
              return (
              <Card key={device.id} style={styles.hero}>
                <View style={styles.heroTop}>
                  <View style={styles.heroLabels}>
                    <ThemedText type="footnote" themeColor="textSecondary" style={styles.label}>
                      {t.connection}
                    </ThemedText>
                    <View style={styles.nameRow}>
                      <ThemedText type="headline" numberOfLines={1} style={styles.nameText}>
                        {device.name || t.unnamedDevice}
                      </ThemedText>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t.renameDevice}
                        hitSlop={8}
                        onPress={() => setRenamingDeviceId(device.id)}>
                        <Ionicons name="pencil" size={14} color={theme.textSecondary} />
                      </Pressable>
                    </View>
                    {/* The address is the only reliable identifier when a
                        peripheral advertises no name. */}
                    <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1} selectable>
                      {device.id}
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

                {primaryMetric ? (
                  <PrimaryMetric
                    metric={primaryMetric}
                    device={device}
                    customMetrics={metricPreference.customMetrics}
                    theme={theme}
                    t={t}
                  />
                ) : (
                  <Pressable onPress={() => setMetricPickerOpen(true)} style={styles.emptyTrace}>
                    <ThemedText type="footnote" themeColor="textTertiary">
                      {t.noMetricsSelected}
                    </ThemedText>
                  </Pressable>
                )}

                {primaryMetric ? (
                  <View style={styles.secondaryRow}>
                    {secondaryMetrics.map(metric => (
                      <SecondaryMetric
                        key={metric}
                        metric={metric}
                        device={device}
                        customMetrics={metricPreference.customMetrics}
                        t={t}
                        onRemove={() => metricPreference.toggleMetric(metric)}
                      />
                    ))}
                    <AddMetricTile onPress={() => setMetricPickerOpen(true)} t={t} />
                  </View>
                ) : null}
              </Card>
              );
            })
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

          {/* A disconnect the user asked for is a confirmation, not a fault. */}
          {ble.disconnectedNames.length > 0 ? (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: theme.fill, borderLeftColor: theme.textTertiary },
              ]}>
              <Ionicons name="checkmark-circle" size={16} color={theme.textSecondary} />
              <ThemedText type="footnote" themeColor="textSecondary" style={styles.flex}>
                {t.disconnectedFrom.replace('{device}', ble.disconnectedNames.join(', '))}
              </ThemedText>
            </View>
          ) : ble.error && !sheetOpen ? (
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
                        {/* Icon reflects how the device was found — scanned or
                            tapped — which is what makes an entry recognisable. */}
                        <View style={[styles.historyIcon, { backgroundColor: theme.fill }]}>
                          <Ionicons
                            name={entry.via === 'nfc' ? 'radio' : 'bluetooth'}
                            size={18}
                            color={theme.tint}
                          />
                        </View>
                        <View style={styles.flex}>
                          <ThemedText type="body" numberOfLines={1}>
                            {entry.name || t.unnamedDevice}
                          </ThemedText>
                          <ThemedText type="caption" themeColor="textTertiary" numberOfLines={1} selectable>
                            {entry.id}
                          </ThemedText>
                          <ThemedText
                            type="footnote"
                            style={{ color: live ? theme.live : theme.textSecondary }}>
                            {live ? t.connected : t.bluetoothWearable}
                          </ThemedText>
                        </View>
                        <View style={styles.historyMeta}>
                          <ThemedText type="footnote" themeColor="textTertiary">
                            {formatClock(entry.connectedAt)}
                          </ThemedText>
                          <SessionDuration
                            connectedAt={entry.connectedAt}
                            disconnectedAt={entry.disconnectedAt}
                          />
                        </View>
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

      <MetricPicker
        visible={metricPickerOpen}
        onClose={() => setMetricPickerOpen(false)}
        capabilities={unionCapabilities}
      />

      <RenameDeviceModal
        visible={renamingDeviceId !== null}
        currentName={ble.connectedDevices.find(device => device.id === renamingDeviceId)?.name ?? null}
        onSave={name => {
          if (!renamingDeviceId) return;
          deviceNames.setName(renamingDeviceId, name);
          ble.renameDevice(renamingDeviceId, name);
        }}
        onClose={() => setRenamingDeviceId(null)}
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
    // Extra room so the floating history button never covers the last card —
    // generous because the hero card's height varies with how many metrics
    // are shown.
    paddingBottom: Spacing.six * 2,
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  floatingLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: Spacing.two,
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2 },
  nameText: { flexShrink: 1 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardAction: { padding: Spacing.half },
  emptyState: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  centered: { textAlign: 'center' },
  metricRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  unit: { marginBottom: Spacing.one },
  unitCol: { marginBottom: Spacing.one, gap: 0 },
  emptyTrace: { height: 52, justifyContent: 'center' },
  secondaryRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.three },
  metricTile: { alignItems: 'flex-start', gap: 1, paddingTop: Spacing.two, position: 'relative' },
  removeMetric: { position: 'absolute', top: -4, right: -4 },
  addMetricTile: {
    alignItems: 'center',
    gap: Spacing.half,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
  },

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
  historyMeta: { alignItems: 'flex-end', gap: 1 },
  historyIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three },
});
