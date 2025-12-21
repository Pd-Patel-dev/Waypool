import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '@/design-system';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'small' | 'medium' | 'large';
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'medium',
  style,
}) => {
  const cardStyles = [
    styles.card,
    styles[`card_${variant}`],
    styles[`card_padding_${padding}`],
    {
      backgroundColor: theme.colors.surface.primary,
      borderRadius: theme.borderRadius.lg,
      borderColor: variant === 'outlined' ? theme.colors.border : 'transparent',
    },
    variant === 'elevated' && theme.shadows.md,
    style,
  ];

  return <View style={cardStyles}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    // Base styles
  },
  card_default: {
    // Default variant
  },
  card_elevated: {
    // Shadow styles applied via theme
  },
  card_outlined: {
    borderWidth: 1,
  },
  card_padding_none: {
    padding: 0,
  },
  card_padding_small: {
    padding: 12,
  },
  card_padding_medium: {
    padding: 16,
  },
  card_padding_large: {
    padding: 24,
  },
});

