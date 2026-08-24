import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

export default function AppTabs() {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.textTertiary,
        // Deliberately no `height` or `paddingBottom` here. expo-router's
        // BottomTabBar adds the bottom safe-area inset itself, but its
        // getTabBarHeight() returns any explicit `height` verbatim and drops
        // the inset — which put the bar underneath Android's gesture bar and
        // made the buttons untappable.
        tabBarStyle: {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.separator,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500', letterSpacing: 0.06 },
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
    </Tabs>
  );
}
