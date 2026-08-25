import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { AuthError, googleSignInConfigured, useAuth } from '@/auth';

type Mode = 'signIn' | 'register' | 'reset';

export default function LoginScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const { signIn, register, resetPassword, signInWithGoogle, configured } = useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const describe = (caught: unknown) =>
    caught instanceof AuthError ? t[caught.key] : t.errGeneric;

  /**
   * The native account picker handles the whole flow, so there is no redirect
   * to wait on — unlike the browser-based flow this replaced, which Google
   * refuses for native apps.
   */
  const continueWithGoogle = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      // Resolves false when the picker is dismissed, which is a choice rather
      // than a failure and so raises nothing.
      await signInWithGoogle();
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'register') await register(email, password);
      else if (mode === 'reset') {
        await resetPassword(email);
        setNotice(t.resetEmailSent);
      } else await signIn(email, password);
    } catch (caught) {
      setError(describe(caught));
    } finally {
      setBusy(false);
    }
  };

  const heading = mode === 'register' ? t.createAccount : mode === 'reset' ? t.resetPassword : t.signIn;
  const subheading =
    mode === 'register' ? t.createAccountSubtitle : mode === 'reset' ? t.resetSubtitle : t.signInSubtitle;
  const primaryLabel =
    mode === 'register' ? t.createAccount : mode === 'reset' ? t.sendResetLink : t.signIn;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.brand}>
              <Image
                source={require('@/assets/images/dss-wearable-logo.png')}
                style={styles.logo}
                resizeMode="contain"
                accessibilityRole="image"
                accessibilityLabel="DSS Wearable"
              />
            </View>

            <View style={styles.headings}>
              <ThemedText type="title1" style={styles.center}>
                {heading}
              </ThemedText>
              <ThemedText type="subhead" themeColor="textSecondary" style={styles.center}>
                {subheading}
              </ThemedText>
            </View>

            {!configured ? (
              <View style={[styles.banner, { backgroundColor: theme.fill }]}>
                <Ionicons name="information-circle" size={18} color={theme.textSecondary} />
                <ThemedText type="footnote" themeColor="textSecondary" style={styles.flex}>
                  {t.notConfigured}
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.form}>
              <TextField
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                placeholder={t.email}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
              />

              {mode !== 'reset' ? (
                <TextField
                  icon="lock-closed-outline"
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t.password}
                  revealable
                  autoCapitalize="none"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  textContentType={mode === 'register' ? 'newPassword' : 'password'}
                  returnKeyType="go"
                  onSubmitEditing={submit}
                />
              ) : null}

              {error ? (
                <View style={styles.message}>
                  <Ionicons name="alert-circle" size={16} color={theme.danger} />
                  <ThemedText type="footnote" style={{ color: theme.danger }}>
                    {error}
                  </ThemedText>
                </View>
              ) : null}

              {notice ? (
                <View style={styles.message}>
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                  <ThemedText type="footnote" style={{ color: theme.success }}>
                    {notice}
                  </ThemedText>
                </View>
              ) : null}

              <Button
                label={busy ? t.pleaseWait : primaryLabel}
                onPress={submit}
                loading={busy}
                disabled={!configured}
              />

              {mode === 'signIn' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => switchMode('reset')}
                  style={styles.inlineLink}>
                  <ThemedText type="footnote" style={{ color: theme.tint }}>
                    {t.forgotPassword}
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>

            {mode !== 'reset' ? (
              <>
                <View style={styles.divider}>
                  <View style={[styles.rule, { backgroundColor: theme.separator }]} />
                  <ThemedText type="footnote" themeColor="textTertiary">
                    {t.or}
                  </ThemedText>
                  <View style={[styles.rule, { backgroundColor: theme.separator }]} />
                </View>

                <Button
                  label={t.continueWithGoogle}
                  variant="plain"
                  icon="logo-google"
                  onPress={continueWithGoogle}
                  disabled={!googleSignInConfigured || !configured || busy}
                />
              </>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => switchMode(mode === 'signIn' ? 'register' : 'signIn')}
              style={styles.footerLink}>
              <ThemedText type="footnote" style={{ color: theme.tint }}>
                {mode === 'signIn' ? t.needAccount : mode === 'register' ? t.haveAccount : t.backToSignIn}
              </ThemedText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  brand: { alignItems: 'center' },
  logo: { width: 168, height: 168 },
  headings: { gap: Spacing.one },
  center: { textAlign: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
  },
  form: { gap: Spacing.two + 4 },
  message: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2 },
  inlineLink: { alignSelf: 'center', paddingVertical: Spacing.one },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  footerLink: { alignSelf: 'center', paddingVertical: Spacing.two },
});
