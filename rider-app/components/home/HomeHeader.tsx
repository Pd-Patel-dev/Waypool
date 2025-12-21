import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { COLORS, TYPOGRAPHY, SPACING, RESPONSIVE_SPACING } from '@/constants/designSystem';

interface HomeHeaderProps {
  userName: string;
  greeting?: string;
  currentCity?: string | null;
  currentState?: string | null;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  userName,
  greeting,
  currentCity,
  currentState,
}) => {
  const getGreeting = (): string => {
    if (greeting) return greeting;
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const formatLocation = (): string => {
    if (currentCity && currentState) {
      return `${currentCity}, ${currentState}`;
    }
    if (currentCity) {
      return currentCity;
    }
    if (currentState) {
      return currentState;
    }
    return '';
  };

  const locationText = formatLocation();
  const hasLocation = !!locationText;

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>{getGreeting()}</Text>
      <Text style={styles.name}>{userName}</Text>
      {hasLocation && (
        <View style={styles.locationContainer}>
          <IconSymbol size={14} name="location.fill" color="#4285F4" />
          <Text style={styles.locationText} numberOfLines={1}>
            {locationText}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: RESPONSIVE_SPACING.padding,
    paddingTop: SPACING.base,
    paddingBottom: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  greeting: {
    ...TYPOGRAPHY.label,
    fontSize: 13,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
    opacity: 0.95,
  },
  name: {
    ...TYPOGRAPHY.h1,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  locationText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.primary,
    opacity: 0.95,
  },
});

