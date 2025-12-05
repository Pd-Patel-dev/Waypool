import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity, Animated, PanResponder } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { IconSymbol } from '@/components/ui/icon-symbol';

const screenWidth = Dimensions.get('window').width;

export default function EarningsScreen(): React.JSX.Element {
  // Mock earnings data
  const totalEarnings = 1248.50;
  const weeklyEarnings = 342.00;
  const monthlyEarnings = totalEarnings;
  const completedRides = 24;
  const totalDistance = 156.8;
  const avgRating = 4.8;

  // 3D tilt animation values
  const rotateX = useRef(new Animated.Value(0)).current;
  const rotateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        Animated.spring(scale, {
          toValue: 1.02,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderMove: (evt, gestureState) => {
        // Calculate rotation based on touch position
        const { dx, dy } = gestureState;
        const maxTilt = 15;
        
        const newRotateY = (dx / 200) * maxTilt;
        const newRotateX = (-dy / 200) * maxTilt;

        Animated.parallel([
          Animated.spring(rotateX, {
            toValue: newRotateX,
            useNativeDriver: true,
          }),
          Animated.spring(rotateY, {
            toValue: newRotateY,
            useNativeDriver: true,
          }),
        ]).start();
      },
      onPanResponderRelease: () => {
        Animated.parallel([
          Animated.spring(rotateX, {
            toValue: 0,
            friction: 5,
            useNativeDriver: true,
          }),
          Animated.spring(rotateY, {
            toValue: 0,
            friction: 5,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            friction: 5,
            useNativeDriver: true,
          }),
        ]).start();
      },
    })
  ).current;

  // Weekly earnings data for line chart
  const weeklyData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      data: [45, 68, 52, 89, 78, 125, 95],
    }],
  };

  // Monthly rides data for bar chart
  const ridesData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [{
      data: [5, 8, 6, 5],
    }],
  };

  const chartConfig = {
    backgroundColor: '#000000',
    backgroundGradientFrom: '#0A0A0A',
    backgroundGradientTo: '#0A0A0A',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(66, 133, 244, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity * 0.6})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#4285F4',
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: '#1A1A1A',
      strokeWidth: 1,
    },
  };

  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Your Earnings</Text>
            <Text style={styles.subtitle}>Track your performance</Text>
          </View>
        </View>

        {/* Total Earnings Card */}
        <TouchableOpacity 
          style={styles.totalEarningsCard}
          activeOpacity={0.9}
          onPress={() => console.log('Total earnings tapped')}>
          <View style={styles.totalEarningsHeader}>
            <View>
              <Text style={styles.totalLabel}>Total earnings this month</Text>
              <View style={styles.earningsMainSection}>
                <Text style={styles.totalAmount}>{formatCurrency(totalEarnings)}</Text>
                <View style={styles.iconCircle}>
                  <IconSymbol size={24} name="dollarsign.circle.fill" color="#000000" />
                </View>
              </View>
              <Text style={styles.growthText}>Upgrade your payout method in settings</Text>
            </View>
          </View>
          
          {/* Mini Chart Visualization */}
          <View style={styles.miniChart}>
            {/* Line graph effect */}
            <View style={styles.chartLine} />
            {/* Bars underneath */}
            <View style={styles.chartBars}>
              {[45, 68, 52, 89, 78, 125, 95, 110].map((value, index) => (
                <View 
                  key={index}
                  style={[
                    styles.chartBarItem,
                    { height: (value / 125) * 40 }
                  ]} 
                />
              ))}
            </View>
          </View>
        </TouchableOpacity>

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
                <Text style={styles.statValue}>{totalDistance}km</Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.statCardHorizontal} activeOpacity={0.7}>
              <View style={styles.statIconContainer}>
                <IconSymbol size={20} name="star" color="#FFD60A" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{avgRating}</Text>
                <Text style={styles.statLabel}>Rating</Text>
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
              <Text style={styles.chartMetricValue}>{formatCurrency(weeklyEarnings / completedRides)}</Text>
            </View>
          </View>
          <View style={styles.simpleChart}>
            {weeklyData.labels.map((day, index) => (
              <View key={day} style={styles.chartBar}>
                <View style={styles.barContainer}>
                  <View 
                    style={[
                      styles.bar, 
                      { height: (weeklyData.datasets[0].data[index] / 125) * 160 }
                    ]} 
                  />
                </View>
                <Text style={styles.barLabel}>{day}</Text>
                <Text style={styles.barValue}>${weeklyData.datasets[0].data[index]}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Earnings List */}
        <View style={styles.recentCard}>
          <Text style={styles.chartTitle}>Recent Earnings</Text>
          <View style={styles.earningsList}>
            <TouchableOpacity style={styles.earningItem} activeOpacity={0.7}>
              <View style={styles.earningLeft}>
                <View style={styles.earningIconContainer}>
                  <IconSymbol size={18} name="checkmark" color="#4285F4" />
                </View>
                <View>
                  <Text style={styles.earningTitle}>Ride to Downtown</Text>
                  <Text style={styles.earningDate}>Today, 2:30 PM</Text>
                </View>
              </View>
              <Text style={styles.earningAmount}>+$45.00</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.earningItem} activeOpacity={0.7}>
              <View style={styles.earningLeft}>
                <View style={styles.earningIconContainer}>
                  <IconSymbol size={18} name="checkmark" color="#4285F4" />
                </View>
                <View>
                  <Text style={styles.earningTitle}>Airport Ride</Text>
                  <Text style={styles.earningDate}>Today, 10:15 AM</Text>
                </View>
              </View>
              <Text style={styles.earningAmount}>+$78.50</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.earningItem} activeOpacity={0.7}>
              <View style={styles.earningLeft}>
                <View style={styles.earningIconContainer}>
                  <IconSymbol size={18} name="checkmark" color="#4285F4" />
                </View>
                <View>
                  <Text style={styles.earningTitle}>City Center</Text>
                  <Text style={styles.earningDate}>Yesterday, 5:45 PM</Text>
                </View>
              </View>
              <Text style={styles.earningAmount}>+$32.00</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.earningItem} activeOpacity={0.7}>
              <View style={styles.earningLeft}>
                <View style={styles.earningIconContainer}>
                  <IconSymbol size={18} name="checkmark" color="#4285F4" />
                </View>
                <View>
                  <Text style={styles.earningTitle}>Mall Trip</Text>
                  <Text style={styles.earningDate}>Yesterday, 2:20 PM</Text>
                </View>
              </View>
              <Text style={styles.earningAmount}>+$25.00</Text>
            </TouchableOpacity>
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
});
