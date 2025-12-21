import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { theme } from '@/design-system';

export interface BadgeProps {
  text: string;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  text,
  variant = 'primary',
  size = 'medium',
  style,
  textStyle,
}) => {
  const getVariantColors = () => {
    switch (variant) {
      case 'success':
        return {
          background: `rgba(52, 199, 89, 0.15)`,
          text: theme.colors.success,
        };
      case 'warning':
        return {
          background: `rgba(255, 214, 10, 0.15)`,
          text: theme.colors.warning,
        };
      case 'error':
        return {
          background: `rgba(255, 59, 48, 0.15)`,
          text: theme.colors.error,
        };
      case 'info':
        return {
          background: `rgba(66, 133, 244, 0.15)`,
          text: theme.colors.info,
        };
      default:
        return {
          background: `rgba(66, 133, 244, 0.15)`,
          text: theme.colors.primary,
        };
    }
  };

  const colors = getVariantColors();

  const badgeStyles = [
    styles.badge,
    styles[`badge_${size}`],
    {
      backgroundColor: colors.background,
      borderRadius: theme.borderRadius.full,
    },
    style,
  ];

  const badgeTextStyles = [
    styles.text,
    styles[`text_${size}`],
    { color: colors.text },
    textStyle,
  ];

  return (
    <View style={badgeStyles}>
      <Text style={badgeTextStyles}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badge_small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badge_medium: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badge_large: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  text_small: {
    fontSize: 10,
  },
  text_medium: {
    fontSize: 12,
  },
  text_large: {
    fontSize: 14,
  },
});

