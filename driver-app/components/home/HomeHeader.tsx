import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';

interface HomeHeaderProps {
  userName: string;
  currentCity?: string | null;
  currentState?: string | null;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  userName,
  currentCity,
  currentState,
}) => {
  const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>{getGreeting()}</Text>
      <Text style={styles.name}>{userName}</Text>
      {(currentCity || currentState) && (
        <View style={styles.locationContainer}>
          <IconSymbol size={14} name="location.fill" color="#4285F4" />
          <Text style={styles.locationText}>
            {currentCity && currentState
              ? `${currentCity}, ${currentState}`
              : currentCity || currentState || ''}
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

