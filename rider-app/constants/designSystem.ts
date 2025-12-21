/**
 * Modern Design System for Waypool Rider App
 * Ensures consistent spacing, typography, colors, and responsive design
 */

import { Dimensions, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Breakpoints for responsive design
export const BREAKPOINTS = {
  small: 360,
  medium: 414,
  large: 768,
};

// Spacing system (based on 8px grid)
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

// Responsive spacing (computed at module load)
export const RESPONSIVE_SPACING = {
  padding: SCREEN_WIDTH < BREAKPOINTS.medium ? 16 : 20,
  margin: SCREEN_WIDTH < BREAKPOINTS.medium ? 16 : 20,
  cardPadding: SCREEN_WIDTH < BREAKPOINTS.medium ? 16 : 20,
  sectionGap: SCREEN_WIDTH < BREAKPOINTS.medium ? 20 : 24,
};

// Typography system
export const TYPOGRAPHY = {
  // Headings
  h1: {
    fontSize: SCREEN_WIDTH < BREAKPOINTS.medium ? 28 : 32,
    fontWeight: '800' as const,
    lineHeight: SCREEN_WIDTH < BREAKPOINTS.medium ? 34 : 38,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: SCREEN_WIDTH < BREAKPOINTS.medium ? 22 : 24,
    fontWeight: '700' as const,
    lineHeight: SCREEN_WIDTH < BREAKPOINTS.medium ? 28 : 30,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: SCREEN_WIDTH < BREAKPOINTS.medium ? 18 : 20,
    fontWeight: '700' as const,
    lineHeight: SCREEN_WIDTH < BREAKPOINTS.medium ? 24 : 26,
    letterSpacing: -0.2,
  },
  // Body text
  bodyLarge: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 22,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 21,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  // Labels and captions
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 18,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  captionSmall: {
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 14,
  },
  // Badge text
  badge: {
    fontSize: 10,
    fontWeight: '700' as const,
    lineHeight: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
};

// Color system
export const COLORS = {
  // Primary colors
  primary: '#4285F4',
  primaryDark: '#3367D6',
  primaryLight: '#5B9BF5',
  primaryTint: 'rgba(66, 133, 244, 0.15)',
  primaryTintLight: 'rgba(66, 133, 244, 0.1)',
  
  // Status colors
  success: '#34C759',
  successTint: 'rgba(52, 199, 89, 0.15)',
  warning: '#FFD60A',
  warningTint: 'rgba(255, 214, 10, 0.15)',
  error: '#FF3B30',
  errorTint: 'rgba(255, 59, 48, 0.15)',
  info: '#4285F4',
  infoTint: 'rgba(66, 133, 244, 0.15)',
  
  // Background colors
  background: '#000000',
  surface: '#1C1C1E',
  surfaceElevated: '#2A2A2C',
  surfaceHover: '#3A3A3C',
  
  // Border colors
  border: '#2A2A2C',
  borderLight: '#1A1A1A',
  borderDark: '#3A3A3C',
  
  // Text colors
  textPrimary: '#FFFFFF',
  textSecondary: '#999999',
  textTertiary: '#666666',
  textDisabled: '#4A4A4A',
  
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayDark: 'rgba(0, 0, 0, 0.8)',
};

// Border radius system
export const BORDER_RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  round: 9999,
};

// Shadow system
export const SHADOWS = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
};

// Button styles
export const BUTTONS = {
  primary: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.base,
    paddingHorizontal: SPACING.lg,
    minHeight: 48,
    ...SHADOWS.sm,
  },
  secondary: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.base,
    paddingHorizontal: SPACING.lg,
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  outline: {
    backgroundColor: 'transparent',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.base,
    paddingHorizontal: SPACING.lg,
    minHeight: 48,
    borderWidth: 1.5,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderRadius: BORDER_RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.base,
    minHeight: 36,
  },
};

// Card styles
export const CARDS = {
  default: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.base,
    ...SHADOWS.sm,
  },
  elevated: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.base,
    ...SHADOWS.md,
  },
  flat: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.base,
  },
};

// Input styles
export const INPUTS = {
  default: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.base,
    fontSize: TYPOGRAPHY.body.fontSize,
    color: COLORS.textPrimary,
    minHeight: 48,
  },
  focused: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
  },
  error: {
    borderColor: COLORS.error,
  },
  disabled: {
    backgroundColor: COLORS.surfaceElevated,
    opacity: 0.5,
  },
};

// Safe area padding helper
export const getSafeAreaPadding = (insets: { top: number; bottom: number; left: number; right: number }) => ({
  paddingTop: Math.max(insets.top, SPACING.base),
  paddingBottom: Math.max(insets.bottom, SPACING.sm),
  paddingLeft: Math.max(insets.left, 0),
  paddingRight: Math.max(insets.right, 0),
});

// Responsive helpers
export const isSmallScreen = SCREEN_WIDTH < BREAKPOINTS.medium;
export const isLargeScreen = SCREEN_WIDTH >= BREAKPOINTS.large;

// Platform-specific adjustments
export const PLATFORM = {
  ios: Platform.OS === 'ios',
  android: Platform.OS === 'android',
  web: Platform.OS === 'web',
};

// Common style patterns
export const COMMON_STYLES = {
  // Flex utilities
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  rowSpaceBetween: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  center: {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  
  // Spacing utilities
  gap4: { gap: SPACING.xs },
  gap8: { gap: SPACING.sm },
  gap12: { gap: SPACING.md },
  gap16: { gap: SPACING.base },
  gap20: { gap: SPACING.lg },
  gap24: { gap: SPACING.xl },
  
  // Padding utilities
  p4: { padding: SPACING.xs },
  p8: { padding: SPACING.sm },
  p12: { padding: SPACING.md },
  p16: { padding: SPACING.base },
  p20: { padding: SPACING.lg },
  
  // Margin utilities
  m4: { margin: SPACING.xs },
  m8: { margin: SPACING.sm },
  m12: { margin: SPACING.md },
  m16: { margin: SPACING.base },
  m20: { margin: SPACING.lg },
  
  // Border utilities
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
};

