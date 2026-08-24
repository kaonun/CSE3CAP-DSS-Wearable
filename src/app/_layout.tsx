import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppNavigator from '@/components/app-navigator';
import { Colors } from '@/constants/theme';
import { I18nProvider, useI18n } from '@/i18n';
import { ActivityTracker, AuthProvider, useAuth } from '@/auth';
// Lives outside app/ on purpose: the auth gate renders it directly, and any
// file under app/ is registered as a route and shows up as its own tab.
import LoginScreen from '@/components/login-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaProvider>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <AuthProvider>
          <I18nProvider>
            <AuthGate />
          </I18nProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AuthGate() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { configured, loading: authLoading, user } = useAuth();
  const { loading: languageLoading } = useI18n();

  // Hold the splash until both the session and the language preference resolve,
  // so the app never flashes English or the login screen at an already-signed-in
  // user.
  if ((configured && authLoading) || languageLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }

  // AnimatedSplashOverlay owns the SplashScreen.hideAsync() call (see its
  // onLayout), so it must render regardless of destination — it sits on top
  // as an absolute overlay and reveals whichever screen is underneath once
  // it finishes. Scoping it to only one branch left the splash stuck forever
  // whenever the other branch was taken.
  return (
    <>
      {configured && !user ? (
        <LoginScreen />
      ) : (
        <ActivityTracker>
          <AppNavigator />
        </ActivityTracker>
      )}
      <AnimatedSplashOverlay />
    </>
  );
}
