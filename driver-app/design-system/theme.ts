/**
 * Dark Theme - Single theme for the app
 * All design tokens and colors
 */

import { colorTokens, spacingTokens, typographyTokens, shadowTokens, borderRadiusTokens } from './tokens';

export const theme = {
  colors: {
    // Brand
    primary: colorTokens.primary[400],
    primaryLight: colorTokens.primary[300],
    primaryDark: colorTokens.primary[500],

    // Semantic
    success: colorTokens.success[400],
    warning: colorTokens.warning[400],
    error: colorTokens.error[400],
    info: colorTokens.primary[400],

    // Surface
    background: colorTokens.dark.background,
    surface: {
      primary: colorTokens.dark.surface.primary,
      secondary: colorTokens.dark.surface.secondary,
      tertiary: colorTokens.dark.surface.tertiary,
    },

    // Text
    text: {
      primary: colorTokens.dark.text.primary,
      secondary: colorTokens.dark.text.secondary,
      tertiary: colorTokens.dark.text.tertiary,
    },

    // Interactive
    button: {
      primary: {
        background: colorTokens.primary[500],
        text: '#FFFFFF',
      },
      secondary: {
        background: colorTokens.dark.surface.secondary,
        text: colorTokens.dark.text.primary,
      },
      outline: {
        background: 'transparent',
        text: colorTokens.primary[400],
        border: colorTokens.primary[400],
      },
      ghost: {
        background: 'transparent',
        text: colorTokens.primary[400],
      },
      danger: {
        background: colorTokens.error[500],
        text: '#FFFFFF',
      },
    },

    // Border
    border: colorTokens.dark.border,

    // Divider
    divider: colorTokens.gray[800],
  },

  spacing: spacingTokens,
  typography: typographyTokens,
  shadows: shadowTokens,
  borderRadius: borderRadiusTokens,
} as const;

export type Theme = typeof theme;

