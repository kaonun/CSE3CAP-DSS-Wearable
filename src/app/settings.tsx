import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LanguagePicker } from "@/components/language-picker";
import { ThemePicker } from "@/components/theme-picker";
import { ThemedText } from "@/components/themed-text";
import { ListRow } from "@/components/ui/list-row";
import { Section } from "@/components/ui/surface";
import { MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { exportSummariesToCsv } from "@/data/export";
import { useReadingSyncContext } from "@/data/reading-sync-context";
import { deleteAllSummaries } from "@/data/summaries";
import { useTheme } from "@/hooks/use-theme";
import { useI18n } from "@/i18n";
import { useThemePreference } from "@/theme-preference";
import { useAuth } from "../../services/authServices";

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { language, languages, t } = useI18n();
  const { preference: themePreference } = useThemePreference();
  const { user, configured, logOut } = useAuth();
  const sync = useReadingSyncContext();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const current = languages.find((item) => item.code === language);
  const themeValue =
    themePreference === "light"
      ? t.themeLight
      : themePreference === "dark"
        ? t.themeDark
        : t.themeSystem;
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  const runExport = async () => {
    setBusy("export");
    setNotice(null);
    try {
      // Otherwise a device connected moments ago has nothing to export yet —
      // its data is still sitting in the in-memory buffer, not Firestore.
      await sync.flush(true);
      const result = await exportSummariesToCsv();
      setNotice(
        result.status === "empty"
          ? t.exportEmpty
          : t.exportDone.replace("{count}", String(result.rows)),
      );
    } catch (exportError) {
      setNotice(
        exportError instanceof Error ? exportError.message : t.errGeneric,
      );
    } finally {
      setBusy(null);
    }
  };

  // Erasing stored readings is irreversible, so it goes through a confirmation.
  const confirmDelete = () => {
    Alert.alert(t.deleteData, t.deleteDataConfirm, [
      { text: t.cancel, style: "cancel" },
      {
        text: t.delete,
        style: "destructive",
        onPress: async () => {
          setBusy("delete");
          setNotice(null);
          try {
            const removed = await deleteAllSummaries();
            setNotice(t.deleteDataDone.replace("{count}", String(removed)));
          } catch (deleteError) {
            setNotice(
              deleteError instanceof Error ? deleteError.message : t.errGeneric,
            );
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Back sits top-left, matching the platform convention on both
              iOS and Android. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.wearable}
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              { opacity: pressed ? 0.5 : 1 },
            ]}
          >
            <Ionicons name="chevron-back" size={26} color={theme.tint} />
          </Pressable>

          <View style={styles.header}>
            <ThemedText type="largeTitle">{t.settings}</ThemedText>
            <ThemedText type="subhead" themeColor="textSecondary">
              {t.settingsSubtitle}
            </ThemedText>
          </View>

          <Section header={t.accessibility}>
            <ListRow
              title={t.language}
              subtitle={t.languageDescription}
              value={current?.nativeName}
              icon="language"
              iconBackground={theme.tint}
              onPress={() => setPickerOpen(true)}
            />
            <ListRow
              title={t.theme}
              subtitle={t.themeDescription}
              value={themeValue}
              icon="contrast"
              iconBackground={theme.tint}
              onPress={() => setThemePickerOpen(true)}
              separator={false}
            />
          </Section>

          <Section header={t.account}>
            <ListRow
              title={
                configured && user ? (user.email ?? t.account) : t.signInPrompt
              }
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

          {configured && user ? (
            <Section header={t.data} footer={t.exportDataHelp}>
              <ListRow
                title={busy === "export" ? t.exporting : t.exportData}
                icon="download-outline"
                iconBackground={theme.tint}
                chevron={false}
                onPress={busy ? undefined : runExport}
              />
              <ListRow
                title={t.deleteData}
                icon="trash-outline"
                iconBackground={theme.danger}
                destructive
                chevron={false}
                onPress={busy ? undefined : confirmDelete}
                separator={false}
              />
            </Section>
          ) : null}

          {notice ? (
            <View style={[styles.notice, { backgroundColor: theme.fill }]}>
              <ThemedText type="footnote" themeColor="textSecondary">
                {notice}
              </ThemedText>
            </View>
          ) : null}

          <Section header={t.about}>
            <ListRow
              title={t.version}
              value={appVersion}
              chevron={false}
              separator={false}
            />
          </Section>
        </ScrollView>
      </SafeAreaView>

      <LanguagePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
      />
      <ThemePicker
        visible={themePickerOpen}
        onClose={() => setThemePickerOpen(false)}
      />
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
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -Spacing.two,
    marginTop: Spacing.two,
  },
  header: { gap: Spacing.half },
  notice: { padding: Spacing.three, borderRadius: Radius.md },
});
