/**
 * DSS Wearable design tokens.
 *
 * Follows Apple's Human Interface Guidelines: a grouped-background surface
 * model, the iOS type scale, hairline separators, and a single restrained
 * accent. Brand colours are sampled from the DSS Wearable logo.
 */

import '@/global.css';

import { Platform } from 'react-native';

/** Sampled from the DSS Wearable logo. */
export const Brand = {
  /** Logo lime — used for live/active states, never for text on white. */
  lime: '#8BDF13',
  /** Darkened lime that clears 4.5:1 on white for text/icons. */
  limeInk: '#4F8A07',
  /** Logo pale cyan — the inner dish field. */
  cyan: '#BDEBF7',
  /** Logo watch band slate-teal. */
  teal: '#5C8F9C',
  /** Primary interactive teal, accessible on white. */
  tealInk: '#0F7A93',
  /** Brighter teal for dark mode surfaces. */
  tealVivid: '#4FD2F0',
} as const;

export const Colors = {
  light: {
    text: '#000000',
    textSecondary: '#6E6E73',
    textTertiary: '#8E8E93',
    background: '#F2F2F7',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E5E5EA',
    separator: '#D1D1D6',
    fill: 'rgba(120,120,128,0.12)',
    tint: Brand.tealInk,
    tintContrast: '#FFFFFF',
    success: '#248A3D',
    live: Brand.limeInk,
    warning: '#B25000',
    danger: '#D70015',
  },
  dark: {
    text: '#FFFFFF',
    textSecondary: '#98989F',
    textTertiary: '#8E8E93',
    background: '#000000',
    backgroundElement: '#1C1C1E',
    backgroundSelected: '#2C2C2E',
    separator: '#38383A',
    fill: 'rgba(120,120,128,0.24)',
    tint: Brand.tealVivid,
    tintContrast: '#00222B',
    success: '#30D158',
    live: Brand.lime,
    warning: '#FF9F0A',
    danger: '#FF453A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/** 4pt grid. Legacy word keys kept so existing screens keep compiling. */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** iOS-style corner radii. */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 999,
} as const;

/** Soft elevation — Apple uses shadow sparingly, mostly on floating surfaces. */
export const Shadow = {
  card: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 2 },
    default: {},
  }),
  floating: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.14,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
    },
    android: { elevation: 8 },
    default: {},
  }),
} as const;

export const HairlineWidth = Platform.select({ ios: 0.33, default: 0.5 });

export const BottomTabInset = Platform.select({ ios: 8, android: 8 }) ?? 0;
export const MaxContentWidth = 800;
