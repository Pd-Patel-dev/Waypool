import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useUser } from '@/context/UserContext';

export default function HomeScreen(): React.JSX.Element {
  const { user, isLoading } = useUser();

  useEffect(() => {
    // If no user is logged in, redirect to welcome screen
    if (!isLoading && !user) {
      router.replace('/welcome');
    }
  }, [user, isLoading]);

  if (isLoading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.userName}>
              {user.firstName || user.email}
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Where would you like to go?</Text>
          
          <TouchableOpacity
            style={styles.bookRideButton}
            activeOpacity={0.8}
            onPress={() => {
              // TODO: Navigate to ride booking screen
              console.log('Book a ride');
            }}
          >
            <View style={styles.bookRideContent}>
              <Text style={styles.bookRideIcon}>🚗</Text>
              <View style={styles.bookRideTextContainer}>
                <Text style={styles.bookRideTitle}>Book a ride</Text>
                <Text style={styles.bookRideSubtitle}>
                  Get a ride to your destination
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Recent Rides */}
        <View style={styles.recentRidesContainer}>
          <Text style={styles.sectionTitle}>Recent rides</Text>
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyStateIcon}>📍</Text>
            <Text style={styles.emptyStateText}>No recent rides</Text>
            <Text style={styles.emptyStateSubtext}>
              Your ride history will appear here
            </Text>
          </View>
        </View>

        {/* Saved Places */}
        <View style={styles.savedPlacesContainer}>
          <Text style={styles.sectionTitle}>Saved places</Text>
          <TouchableOpacity
            style={styles.savedPlaceCard}
            activeOpacity={0.7}
            onPress={() => console.log('Add home')}
          >
            <View style={styles.savedPlaceIcon}>
              <Text style={styles.savedPlaceEmoji}>🏠</Text>
            </View>
            <Text style={styles.savedPlaceText}>Add home</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.savedPlaceCard}
            activeOpacity={0.7}
            onPress={() => console.log('Add work')}
          >
            <View style={styles.savedPlaceIcon}>
              <Text style={styles.savedPlaceEmoji}>💼</Text>
            </View>
            <Text style={styles.savedPlaceText}>Add work</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    fontSize: 16,
    color: '#CCCCCC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    backgroundColor: '#000000',
  },
  greeting: {
    fontSize: 16,
    fontWeight: '400',
    color: '#CCCCCC',
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickActionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  bookRideButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  bookRideContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookRideIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  bookRideTextContainer: {
    flex: 1,
  },
  bookRideTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  bookRideSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
  },
  recentRidesContainer: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  emptyStateContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptyStateSubtext: {
    fontSize: 14,
    fontWeight: '400',
    color: '#CCCCCC',
    textAlign: 'center',
  },
  savedPlacesContainer: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  savedPlaceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  savedPlaceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3A3A3C',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  savedPlaceEmoji: {
    fontSize: 24,
  },
  savedPlaceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
