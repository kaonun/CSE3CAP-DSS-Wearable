import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Apple type scale. The `default`/`small`/`smallBold`/`subtitle`/`title`
 * names predate the redesign and are kept as aliases so older screens
 * keep rendering sensibly.
 */
export type TextVariant =
  | 'largeTitle'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'headline'
  | 'body'
  | 'callout'
  | 'subhead'
  | 'footnote'
  | 'caption'
  | 'metric'
  // legacy aliases
  | 'default'
  | 'title'
  | 'small'
  | 'smallBold'
  | 'subtitle'
  | 'link'
  | 'linkPrimary'
  | 'code';

export type ThemedTextProps = TextProps & {
  type?: TextVariant;
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'body', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const tinted = type === 'linkPrimary' ? theme.tint : theme[themeColor ?? 'text'];

  return <Text style={[{ color: tinted }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.37 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.36 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.26 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: -0.45 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.43 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.43 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.31 },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.23 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.08 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0 },
  /** Tabular figures so live readings don't jitter as digits change. */
  metric: {
    fontSize: 56,
    lineHeight: 62,
    fontWeight: '700',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },

  // Legacy aliases mapped onto the scale above.
  default: { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.43 },
  title: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.37 },
  small: { fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.23 },
  smallBold: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.23 },
  subtitle: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.36 },
  link: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
  linkPrimary: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700', default: '500' }),
    fontSize: 13,
  },
});
