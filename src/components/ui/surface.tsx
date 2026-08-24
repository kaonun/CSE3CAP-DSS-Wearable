import { StyleSheet, View, type ViewProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * An iOS "inset grouped" card: a rounded elevated surface that holds
 * related rows or content.
 */
export function Card({ style, ...rest }: ViewProps) {
  const theme = useTheme();
  return (
    <View
      style={[styles.card, Shadow.card, { backgroundColor: theme.backgroundElement }, style]}
      {...rest}
    />
  );
}

/**
 * A grouped section: an uppercase caption header above a card, matching
 * the Settings.app pattern.
 */
export function Section({
  header,
  footer,
  children,
  style,
  ...rest
}: ViewProps & { header?: string; footer?: string }) {
  return (
    <View style={[styles.section, style]} {...rest}>
      {header ? (
        <ThemedText type="footnote" themeColor="textSecondary" style={styles.header}>
          {header.toUpperCase()}
        </ThemedText>
      ) : null}
      <Card>{children}</Card>
      {footer ? (
        <ThemedText type="footnote" themeColor="textSecondary" style={styles.footer}>
          {footer}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, overflow: 'hidden' },
  section: { gap: Spacing.two },
  header: { marginLeft: Spacing.three, letterSpacing: 0.6 },
  footer: { marginHorizontal: Spacing.three },
});
