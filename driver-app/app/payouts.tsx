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
  Linking,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useUser } from '@/context/UserContext';
import {
  createConnectAccount,
  getAccountStatus,
  createAccountLink,
  getPayoutBalance,
  initiatePayout,
  getPayoutHistory,
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

    try {
      setLoading(true);
      const result = await createConnectAccount(user.id);

      if (result.onboardingUrl) {
        // Open Stripe onboarding in browser
        const canOpen = await Linking.canOpenURL(result.onboardingUrl);
        if (canOpen) {
          await Linking.openURL(result.onboardingUrl);
        } else {
          Alert.alert('Error', 'Unable to open onboarding link');
        }
      } else {
        // Account already exists, create update link
        const linkResult = await createAccountLink(user.id, 'account_update');
        if (linkResult.url) {
          const canOpen = await Linking.canOpenURL(linkResult.url);
          if (canOpen) {
            await Linking.openURL(linkResult.url);
          }
        }
      }
    } catch (error) {
      Alert.alert('Error', getUserFriendlyErrorMessage(error));
    } finally {
      setLoading(false);
    }
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
    <SafeAreaView style={styles.container}>
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

          {!hasAccount ? (
            <View style={styles.setupSection}>
              <Text style={styles.setupText}>
                Link your bank account to receive payouts from your weekly earnings.
              </Text>
              <TouchableOpacity style={styles.setupButton} onPress={handleSetupAccount}>
                <Text style={styles.setupButtonText}>Set Up Bank Account</Text>
              </TouchableOpacity>
            </View>
          ) : !payoutsEnabled ? (
            <View style={styles.setupSection}>
              <Text style={styles.setupText}>
                Complete your account setup to enable payouts.
              </Text>
              <TouchableOpacity style={styles.setupButton} onPress={handleSetupAccount}>
                <Text style={styles.setupButtonText}>Complete Setup</Text>
              </TouchableOpacity>
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
              <TouchableOpacity
                style={styles.updateButton}
                onPress={handleSetupAccount}
              >
                <Text style={styles.updateButtonText}>Update Account</Text>
              </TouchableOpacity>
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
  },
  setupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
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
  updateButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  updateButtonText: {
    color: '#4285F4',
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#2C2C2E',
    marginBottom: 4,
  },
  statusBadgeSuccess: {
    backgroundColor: '#34C759',
  },
  statusBadgePending: {
    backgroundColor: '#FF9500',
  },
  statusBadgeFailed: {
    backgroundColor: '#FF3B30',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
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

