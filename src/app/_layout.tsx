import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import AppNavigator from "@/components/app-navigator";
import { Colors } from "@/constants/theme";
import { ReadingSyncProvider } from "@/data/reading-sync-context";
import { DeviceNamesProvider } from "@/device-names";
import { I18nProvider, useI18n } from "@/i18n";
import { MetricPreferenceProvider } from "@/metrics";
import {
  ThemePreferenceProvider,
  useThemePreference,
} from "@/theme-preference";
import {
  ActivityTracker,
  AuthProvider,
  useAuth,
} from "../../services/authServices";
// Lives outside app/ on purpose: the auth gate renders it directly, and any
// file under app/ is registered as a route and shows up as its own tab.
import LoginScreen from "@/components/login-screen";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemePreferenceProvider>
        <AuthProvider>
          <I18nProvider>
            <MetricPreferenceProvider>
              <DeviceNamesProvider>
                <ReadingSyncProvider>
                  <RootTheme />
                </ReadingSyncProvider>
              </DeviceNamesProvider>
            </MetricPreferenceProvider>
          </I18nProvider>
        </AuthProvider>
      </ThemePreferenceProvider>
    </SafeAreaProvider>
  );
}

function RootTheme() {
  const { resolvedScheme } = useThemePreference();
  const isDark = resolvedScheme === "dark";

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AuthGate />
    </ThemeProvider>
  );
}

function AuthGate() {
  const { resolvedScheme, loading: themeLoading } = useThemePreference();
  const theme = Colors[resolvedScheme];
  const { configured, loading: authLoading, user } = useAuth();
  const { loading: languageLoading } = useI18n();

  // Hold the splash until the session, language and theme preference all
  // resolve, so the app never flashes English, the wrong theme, or the login
  // screen at an already-signed-in user.
  if ((configured && authLoading) || languageLoading || themeLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.background,
        }}
      >
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
