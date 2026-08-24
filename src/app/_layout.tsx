import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { I18nProvider } from '@/i18n';
import { AuthProvider, useAuth } from '@/auth';
import LoginScreen from './login';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <I18nProvider>
          <AuthGate />
        </I18nProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function AuthGate() {
  const { configured, loading, user } = useAuth();
  if (configured && loading) return null;
  if (configured && !user) return <LoginScreen />;
  return (
    <>
      <AnimatedSplashOverlay />
      <AppTabs />
    </>
  );
}
