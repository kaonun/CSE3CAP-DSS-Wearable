import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LanguagePicker } from '@/components/language-picker';
import { ThemedText } from '@/components/themed-text';
import { ListRow } from '@/components/ui/list-row';
import { Section } from '@/components/ui/surface';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { useAuth } from '@/auth';

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { language, languages, t } = useI18n();
  const { user, configured, logOut } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);

  const current = languages.find(item => item.code === language);
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Back sits top-left, matching the platform convention on both
              iOS and Android. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.wearable}
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.5 : 1 }]}>
            <Ionicons name="chevron-back" size={26} color={theme.tint} />
          </Pressable>

          <View style={styles.header}>
            <ThemedText type="largeTitle">{t.settings}</ThemedText>
            <ThemedText type="subhead" themeColor="textSecondary">
              {t.settingsSubtitle}
            </ThemedText>
          </View>

          <Section header={t.language} footer={t.languageDescription}>
            <ListRow
              title={t.language}
              value={current?.nativeName}
              icon="language"
              iconBackground={theme.tint}
              onPress={() => setPickerOpen(true)}
              separator={false}
            />
          </Section>

          <Section header={t.account}>
            <ListRow
              title={configured && user ? (user.email ?? t.account) : t.signInPrompt}
              icon="person-circle"
              iconBackground={theme.textSecondary}
              chevron={false}
              separator={configured && !!user}
            />
            {configured && user ? (
              <ListRow
                title={t.signOut}
                icon="log-out-outline"
                iconBackground={theme.danger}
                destructive
                chevron={false}
                onPress={logOut}
                separator={false}
              />
            ) : null}
          </Section>

          <Section header={t.about}>
            <ListRow title={t.version} value={appVersion} chevron={false} separator={false} />
          </Section>
        </ScrollView>
      </SafeAreaView>

      <LanguagePicker visible={pickerOpen} onClose={() => setPickerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing.two,
    marginTop: Spacing.two,
  },
  header: { gap: Spacing.half },
});
