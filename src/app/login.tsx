import { useState } from 'react';
import { Image, Pressable, SafeAreaView, StyleSheet, TextInput, View } from 'react-native';
import { makeRedirectUri, ResponseType } from 'expo-auth-session';
import { useAuthRequest } from 'expo-auth-session/providers/google';
import { useEffect } from 'react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/auth';

export default function LoginScreen() {
  const { signIn, register, signInWithGoogle, configured } = useAuth();
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [request, response, promptAsync] = useAuthRequest({
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    responseType: ResponseType.IdToken,
    redirectUri: makeRedirectUri({ scheme: 'dsswearable' }),
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.params?.id_token;
    if (!idToken) return;
    setBusy(true);
    signInWithGoogle(idToken).catch(authError => setError(authError instanceof Error ? authError.message : 'Google sign-in failed')).finally(() => setBusy(false));
  }, [response, signInWithGoogle]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (registering) await register(email, password);
      else await signIn(email, password);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Image source={require('@/assets/images/dss-wearable-logo.png')} style={styles.logo} resizeMode="contain" />
          <ThemedText type="subtitle" style={styles.title}>DSS Wearable</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            {registering ? 'Create your account' : 'Sign in to continue'}
          </ThemedText>
          {!configured ? (
            <ThemedView type="backgroundElement" style={styles.notice}>
              <ThemedText type="small">Firebase is not configured yet. Add the EXPO_PUBLIC_FIREBASE values before enabling sign-in.</ThemedText>
            </ThemedView>
          ) : null}
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email" placeholderTextColor="#80838A" style={styles.input} />
          <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" placeholderTextColor="#80838A" style={styles.input} />
          {error ? <ThemedText type="small" style={styles.error}>{error}</ThemedText> : null}
          <Pressable onPress={submit} disabled={busy || !configured} style={[styles.button, (busy || !configured) && styles.disabled]}>
            <ThemedText type="smallBold" style={styles.buttonText}>{busy ? 'Please wait...' : registering ? 'Create account' : 'Sign in'}</ThemedText>
          </Pressable>
          <Pressable onPress={() => promptAsync()} disabled={!request || !configured || busy} style={[styles.googleButton, (!request || !configured || busy) && styles.disabled]}>
            <ThemedText type="smallBold">Continue with Google</ThemedText>
          </Pressable>
          <Pressable onPress={() => setRegistering(value => !value)} style={styles.switchButton}>
            <ThemedText type="smallBold">{registering ? 'Already have an account? Sign in' : 'Need an account? Register'}</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.two },
  logo: { width: 150, height: 150, alignSelf: 'center', marginBottom: Spacing.two },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: Spacing.three },
  notice: { padding: Spacing.three, borderRadius: Spacing.two },
  input: { backgroundColor: '#F0F0F3', color: '#111111', borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, fontSize: 16 },
  error: { color: '#E5484D' },
  button: { backgroundColor: '#3C87F7', padding: Spacing.three, borderRadius: Spacing.two, alignItems: 'center', marginTop: Spacing.two },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF' },
  switchButton: { alignItems: 'center', padding: Spacing.two },
  googleButton: { backgroundColor: '#FFFFFF', padding: Spacing.three, borderRadius: Spacing.two, alignItems: 'center', borderWidth: 1, borderColor: '#A7AAB0' },
});
