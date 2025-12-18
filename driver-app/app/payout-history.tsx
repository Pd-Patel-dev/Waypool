/**
 * Payout History Screen
 * Shows all payout transactions for the driver
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useUser } from '@/context/UserContext';
import { getPayoutHistory, type PayoutHistoryItem } from '@/services/api';
import { LoadingScreen } from '@/components/LoadingScreen';
import { getUserFriendlyErrorMessage } from '@/utils/errorHandler';

export default function PayoutHistoryScreen(): React.JSX.Element {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payouts, setPayouts] = useState<PayoutHistoryItem[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const loadPayouts = async (reset: boolean = false) => {
    if (!user?.id) return;

    try {
      const currentOffset = reset ? 0 : offset;
      const result = await getPayoutHistory(user.id, limit, currentOffset);

      if (reset) {
        setPayouts(result.payouts || []);
        setOffset(limit);
      } else {
        setPayouts((prev) => [...prev, ...(result.payouts || [])]);
        setOffset((prev) => prev + limit);
      }

      setHasMore((result.payouts?.length || 0) === limit);
    } catch (error) {
      console.error('Error loading payout history:', error);
      // Don't show alert on initial load failure, just log
      if (!loading) {
        // Only show alert if user manually refreshed
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPayouts(true);
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPayouts(true);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return '#34C759';
      case 'pending':
      case 'processing':
        return '#FF9500';
      case 'failed':
        return '#FF3B30';
      case 'canceled':
        return '#999999';
      default:
        return '#666666';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <LoadingScreen message="Loading payout history..." />;
  }

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
              router.replace('/payouts');
            }
          }} 
          style={styles.backButton}
        >
          <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payout History</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
      >
        {payouts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <IconSymbol name="creditcard" size={64} color="#666666" />
            <Text style={styles.emptyText}>No payouts yet</Text>
            <Text style={styles.emptySubtext}>
              Your payout history will appear here once you receive your first payout.
            </Text>
          </View>
        ) : (
          payouts.map((payout) => (
            <View key={payout.id} style={styles.payoutCard}>
              <View style={styles.payoutHeader}>
                <View style={styles.payoutHeaderLeft}>
                  <IconSymbol name="dollarsign.circle.fill" size={32} color={getStatusColor(payout.status)} />
                  <View style={styles.payoutInfo}>
                    <Text style={styles.payoutAmount}>${payout.amount.toFixed(2)}</Text>
                    <Text style={styles.payoutDate}>
                      {formatDate(payout.createdAt)} at {formatTime(payout.createdAt)}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(payout.status) },
                  ]}
                >
                  <Text style={styles.statusText}>{payout.status.toUpperCase()}</Text>
                </View>
              </View>

              {payout.description && (
                <Text style={styles.payoutDescription}>{payout.description}</Text>
              )}

              {payout.arrivalDate && (
                <View style={styles.arrivalInfo}>
                  <IconSymbol name="calendar" size={16} color="#999999" />
                  <Text style={styles.arrivalText}>
                    Arrives: {formatDate(payout.arrivalDate)}
                  </Text>
                </View>
              )}

              {payout.failureMessage && (
                <View style={styles.failureInfo}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#FF3B30" />
                  <Text style={styles.failureText}>{payout.failureMessage}</Text>
                </View>
              )}

              <View style={styles.payoutFooter}>
                <View style={styles.payoutMethod}>
                  <IconSymbol name="building.columns" size={14} color="#999999" />
                  <Text style={styles.payoutMethodText}>
                    {payout.payoutMethod === 'bank_account' ? 'Bank Account' : payout.payoutMethod}
                  </Text>
                </View>
                <Text style={styles.payoutId}>ID: {payout.id}</Text>
              </View>
            </View>
          ))
        )}

        {hasMore && payouts.length > 0 && (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={() => loadPayouts(false)}
          >
            <Text style={styles.loadMoreText}>Load More</Text>
          </TouchableOpacity>
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
  payoutCard: {
    backgroundColor: '#1C1C1E',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  payoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  payoutHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  payoutInfo: {
    flex: 1,
  },
  payoutAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  payoutDate: {
    fontSize: 12,
    color: '#999999',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  payoutDescription: {
    fontSize: 14,
    color: '#CCCCCC',
    marginBottom: 8,
  },
  arrivalInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  arrivalText: {
    fontSize: 12,
    color: '#999999',
  },
  failureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    backgroundColor: '#2C1F1F',
    padding: 8,
    borderRadius: 6,
  },
  failureText: {
    fontSize: 12,
    color: '#FF3B30',
    flex: 1,
  },
  payoutFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  payoutMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  payoutMethodText: {
    fontSize: 12,
    color: '#999999',
  },
  payoutId: {
    fontSize: 11,
    color: '#666666',
  },
  loadMoreButton: {
    margin: 16,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
  },
  loadMoreText: {
    color: '#4285F4',
    fontSize: 16,
    fontWeight: '500',
  },
});

