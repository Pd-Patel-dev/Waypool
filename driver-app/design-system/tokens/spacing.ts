/**
 * Spacing Design Tokens
 * Defines consistent spacing scale (4px base unit)
 */

export const spacingTokens = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
  '6xl': 80,
} as const;

export type SpacingToken = typeof spacingTokens;

