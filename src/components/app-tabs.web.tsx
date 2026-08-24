import { Ionicons } from '@expo/vector-icons';
import {
  TabList,
  TabSlot,
  TabTrigger,
  Tabs,
  type TabListProps,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';
import { MaxContentWidth, Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

/**
 * Web uses a floating top bar rather than the native bottom tab bar — the
 * routes and styling mirror `app-tabs.tsx`.
 */
export default function AppTabs() {
  const { t } = useI18n();

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton icon="watch-outline">{t.wearable}</TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton icon="settings-outline">{t.settings}</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  children,
  isFocused,
  icon,
  ...props
}: TabTriggerSlotProps & { icon?: keyof typeof Ionicons.glyphMap }) {
  const theme = useTheme();
  const color = isFocused ? theme.tint : theme.textSecondary;

  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <View
        style={[
          styles.tabButton,
          { backgroundColor: isFocused ? theme.fill : 'transparent' },
        ]}>
        {icon ? <Ionicons name={icon} size={16} color={color} /> : null}
        <ThemedText type="footnote" style={{ color }}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const theme = useTheme();

  return (
    <View {...props} style={styles.tabListContainer}>
      <View
        style={[
          styles.innerContainer,
          Shadow.card,
          { backgroundColor: theme.backgroundElement, borderColor: theme.separator },
        ]}>
        <View style={styles.brand}>
          <Image
            source={require('@/assets/images/dss-wearable-logo.png')}
            style={styles.brandMark}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="DSS Wearable"
          />
          <ThemedText type="footnote" themeColor="textSecondary">
            DSS Wearable
          </ThemedText>
        </View>
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginRight: 'auto' },
  brandMark: { width: 24, height: 24 },
  pressed: { opacity: 0.7 },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.full,
  },
});
