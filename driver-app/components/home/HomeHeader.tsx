import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

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
  // Debug logging
  React.useEffect(() => {
    if (currentCity || currentState) {
      console.log('📍 [HomeHeader] Location props:', { currentCity, currentState });
    }
  }, [currentCity, currentState]);
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    marginBottom: 8,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4285F4',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    opacity: 0.9,
  },
  name: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4285F4',
    opacity: 0.9,
  },
});

