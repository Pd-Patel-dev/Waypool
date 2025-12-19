/**
 * Onboarding Completion Screen
 * Shown when driver returns from embedded onboarding
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useUser } from '@/context/UserContext';
import { getConnectStatus } from '@/services/api';
import { getUserFriendlyErrorMessage } from '@/utils/errorHandler';

export default function OnboardingCompleteScreen(): React.JSX.Element {
  const { user } = useUser();
  const params = useLocalSearchParams();
  const driverId = params.driverId ? parseInt(params.driverId as string) : user?.id;
  
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{
    payoutsEnabled: boolean;
    chargesEnabled: boolean;
    currentlyDue: string[];
  } | null>(null);

  useEffect(() => {
    checkStatus();
  }, [driverId]);

  const checkStatus = async () => {
    if (!driverId) {
      Alert.alert('Error', 'Driver ID not found');
      setLoading(false);
      return;
    }

    try {
      const result = await getConnectStatus(driverId);
      setStatus({
        payoutsEnabled: result.payoutsEnabled,
        chargesEnabled: result.chargesEnabled,
        currentlyDue: result.currentlyDue || [],
      });
    } catch (error) {
      Alert.alert('Error', getUserFriendlyErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    router.replace('/payouts');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Checking setup status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isComplete = status?.payoutsEnabled && status?.chargesEnabled;
  const hasPendingRequirements = status?.currentlyDue && status.currentlyDue.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.content}>
        {isComplete ? (
          <>
            <View style={styles.iconContainer}>
              <IconSymbol name="checkmark.circle.fill" size={80} color="#34C759" />
            </View>
            <Text style={styles.title}>Setup Complete!</Text>
            <Text style={styles.description}>
              Your payout account has been set up successfully. You can now receive
              weekly payouts from your ride earnings.
            </Text>
            <TouchableOpacity style={styles.button} onPress={handleContinue}>
              <Text style={styles.buttonText}>Continue to Payouts</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.iconContainer}>
              <IconSymbol name="clock.fill" size={80} color="#FF9500" />
            </View>
            <Text style={styles.title}>Setup Still Pending</Text>
            <Text style={styles.description}>
              {hasPendingRequirements
                ? 'Please complete all required fields in the onboarding form.'
                : 'Your account setup is being processed. Please check back in a few moments.'}
            </Text>
            {hasPendingRequirements && (
              <View style={styles.requirementsContainer}>
                <Text style={styles.requirementsTitle}>Still Required:</Text>
                {status.currentlyDue.map((requirement, index) => (
                  <Text key={index} style={styles.requirement}>
                    • {requirement}
                  </Text>
                ))}
              </View>
            )}
            <TouchableOpacity style={styles.button} onPress={handleContinue}>
              <Text style={styles.buttonText}>Back to Payouts</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={checkStatus}
            >
              <Text style={styles.secondaryButtonText}>Check Status Again</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  requirementsContainer: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  requirement: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  button: {
    width: '100%',
    backgroundColor: '#4285F4',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4285F4',
  },
});

