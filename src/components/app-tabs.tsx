import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

const BAR_CONTENT_HEIGHT = 56;

export default function AppTabs() {
  const theme = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  // Android gesture navigation (and the iOS home indicator) overlay the bottom
  // of the window. Without reserving the inset, the tab bar sits underneath the
  // system bar and its buttons cannot be tapped.
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.separator,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: BAR_CONTENT_HEIGHT + bottomInset,
          paddingTop: 6,
          paddingBottom: bottomInset,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500', letterSpacing: 0.06 },
        tabBarItemStyle: { paddingTop: 2 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t.wearable,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'watch' : 'watch-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.settings,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={24} color={color} />
          ),
        }}
      />
      {/* login.tsx lives in app/ so expo-router registers it as a route and would
          otherwise render it as a third tab. It is presented by the auth gate,
          never navigated to directly. */}
      <Tabs.Screen name="login" options={{ href: null }} />
    </Tabs>
  );
}
