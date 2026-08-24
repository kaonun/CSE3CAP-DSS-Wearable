import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonVariant = 'filled' | 'tinted' | 'plain' | 'destructive';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  /** Fills the row rather than hugging its label. Defaults to true. */
  block?: boolean;
};

export function Button({
  label,
  variant = 'filled',
  icon,
  loading = false,
  block = true,
  disabled,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isInert = disabled || loading;

  const palette: Record<ButtonVariant, { background: string; foreground: string; border?: string }> = {
    filled: { background: theme.tint, foreground: theme.tintContrast },
    tinted: { background: theme.fill, foreground: theme.tint },
    plain: { background: 'transparent', foreground: theme.tint, border: theme.separator },
    destructive: { background: theme.danger, foreground: '#FFFFFF' },
  };
  const { background, foreground, border } = palette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isInert, busy: loading }}
      disabled={isInert}
      style={({ pressed }) => [
        styles.base,
        block ? styles.block : styles.hug,
        {
          backgroundColor: background,
          borderColor: border ?? 'transparent',
          borderWidth: border ? StyleSheet.hairlineWidth : 0,
          opacity: isInert ? 0.4 : pressed ? 0.82 : 1,
          transform: [{ scale: pressed && !isInert ? 0.98 : 1 }],
        },
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={foreground} size="small" />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={18} color={foreground} /> : null}
          <ThemedText type="headline" style={{ color: foreground }}>
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  block: { alignSelf: 'stretch' },
  hug: { alignSelf: 'flex-start' },
  content: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
