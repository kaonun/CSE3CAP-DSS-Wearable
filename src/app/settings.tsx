import { useState } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useI18n, type Language } from '@/i18n';
import { useAuth } from '@/auth';

export default function SettingsScreen() {
  const { language, setLanguage, t } = useI18n();
  const [languageOpen, setLanguageOpen] = useState(false);
  const { user, configured, logOut } = useAuth();

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="subtitle">{t.settings}</ThemedText>
          <ThemedText themeColor="textSecondary">{t.settingsSubtitle}</ThemedText>

          <ThemedView type="backgroundElement" style={styles.section}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
              {t.language.toUpperCase()}
            </ThemedText>
            <ThemedText type="smallBold">{t.languageDescription}</ThemedText>
            <Pressable onPress={() => setLanguageOpen(true)} style={styles.dropdown}>
              <ThemedText type="smallBold">{t.languageNames[language]}</ThemedText>
              <ThemedText type="small">{languageOpen ? '▲' : '▼'}</ThemedText>
            </Pressable>
            <Modal visible={languageOpen} transparent animationType="fade" onRequestClose={() => setLanguageOpen(false)}>
              <Pressable style={styles.modalBackdrop} onPress={() => setLanguageOpen(false)}>
                <ThemedView type="backgroundElement" style={styles.menu}>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {(Object.keys(t.languageNames) as Language[]).map(option => (
                      <Pressable
                        key={option}
                        onPress={() => { setLanguage(option); setLanguageOpen(false); }}
                        style={[styles.menuOption, language === option && styles.optionSelected]}>
                        <ThemedText type="smallBold">{t.languageNames[option]}</ThemedText>
                      </Pressable>
                    ))}
                  </ScrollView>
                </ThemedView>
              </Pressable>
            </Modal>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.section}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
              {t.account.toUpperCase()}
            </ThemedText>
            <ThemedText type="small">{configured && user ? user.email : t.signInPrompt}</ThemedText>
            {configured && user ? (
              <Pressable onPress={logOut} style={styles.logout}>
                <ThemedText type="smallBold" style={styles.logoutText}>Sign out</ThemedText>
              </Pressable>
            ) : null}
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  content: { padding: Spacing.three, paddingBottom: BottomTabInset + Spacing.three, gap: Spacing.two },
  section: { marginTop: Spacing.two, padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  label: { letterSpacing: 1 },
  dropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.three, marginTop: Spacing.two, borderWidth: 1, borderColor: '#A7AAB0', borderRadius: Spacing.two },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: Spacing.four, backgroundColor: 'rgba(0,0,0,0.45)' },
  menu: { maxHeight: 360, padding: Spacing.one, borderRadius: Spacing.two },
  menuOption: { paddingVertical: 10, paddingHorizontal: Spacing.three, borderRadius: Spacing.two },
  optionSelected: { backgroundColor: '#B9F900' },
  logout: { alignItems: 'center', paddingVertical: Spacing.two, backgroundColor: '#E5484D', borderRadius: Spacing.two },
  logoutText: { color: '#FFFFFF' },
});
