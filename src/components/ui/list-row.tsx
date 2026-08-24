import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  /** Trailing detail text, e.g. the current value of a setting. */
  value?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Tint behind the leading icon — Settings.app style. */
  iconBackground?: string;
  onPress?: () => void;
  /** Shows a trailing chevron. Defaults to true when `onPress` is set. */
  chevron?: boolean;
  selected?: boolean;
  destructive?: boolean;
  /** Hidden on the last row of a card. */
  separator?: boolean;
};

export function ListRow({
  title,
  subtitle,
  value,
  icon,
  iconBackground,
  onPress,
  chevron,
  selected = false,
  destructive = false,
  separator = true,
}: ListRowProps) {
  const theme = useTheme();
  const showChevron = chevron ?? !!onPress;
  const titleColor = destructive ? theme.danger : theme.text;

  const body = (
    <View style={styles.row}>
      {icon ? (
        <View style={[styles.iconWell, { backgroundColor: iconBackground ?? theme.tint }]}>
          <Ionicons name={icon} size={17} color="#FFFFFF" />
        </View>
      ) : null}

      <View style={styles.labels}>
        <ThemedText type="body" style={{ color: titleColor }} numberOfLines={1}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="footnote" themeColor="textSecondary" numberOfLines={2}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>

      {value ? (
        <ThemedText type="body" themeColor="textSecondary" numberOfLines={1} style={styles.value}>
          {value}
        </ThemedText>
      ) : null}
      {selected ? <Ionicons name="checkmark" size={20} color={theme.tint} /> : null}
      {showChevron ? <Ionicons name="chevron-forward" size={17} color={theme.textTertiary} /> : null}
    </View>
  );

  return (
    <View>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [pressed && { backgroundColor: theme.backgroundSelected }]}>
          {body}
        </Pressable>
      ) : (
        body
      )}
      {separator ? (
        <View
          style={[
            styles.separator,
            { backgroundColor: theme.separator, marginLeft: icon ? 58 : Spacing.three },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  iconWell: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labels: { flex: 1, gap: 1 },
  value: { flexShrink: 1, maxWidth: '45%', textAlign: 'right' },
  separator: { height: StyleSheet.hairlineWidth },
});
