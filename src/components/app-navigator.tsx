import { Stack } from 'expo-router';

/**
 * Settings is a utility screen reached from the main view, not a peer
 * destination, so it is pushed onto a stack rather than sitting in a tab bar.
 * Each screen draws its own large-title header, so the navigation header is
 * disabled throughout.
 */
export default function AppNavigator() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
