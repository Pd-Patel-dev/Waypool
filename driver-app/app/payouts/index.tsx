/**
 * Driver Payouts Screen
 * Allows drivers to link bank accounts and manage payouts
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useUser } from '@/context/UserContext';
import {
  getAccountStatus,
  getPayoutBalance,
  initiatePayout,
  getPayoutHistory,
  deletePayoutAccount,
  resetStripeStatus,
  type PayoutAccountStatus,
  type PayoutBalance,
  type PayoutHistoryItem,
} from '@/services/api';
import { LoadingScreen } from '@/components/LoadingScreen';
import { getUserFriendlyErrorMessage } from '@/utils/errorHandler';

export default function PayoutsScreen(): React.JSX.Element {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accountStatus, setAccountStatus] = useState<PayoutAccountStatus | null>(null);
  const [balance, setBalance] = useState<PayoutBalance | null>(null);
  const [payoutHistory, setPayoutHistory] = useState<PayoutHistoryItem[]>([]);
  const [processingPayout, setProcessingPayout] = useState(false);

  const loadData = async () => {
    if (!user?.id) return;

    try {
      const [status, balanceData, history] = await Promise.all([
        getAccountStatus(user.id),
        getPayoutBalance(user.id),
        getPayoutHistory(user.id, 10, 0),
      ]);

      setAccountStatus(status);
      setBalance(balanceData);
      setPayoutHistory(history.payouts || []);
    } catch (error) {
      console.error('Error loading payout data:', error);
      Alert.alert('Error', getUserFriendlyErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const handleSetupAccount = async () => {
    if (!user?.id) return;

    // Navigate to in-app onboarding screen
    router.push('/payouts/setup');
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) return;

    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your Stripe Connect account? This will unlink your bank account and you will not be able to receive payouts until you set up a new account.\n\nNote: You cannot delete your account if you have pending payouts.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deletePayoutAccount(user.id);
              Alert.alert('Success', 'Account deleted successfully');
              await loadData();
            } catch (error) {
              Alert.alert('Error', getUserFriendlyErrorMessage(error));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleResetStripeStatus = async () => {
    if (!user?.id) return;

    Alert.alert(
      'Reset Stripe Status',
      'This will clear all Stripe-related data from your account in the app (for testing).\n\nThe Stripe account will still exist in Stripe, but the app will treat it as if you haven\'t set up payouts yet.\n\nThis is useful for testing the onboarding flow again.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await resetStripeStatus(user.id);
              Alert.alert(
                'Success',
                'Stripe status reset successfully. You can now set up payouts again.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Navigate to setup screen to start fresh
                      router.push('/payouts/setup');
                    },
                  },
                ]
              );
              await loadData();
            } catch (error) {
              Alert.alert('Error', getUserFriendlyErrorMessage(error));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleInitiatePayout = async () => {
    if (!user?.id || !balance) return;

    if (balance.availableBalance <= 0) {
      Alert.alert('No Balance', 'You have no available balance to payout.');
      return;
    }

    Alert.alert(
      'Confirm Payout',
      `Are you sure you want to initiate a payout of $${balance.availableBalance.toFixed(2)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setProcessingPayout(true);
              await initiatePayout(user.id, balance.availableBalance, 'Weekly payout');
              Alert.alert('Success', 'Payout initiated successfully!');
              await loadData();
            } catch (error) {
              Alert.alert('Error', getUserFriendlyErrorMessage(error));
            } finally {
              setProcessingPayout(false);
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  if (loading && !accountStatus) {
    return <LoadingScreen message="Loading payout information..." />;
  }

  const hasAccount = accountStatus?.hasAccount;
  const payoutsEnabled = accountStatus?.payoutsEnabled;
  const bankAccount = accountStatus?.bankAccount;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          }} 
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payouts</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
      >
        {/* Account Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <IconSymbol name="creditcard.fill" size={24} color="#4285F4" />
            <Text style={styles.cardTitle}>Bank Account</Text>
          </View>

          {!hasAccount || !payoutsEnabled ? (
            <View style={styles.setupSection}>
              <Text style={styles.setupText}>
                {!hasAccount 
                  ? 'Link your bank account to receive payouts from your weekly earnings.'
                  : 'Complete your account setup to enable payouts.'}
              </Text>
              <TouchableOpacity 
                style={[styles.setupButton, loading && styles.setupButtonDisabled]} 
                onPress={handleSetupAccount}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.setupButtonText}>Setup Payouts</Text>
                )}
              </TouchableOpacity>
              {hasAccount && accountStatus && (
                <View style={styles.statusContainer}>
                  <Text style={styles.statusLabel}>Status:</Text>
                  <View style={[
                    styles.statusBadge,
                    accountStatus.payoutsEnabled ? styles.statusBadgeEnabled : styles.statusBadgePending
                  ]}>
                    <Text style={styles.statusText}>
                      {accountStatus.payoutsEnabled ? 'Enabled' : 'Pending'}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ) : bankAccount ? (
            <View style={styles.bankAccountInfo}>
              <View style={styles.bankAccountRow}>
                <IconSymbol name="building.columns.fill" size={20} color="#666666" />
                <Text style={styles.bankAccountText}>
                  {bankAccount.bankName} •••• {bankAccount.last4}
                </Text>
              </View>
              <Text style={styles.bankAccountType}>
                {bankAccount.accountType === 'checking' ? 'Checking' : 'Savings'} Account
              </Text>
              <View style={styles.accountActions}>
                <TouchableOpacity
                  style={styles.updateButton}
                  onPress={handleSetupAccount}
                >
                  <Text style={styles.updateButtonText}>Update Account</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={handleResetStripeStatus}
                >
                  <IconSymbol name="arrow.counterclockwise" size={16} color="#FF9500" />
                  <Text style={styles.resetButtonText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDeleteAccount}
                >
                  <IconSymbol name="trash.fill" size={16} color="#FF3B30" />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.setupSection}>
              <Text style={styles.setupText}>No bank account linked.</Text>
              <TouchableOpacity style={styles.setupButton} onPress={handleSetupAccount}>
                <Text style={styles.setupButtonText}>Link Bank Account</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Balance Card */}
        {balance && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <IconSymbol name="dollarsign.circle.fill" size={24} color="#34C759" />
              <Text style={styles.cardTitle}>Available Balance</Text>
            </View>
            <View style={styles.balanceSection}>
              <Text style={styles.balanceAmount}>${balance.availableBalance.toFixed(2)}</Text>
              <Text style={styles.balanceLabel}>Available for payout</Text>
              <View style={styles.balanceDetails}>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceDetailLabel}>Weekly Earnings:</Text>
                  <Text style={styles.balanceDetailValue}>${balance.weeklyNetEarnings.toFixed(2)}</Text>
                </View>
                {balance.pendingPayouts > 0 && (
                  <View style={styles.balanceRow}>
                    <Text style={styles.balanceDetailLabel}>Pending:</Text>
                    <Text style={styles.balanceDetailValue}>${balance.pendingPayouts.toFixed(2)}</Text>
                  </View>
                )}
              </View>
              {payoutsEnabled && balance.availableBalance > 0 && (
                <TouchableOpacity
                  style={[styles.payoutButton, processingPayout && styles.payoutButtonDisabled]}
                  onPress={handleInitiatePayout}
                  disabled={processingPayout}
                >
                  {processingPayout ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <IconSymbol name="arrow.down.circle.fill" size={20} color="#FFFFFF" />
                      <Text style={styles.payoutButtonText}>Request Payout</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Payout History */}
        {payoutHistory.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <IconSymbol name="clock.fill" size={24} color="#FF9500" />
              <Text style={styles.cardTitle}>Recent Payouts</Text>
            </View>
            {payoutHistory.map((payout) => (
              <View key={payout.id} style={styles.payoutItem}>
                <View style={styles.payoutItemLeft}>
                  <Text style={styles.payoutAmount}>${payout.amount.toFixed(2)}</Text>
                  <Text style={styles.payoutDate}>
                    {new Date(payout.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.payoutItemRight}>
                  <View
                    style={[
                      styles.statusBadge,
                      payout.status === 'paid' && styles.statusBadgeSuccess,
                      payout.status === 'pending' && styles.statusBadgePending,
                      payout.status === 'failed' && styles.statusBadgeFailed,
                    ]}
                  >
                    <Text style={styles.statusText}>{payout.status.toUpperCase()}</Text>
                  </View>
                  {payout.arrivalDate && (
                    <Text style={styles.arrivalDate}>
                      Arrives: {new Date(payout.arrivalDate).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              </View>
            ))}
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push('/payout-history')}
            >
              <Text style={styles.viewAllButtonText}>View All Payouts</Text>
              <IconSymbol name="chevron.right" size={16} color="#4285F4" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C1E',
    backgroundColor: '#000000',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: '#1C1C1E',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  setupSection: {
    alignItems: 'center',
  },
  setupText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 16,
  },
  setupButton: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupButtonDisabled: {
    opacity: 0.6,
  },
  setupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  statusLabel: {
    fontSize: 14,
    color: '#999999',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#2C2C2E',
  },
  statusBadgeEnabled: {
    backgroundColor: '#34C759',
  },
  statusBadgePending: {
    backgroundColor: '#FF9500',
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bankAccountInfo: {
    gap: 8,
  },
  bankAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bankAccountText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  bankAccountType: {
    fontSize: 14,
    color: '#999999',
    marginLeft: 28,
  },
  accountActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  updateButton: {
    flex: 1,
  },
  updateButtonText: {
    color: '#4285F4',
    fontSize: 14,
    fontWeight: '500',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  resetButtonText: {
    color: '#FF9500',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
  balanceSection: {
    alignItems: 'center',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#999999',
    marginBottom: 16,
  },
  balanceDetails: {
    width: '100%',
    gap: 8,
    marginBottom: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  balanceDetailLabel: {
    fontSize: 14,
    color: '#999999',
  },
  balanceDetailValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  payoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4285F4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  payoutButtonDisabled: {
    opacity: 0.6,
  },
  payoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  payoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  payoutItemLeft: {
    flex: 1,
  },
  payoutAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  payoutDate: {
    fontSize: 12,
    color: '#999999',
  },
  payoutItemRight: {
    alignItems: 'flex-end',
  },
  statusBadgeSuccess: {
    backgroundColor: '#34C759',
  },
  statusBadgeFailed: {
    backgroundColor: '#FF3B30',
  },
  arrivalDate: {
    fontSize: 12,
    color: '#999999',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 12,
    gap: 4,
  },
  viewAllButtonText: {
    color: '#4285F4',
    fontSize: 14,
    fontWeight: '500',
  },
});

