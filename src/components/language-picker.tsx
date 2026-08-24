import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { TextField } from '@/components/ui/text-field';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n, type Language } from '@/i18n';

/**
 * Full-height language sheet. A plain dropdown gets unusable past a handful of
 * options, so this follows the iOS "searchable grouped list" pattern instead:
 * native names first, English names underneath so a user who has picked an
 * unfamiliar script can still find their way back.
 */
export function LanguagePicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const { language, setLanguage, languages, t } = useI18n();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return languages;
    return languages.filter(
      item =>
        item.nativeName.toLowerCase().includes(needle) ||
        item.englishName.toLowerCase().includes(needle) ||
        item.code.includes(needle),
    );
  }, [languages, query]);

  const dismiss = () => {
    setQuery('');
    onClose();
  };

  const choose = (code: Language) => {
    setLanguage(code);
    dismiss();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={dismiss}>
      <View style={[styles.sheet, { backgroundColor: theme.background }]}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={[styles.toolbar, { borderBottomColor: theme.separator }]}>
            <ThemedText type="headline">{t.language}</ThemedText>
            <Pressable accessibilityRole="button" hitSlop={12} onPress={dismiss}>
              <ThemedText type="body" style={{ color: theme.tint }}>
                {t.done}
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <TextField
              icon="search"
              value={query}
              onChangeText={setQuery}
              placeholder={t.search}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={[styles.card, Shadow.card, { backgroundColor: theme.backgroundElement }]}>
              {results.map((item, index) => {
                const selected = item.code === language;
                return (
                  <Pressable
                    key={item.code}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => choose(item.code)}
                    style={({ pressed }) => [pressed && { backgroundColor: theme.backgroundSelected }]}>
                    <View style={styles.row}>
                      <View style={styles.rowLabels}>
                        <ThemedText type="body">{item.nativeName}</ThemedText>
                        {item.englishName !== item.nativeName ? (
                          <ThemedText type="footnote" themeColor="textSecondary">
                            {item.englishName}
                          </ThemedText>
                        ) : null}
                      </View>
                      {selected ? <Ionicons name="checkmark" size={20} color={theme.tint} /> : null}
                    </View>
                    {index < results.length - 1 ? (
                      <View style={[styles.separator, { backgroundColor: theme.separator }]} />
                    ) : null}
                  </Pressable>
                );
              })}

              {results.length === 0 ? (
                <View style={styles.empty}>
                  <ThemedText type="subhead" themeColor="textSecondary">
                    {t.search}: {query}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  safeArea: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchWrap: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2 },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.five },
  card: { borderRadius: Radius.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowLabels: { flex: 1, gap: 1 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three },
  empty: { padding: Spacing.four, alignItems: 'center' },
});
