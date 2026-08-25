import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';

/**
 * A small centred dialog rather than a full page sheet — renaming is a single
 * field and a fast, occasional action, not something worth a whole screen.
 */
export function RenameDeviceModal({
  visible,
  currentName,
  onSave,
  onClose,
}: {
  visible: boolean;
  currentName: string | null;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const [value, setValue] = useState('');

  // Re-seed the field with the live name each time the dialog opens.
  useEffect(() => {
    if (visible) setValue(currentName ?? '');
  }, [visible, currentName]);

  const save = () => {
    const trimmed = value.trim();
    if (trimmed) onSave(trimmed);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, Shadow.floating, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="headline">{t.renameDevice}</ThemedText>
          <TextField
            value={value}
            onChangeText={setValue}
            placeholder={t.unnamedDevice}
            autoCapitalize="words"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={save}
          />
          <View style={styles.actions}>
            <Button label={t.cancel} variant="plain" block={false} onPress={onClose} />
            <Button label={t.done} block={false} onPress={save} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
});
