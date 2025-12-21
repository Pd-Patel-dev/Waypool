/**
 * Border Radius Design Tokens
 */

export const borderRadiusTokens = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
} as const;

export type BorderRadiusToken = typeof borderRadiusTokens;

