import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { useThemePreference, type ThemePreference } from '@/theme-preference';

export function ThemePicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();
  const { preference, setPreference } = useThemePreference();

  const options: { key: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'light', label: t.themeLight, icon: 'sunny-outline' },
    { key: 'dark', label: t.themeDark, icon: 'moon-outline' },
    { key: 'system', label: t.themeSystem, icon: 'phone-portrait-outline' },
  ];

  const choose = (next: ThemePreference) => {
    setPreference(next);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={[styles.toolbar, { borderBottomColor: theme.separator }]}>
            <ThemedText type="headline">{t.theme}</ThemedText>
            <Pressable accessibilityRole="button" hitSlop={12} onPress={onClose}>
              <ThemedText type="body" style={{ color: theme.tint }}>
                {t.done}
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.list}>
            <View style={[styles.card, Shadow.card, { backgroundColor: theme.backgroundElement }]}>
              {options.map((option, index) => {
                const selected = option.key === preference;
                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => choose(option.key)}
                    style={({ pressed }) => [pressed && { backgroundColor: theme.backgroundSelected }]}>
                    <View style={styles.row}>
                      <Ionicons name={option.icon} size={20} color={theme.tint} />
                      <ThemedText type="body" style={styles.flex}>
                        {option.label}
                      </ThemedText>
                      {selected ? <Ionicons name="checkmark" size={20} color={theme.tint} /> : null}
                    </View>
                    {index < options.length - 1 ? (
                      <View style={[styles.separator, { backgroundColor: theme.separator }]} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  safeArea: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  list: { padding: Spacing.three },
  card: { borderRadius: Radius.lg, overflow: 'hidden' },
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three + 20 + Spacing.three },
});
