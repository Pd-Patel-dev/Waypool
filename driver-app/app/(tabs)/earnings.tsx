import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getEarnings, type EarningsSummary } from '@/services/api';
import { useUser } from '@/context/UserContext';

export default function EarningsScreen(): React.JSX.Element {
  const { user } = useUser();
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEarnings = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      console.log('💰 Fetching earnings for driver:', user.id);
      const earningsData = await getEarnings(user.id);
      console.log('💰 Earnings data received:', earningsData);
      setEarnings(earningsData);
    } catch (error: any) {
      console.error('❌ Error fetching earnings:', error);
      setError(error.message || 'Failed to load earnings. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, [user?.id]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchEarnings();
  };

  // Use real data or fallback to 0
  const totalEarnings = earnings?.total || 0;
  const weeklyEarnings = earnings?.weekly || 0;
  const monthlyEarnings = earnings?.monthly || 0;
  const completedRides = earnings?.totalRides || 0;
  const totalDistance = earnings?.totalDistance || 0;
  const avgEarningsPerRide = earnings?.averagePerRide || 0;

  // Calculate weekly earnings data for the last 7 days
  const getWeeklyEarningsData = () => {
    const now = new Date();
    const labels: string[] = [];
    const data: number[] = [];
    
    // Generate labels and data for the last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      // Get day abbreviation
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      labels.push(dayNames[date.getDay()]);
      
      // Calculate earnings for this specific day
      const dayStart = new Date(date);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      
      let dayEarnings = 0;
      if (earnings?.recentEarnings && earnings.recentEarnings.length > 0) {
        earnings.recentEarnings.forEach((earning) => {
          const earningDate = new Date(earning.date);
          if (earningDate >= dayStart && earningDate <= dayEnd) {
            dayEarnings += earning.amount;
          }
        });
      }
      
      data.push(dayEarnings);
    }
    
    return {
      labels,
      datasets: [{ data }],
    };
  };

  const weeklyData = getWeeklyEarningsData();
  
  // Find max value for chart scaling
  const maxWeeklyValue = Math.max(...weeklyData.datasets[0].data, 1); // At least 1 to avoid division by zero
  
  // Get mini chart data from weekly earnings (last 8 days for visualization)
  const miniChartData = weeklyData.datasets[0].data.slice(-8);
  const maxMiniChartValue = Math.max(...miniChartData, 1);

  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      } else if (diffDays === 1) {
        return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      }
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Loading earnings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar style="light" />
        <View style={styles.errorContainer}>
          <IconSymbol size={48} name="exclamationmark.triangle" color="#FF3B30" />
          <Text style={styles.errorTitle}>Unable to Load Earnings</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={fetchEarnings}
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#4285F4"
          />
        }>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Your Earnings</Text>
            <Text style={styles.subtitle}>
              {completedRides > 0 
                ? `${completedRides} completed ride${completedRides !== 1 ? 's' : ''}`
                : 'No completed rides yet'}
            </Text>
          </View>
        </View>

        {/* Total Earnings Card */}
        <View style={styles.totalEarningsCard}>
          <View style={styles.totalEarningsHeader}>
            <View>
              <Text style={styles.totalLabel}>Weekly earnings</Text>
              <View style={styles.earningsMainSection}>
                <Text style={styles.totalAmount}>{formatCurrency(weeklyEarnings)}</Text>
                <View style={styles.iconCircle}>
                  <IconSymbol size={24} name="dollarsign.circle.fill" color="#000000" />
                </View>
              </View>
              <View style={styles.allTimeEarnings}>
                <Text style={styles.allTimeLabel}>All time</Text>
                <Text style={styles.allTimeAmount}>{formatCurrency(totalEarnings)}</Text>
              </View>
              {totalEarnings === 0 && completedRides === 0 ? (
                <Text style={styles.growthText}>Complete your first ride to start earning!</Text>
              ) : (
                <Text style={styles.growthText}>Upgrade your payout method in settings</Text>
              )}
            </View>
          </View>
          
          {/* Mini Chart Visualization */}
          <View style={styles.miniChart}>
            {/* Line graph effect */}
            <View style={styles.chartLine} />
            {/* Bars underneath - using real weekly data */}
            <View style={styles.chartBars}>
              {miniChartData.map((value, index) => (
                <View 
                  key={index}
                  style={[
                    styles.chartBarItem,
                    { height: maxMiniChartValue > 0 ? (value / maxMiniChartValue) * 40 : 0 }
                  ]} 
                />
              ))}
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsContainer}>
          {/* Top Row - 3 Cards Horizontal */}
          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statCardHorizontal} activeOpacity={0.7}>
              <View style={styles.statIconContainer}>
                <IconSymbol size={20} name="car" color="#4285F4" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{completedRides}</Text>
                <Text style={styles.statLabel}>Rides</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.statCardHorizontal} activeOpacity={0.7}>
              <View style={styles.statIconContainer}>
                <IconSymbol size={20} name="mappin" color="#9D4EDD" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{totalDistance.toFixed(1)} mi</Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.statCardHorizontal} activeOpacity={0.7}>
              <View style={styles.statIconContainer}>
                <IconSymbol size={20} name="dollarsign.circle" color="#34C759" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{formatCurrency(avgEarningsPerRide)}</Text>
                <Text style={styles.statLabel}>Avg/Ride</Text>
              </View>
            </TouchableOpacity>
          </View>

        </View>

        {/* Weekly Earnings Chart */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>Weekly Earnings</Text>
              <Text style={styles.chartSubtitle}>Last 7 days</Text>
            </View>
            <View style={styles.chartMetric}>
              <Text style={styles.chartMetricLabel}>Avg/Ride</Text>
              <Text style={styles.chartMetricValue}>
                {formatCurrency(completedRides > 0 ? avgEarningsPerRide : 0)}
              </Text>
            </View>
          </View>
          <View style={styles.simpleChart}>
            {weeklyData.labels.map((day, index) => {
              const dayEarnings = weeklyData.datasets[0].data[index];
              const barHeight = maxWeeklyValue > 0 
                ? Math.max((dayEarnings / maxWeeklyValue) * 160, dayEarnings > 0 ? 20 : 0)
                : 0;
              
              return (
                <View key={day} style={styles.chartBar}>
                  <View style={styles.barContainer}>
                    <View 
                      style={[
                        styles.bar, 
                        { height: barHeight }
                      ]} 
                    />
                  </View>
                  <Text style={styles.barLabel}>{day}</Text>
                  <Text style={styles.barValue}>
                    {dayEarnings > 0 ? formatCurrency(dayEarnings) : '$0'}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Recent Earnings List */}
        <View style={styles.recentCard}>
          <Text style={styles.chartTitle}>Recent Earnings</Text>
          <View style={styles.earningsList}>
            {earnings?.recentEarnings && earnings.recentEarnings.length > 0 ? (
              earnings.recentEarnings.map((earning, index) => (
                <TouchableOpacity key={earning.rideId} style={styles.earningItem} activeOpacity={0.7}>
                  <View style={styles.earningLeft}>
                    <View style={styles.earningIconContainer}>
                      <IconSymbol size={18} name="checkmark" color="#4285F4" />
                    </View>
                    <View>
                      <Text style={styles.earningTitle}>Ride #{earning.rideId}</Text>
                      <Text style={styles.earningDate}>{formatDate(earning.date)}</Text>
                    </View>
                  </View>
                  <Text style={styles.earningAmount}>+{formatCurrency(earning.amount)}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyEarnings}>
                <Text style={styles.emptyEarningsText}>No recent earnings</Text>
              </View>
            )}
          </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#FFFFFF',
    opacity: 0.5,
  },
  totalEarningsCard: {
    backgroundColor: '#4285F4',
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 24,
    padding: 24,
    minHeight: 200,
    overflow: 'hidden',
  },
  totalEarningsHeader: {
    marginBottom: 0,
    zIndex: 2,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    opacity: 0.8,
    letterSpacing: 0,
    marginBottom: 16,
  },
  earningsMainSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.2)',
  },
  totalAmount: {
    fontSize: 56,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -2.5,
  },
  allTimeEarnings: {
    marginTop: 12,
    marginBottom: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.15)',
  },
  allTimeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    opacity: 0.7,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  allTimeAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    opacity: 0.9,
    letterSpacing: -0.5,
  },
  earningsBreakdown: {
    marginTop: 8,
    marginBottom: 8,
  },
  breakdownText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#000000',
    opacity: 0.6,
    marginBottom: 2,
  },
  growthText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#000000',
    opacity: 0.7,
    marginBottom: 20,
  },
  miniChart: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '50%',
    height: 80,
    justifyContent: 'flex-end',
    paddingBottom: 16,
    paddingRight: 16,
  },
  chartLine: {
    position: 'absolute',
    bottom: 35,
    right: 16,
    left: '10%',
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 2,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 50,
    paddingHorizontal: 4,
  },
  chartBarItem: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 3,
    minHeight: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  statCardHorizontal: {
    flex: 1,
    backgroundColor: '#0F0F0F',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
    alignItems: 'center',
    gap: 8,
  },
  statCardWide: {
    backgroundColor: '#0F0F0F',
    borderRadius: 22,
    borderTopWidth: 2,
    borderLeftWidth: 1.5,
    borderRightWidth: 1,
    borderBottomWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
    borderLeftColor: 'rgba(255, 255, 255, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.3)',
    borderBottomColor: 'rgba(0, 0, 0, 0.5)',
    padding: 18,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: -2, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    transform: [{ perspective: 1200 }, { rotateX: '-2deg' }, { rotateZ: '-0.5deg' }],
  },
  statContent: {
    alignItems: 'center',
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statProgressBar: {
    width: 40,
    height: 4,
    backgroundColor: '#4285F4',
    borderRadius: 2,
  },
  progressPurple: {
    backgroundColor: '#9D4EDD',
  },
  progressYellow: {
    backgroundColor: '#FFD60A',
  },
  progressGreen: {
    backgroundColor: '#4285F4',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.6,
    textAlign: 'center',
  },
  chartCard: {
    backgroundColor: '#0F0F0F',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    padding: 20,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  chartSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#FFFFFF',
    opacity: 0.5,
  },
  chartMetric: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(66, 133, 244, 0.2)',
  },
  chartMetricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.6,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  chartMetricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#4285F4',
    letterSpacing: -0.5,
  },
  simpleChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 200,
    paddingTop: 20,
  },
  chartBar: {
    alignItems: 'center',
    flex: 1,
  },
  barContainer: {
    width: '100%',
    height: 160,
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 8,
  },
  bar: {
    width: 24,
    backgroundColor: '#4285F4',
    borderRadius: 12,
    minHeight: 20,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.7,
    marginTop: 4,
  },
  barValue: {
    fontSize: 10,
    fontWeight: '500',
    color: '#FFFFFF',
    opacity: 0.5,
    marginTop: 2,
  },
  recentCard: {
    backgroundColor: '#0F0F0F',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  earningsList: {
    marginTop: 16,
  },
  earningItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  earningLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  earningIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  earningTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  earningDate: {
    fontSize: 12,
    fontWeight: '400',
    color: '#FFFFFF',
    opacity: 0.5,
  },
  earningAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4285F4',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#999999',
  },
  emptyEarnings: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyEarningsText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    fontWeight: '400',
    color: '#999999',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
