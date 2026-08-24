import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextFieldProps = TextInputProps & {
  icon?: keyof typeof Ionicons.glyphMap;
  /** Renders a show/hide toggle and manages `secureTextEntry` internally. */
  revealable?: boolean;
};

export function TextField({ icon, revealable = false, style, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: theme.fill,
          borderColor: focused ? theme.tint : 'transparent',
        },
      ]}>
      {icon ? <Ionicons name={icon} size={18} color={theme.textTertiary} /> : null}
      <TextInput
        placeholderTextColor={theme.textTertiary}
        selectionColor={theme.tint}
        onFocus={event => {
          setFocused(true);
          rest.onFocus?.(event);
        }}
        onBlur={event => {
          setFocused(false);
          rest.onBlur?.(event);
        }}
        {...rest}
        secureTextEntry={revealable ? !revealed : rest.secureTextEntry}
        style={[styles.input, { color: theme.text }, style]}
      />
      {revealable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          hitSlop={8}
          onPress={() => setRevealed(current => !current)}>
          <Ionicons
            name={revealed ? 'eye-off-outline' : 'eye-outline'}
            size={18}
            color={theme.textTertiary}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    minHeight: 50,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  input: { flex: 1, fontSize: 17, letterSpacing: -0.43, paddingVertical: Spacing.two + 4 },
});
