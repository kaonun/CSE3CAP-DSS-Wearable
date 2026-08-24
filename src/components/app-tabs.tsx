import { Tabs } from 'expo-router';
import { Image, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          height: 64,
          paddingTop: 6,
          paddingBottom: 6,
          backgroundColor: colors.background,
          borderTopColor: colors.backgroundSelected,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Wearable',
          tabBarIcon: ({ color }) => <Image source={require('@/assets/images/tabIcons/home.png')} style={{ width: 22, height: 22, tintColor: color }} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Image source={require('@/assets/images/tabIcons/explore.png')} style={{ width: 22, height: 22, tintColor: color }} />,
        }}
      />
    </Tabs>
  );
}
