import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LoadingScreen } from "@/components/LoadingScreen";
import { SkeletonRideList } from "@/components/SkeletonLoader";
import {
  getEarnings,
  type EarningsSummary,
  type RideEarning,
} from "@/services/api";
import { useUser } from "@/context/UserContext";
import { HapticFeedback } from "@/utils/haptics";
import { getUserFriendlyErrorMessage } from "@/utils/errorHandler";

export default function EarningsScreen(): React.JSX.Element {
  const router = useRouter();
  const { user } = useUser();
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRide, setSelectedRide] = useState<RideEarning | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const fetchEarnings = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const driverId = user.id; // user.id is now guaranteed to be a number in UserContext
      const response = await getEarnings(driverId);
      console.log('📊 Earnings response:', JSON.stringify(response, null, 2));
      if (response.earnings) {
        setEarnings(response.earnings); // Extract earnings from response
      } else {
        console.warn('⚠️ No earnings data in response:', response);
        setEarnings(null);
      }
    } catch (error: unknown) {
      console.error('❌ Error fetching earnings:', error);
      const errorMessage = getUserFriendlyErrorMessage(error);
      setError(errorMessage);
      HapticFeedback.error(); // Haptic feedback on error
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const onRefresh = () => {
    setIsRefreshing(true);
    HapticFeedback.selection(); // Haptic feedback on pull-to-refresh
    fetchEarnings().finally(() => {
      HapticFeedback.success(); // Success feedback when refresh completes
    });
  };

  // Use real data or fallback to 0
  const totalEarnings = earnings?.total || 0;
  const weeklyEarnings = earnings?.thisWeek || 0;
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
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      labels.push(dayNames[date.getDay()]);

      // Calculate earnings for this specific day
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      let dayEarnings = 0;
      if (earnings?.recentRides && earnings.recentRides.length > 0) {
        earnings.recentRides.forEach((ride) => {
          const rideDate = new Date(ride.date);
          rideDate.setHours(0, 0, 0, 0); // Normalize to midnight for comparison

          if (rideDate.getTime() === dayStart.getTime()) {
            dayEarnings += ride.earnings;
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

  const handleRidePress = (ride: RideEarning) => {
    setSelectedRide(ride);
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setTimeout(() => setSelectedRide(null), 300); // Clear after animation
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Your Earnings</Text>
            <Text style={styles.subtitle}>Loading...</Text>
          </View>
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <SkeletonRideList count={3} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.errorContainer}>
          <IconSymbol
            size={48}
            name="exclamationmark.triangle"
            color="#FF3B30"
          />
          <Text style={styles.errorTitle}>Unable to Load Earnings</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              HapticFeedback.action();
              fetchEarnings();
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
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
            colors={['#4285F4']}
            progressBackgroundColor="#1C1C1E"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Your Earnings</Text>
            <Text style={styles.subtitle}>
              {completedRides > 0
                ? `${completedRides} completed ride${
                    completedRides !== 1 ? "s" : ""
                  }`
                : "No completed rides yet"}
            </Text>
          </View>
        </View>

        {/* Total Earnings Card */}
        <View style={styles.totalEarningsCard}>
          <View style={styles.totalEarningsHeader}>
            <View>
              <Text style={styles.totalLabel}>Weekly earnings</Text>
              <View style={styles.earningsMainSection}>
                <Text style={styles.totalAmount}>
                  {formatCurrency(weeklyEarnings)}
                </Text>
                <View style={styles.iconCircle}>
                  <IconSymbol
                    size={24}
                    name="dollarsign.circle.fill"
                    color="#000000"
                  />
                </View>
              </View>
              <View style={styles.allTimeEarnings}>
                <Text style={styles.allTimeLabel}>All time</Text>
                <Text style={styles.allTimeAmount}>
                  {formatCurrency(totalEarnings)}
                </Text>
              </View>
              {totalEarnings === 0 && completedRides === 0 ? (
                <Text style={styles.growthText}>
                  Complete your first ride to start earning!
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={() => router.push('/payouts')}
                  style={styles.payoutLink}
                >
                  <Text style={styles.payoutLinkText}>
                    Set up bank account to receive payouts →
                  </Text>
                </TouchableOpacity>
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
                    {
                      height:
                        maxMiniChartValue > 0
                          ? (value / maxMiniChartValue) * 40
                          : 0,
                    },
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
            <TouchableOpacity
              style={styles.statCardHorizontal}
              activeOpacity={0.7}
            >
              <View style={styles.statIconContainer}>
                <IconSymbol size={20} name="car" color="#4285F4" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>{completedRides}</Text>
                <Text style={styles.statLabel}>Rides</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCardHorizontal}
              activeOpacity={0.7}
            >
              <View style={styles.statIconContainer}>
                <IconSymbol size={20} name="mappin" color="#9D4EDD" />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>
                  {totalDistance.toFixed(1)} mi
                </Text>
                <Text style={styles.statLabel}>Distance</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCardHorizontal}
              activeOpacity={0.7}
              onPress={() => router.push('/payouts')}
            >
              <View style={styles.statIconContainer}>
                <IconSymbol
                  size={20}
                  name="creditcard.fill"
                  color="#4285F4"
                />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statValue}>Payouts</Text>
                <Text style={styles.statLabel}>Bank Account</Text>
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
              const barHeight =
                maxWeeklyValue > 0
                  ? Math.max(
                      (dayEarnings / maxWeeklyValue) * 160,
                      dayEarnings > 0 ? 20 : 0
                    )
                  : 0;

              return (
                <View key={day} style={styles.chartBar}>
                  <View style={styles.barContainer}>
                    <View style={[styles.bar, { height: barHeight }]} />
                  </View>
                  <Text style={styles.barLabel}>{day}</Text>
                  <Text style={styles.barValue}>
                    {dayEarnings > 0 ? formatCurrency(dayEarnings) : "$0"}
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
            {earnings?.recentRides && earnings.recentRides.length > 0 ? (
              earnings.recentRides.map((ride, index) => (
                <TouchableOpacity
                  key={ride.rideId}
                  style={styles.earningItem}
                  activeOpacity={0.7}
                  onPress={() => handleRidePress(ride)}
                >
                  <View style={styles.earningLeft}>
                    <View style={styles.earningIconContainer}>
                      <IconSymbol size={18} name="checkmark" color="#4285F4" />
                    </View>
                    <View>
                      <Text style={styles.earningTitle}>
                        {ride.from} → {ride.to}
                      </Text>
                      <Text style={styles.earningDate}>
                        {ride.displayDate ||
                          new Date(ride.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                        • {ride.seatsBooked} seat
                        {ride.seatsBooked !== 1 ? "s" : ""} booked •{" "}
                        {formatCurrency(ride.pricePerSeat)}/seat
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.earningAmount}>
                    +{formatCurrency(ride.earnings)}
                  </Text>
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

      {/* Ride Details Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedRide && (
              <>
                {/* Simple Header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Earnings Details</Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={closeModal}
                    activeOpacity={0.7}
                  >
                    <IconSymbol size={20} name="xmark" color="#999999" />
                  </TouchableOpacity>
                </View>

                {/* Route - Simplified */}
                <View style={styles.modalRouteSection}>
                  <View style={styles.modalRouteRow}>
                    <View style={styles.modalRouteDot} />
                    <Text style={styles.modalRouteText} numberOfLines={1}>
                      {selectedRide.from}
                    </Text>
                  </View>
                  <View style={styles.modalRouteLine} />
                  <View style={styles.modalRouteRow}>
                    <View style={[styles.modalRouteDot, styles.modalRouteDotEnd]} />
                    <Text style={styles.modalRouteText} numberOfLines={1}>
                      {selectedRide.to}
                    </Text>
                  </View>
                </View>

                {/* Earnings Summary Card */}
                <View style={styles.modalEarningsCard}>
                  <Text style={styles.modalEarningsLabel}>Net Earnings</Text>
                  <Text style={styles.modalEarningsAmount}>
                    {formatCurrency(selectedRide.earnings)}
                  </Text>
                  <Text style={styles.modalEarningsSubtext}>
                    {selectedRide.displayDate ||
                      new Date(selectedRide.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                  </Text>
                </View>

                {/* Breakdown Section */}
                {selectedRide.earningsBreakdown ? (
                  <View style={styles.modalBreakdownSection}>
                    <Text style={styles.modalSectionTitle}>Breakdown</Text>
                    
                    <View style={styles.modalBreakdownItem}>
                      <Text style={styles.modalBreakdownLabel}>Gross Earnings</Text>
                      <Text style={styles.modalBreakdownValue}>
                        {formatCurrency(selectedRide.earningsBreakdown.grossEarnings)}
                      </Text>
                    </View>

                    <View style={styles.modalBreakdownItem}>
                      <Text style={styles.modalBreakdownLabel}>Processing Fee</Text>
                      <Text style={styles.modalBreakdownFee}>
                        -{formatCurrency(selectedRide.earningsBreakdown.processingFee)}
                      </Text>
                    </View>

                    <View style={styles.modalBreakdownItem}>
                      <Text style={styles.modalBreakdownLabel}>Platform Fee</Text>
                      <Text style={styles.modalBreakdownFee}>
                        -{formatCurrency(selectedRide.earningsBreakdown.commission)}
                      </Text>
                    </View>

                    <View style={styles.modalBreakdownDivider} />

                    <View style={styles.modalBreakdownItem}>
                      <Text style={styles.modalBreakdownTotalLabel}>Net Earnings</Text>
                      <Text style={styles.modalBreakdownTotalValue}>
                        {formatCurrency(selectedRide.earnings)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.modalBreakdownSection}>
                    <View style={styles.modalBreakdownItem}>
                      <Text style={styles.modalBreakdownLabel}>
                        {selectedRide.seatsBooked} seat{selectedRide.seatsBooked !== 1 ? "s" : ""} × {formatCurrency(selectedRide.pricePerSeat)}
                      </Text>
                      <Text style={styles.modalBreakdownValue}>
                        {formatCurrency(selectedRide.earnings)}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Trip Details - Compact */}
                <View style={styles.modalDetailsSection}>
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Distance</Text>
                    <Text style={styles.modalDetailValue}>
                      {(selectedRide.distance * 0.621371).toFixed(1)} mi
                    </Text>
                  </View>
                  <View style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Seats</Text>
                    <Text style={styles.modalDetailValue}>
                      {selectedRide.seatsBooked}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "400",
    color: "#FFFFFF",
    opacity: 0.5,
  },
  totalEarningsCard: {
    backgroundColor: "#4285F4",
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 24,
    padding: 24,
    minHeight: 200,
    overflow: "hidden",
  },
  totalEarningsHeader: {
    marginBottom: 0,
    zIndex: 2,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000",
    opacity: 0.8,
    letterSpacing: 0,
    marginBottom: 16,
  },
  earningsMainSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(0, 0, 0, 0.2)",
  },
  totalAmount: {
    fontSize: 56,
    fontWeight: "900",
    color: "#000000",
    letterSpacing: -2.5,
  },
  allTimeEarnings: {
    marginTop: 12,
    marginBottom: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.15)",
  },
  allTimeLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#000000",
    opacity: 0.7,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  allTimeAmount: {
    fontSize: 24,
    fontWeight: "800",
    color: "#000000",
    opacity: 0.9,
    letterSpacing: -0.5,
  },
  earningsBreakdown: {
    marginTop: 8,
    marginBottom: 8,
  },
  breakdownText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#000000",
    opacity: 0.6,
    marginBottom: 2,
  },
  growthText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#000000",
    opacity: 0.7,
    marginBottom: 20,
  },
  payoutLink: {
    marginTop: 12,
    paddingVertical: 8,
  },
  payoutLinkText: {
    fontSize: 14,
    color: "#4285F4",
    fontWeight: "600",
  },
  miniChart: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: "50%",
    height: 80,
    justifyContent: "flex-end",
    paddingBottom: 16,
    paddingRight: 16,
  },
  chartLine: {
    position: "absolute",
    bottom: 35,
    right: 16,
    left: "10%",
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 2,
    shadowColor: "#FFFFFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 50,
    paddingHorizontal: 4,
  },
  chartBarItem: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 3,
    minHeight: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  statCardHorizontal: {
    flex: 1,
    backgroundColor: "#0F0F0F",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    padding: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
    alignItems: "center",
    gap: 8,
  },
  statCardWide: {
    backgroundColor: "#0F0F0F",
    borderRadius: 22,
    borderTopWidth: 2,
    borderLeftWidth: 1.5,
    borderRightWidth: 1,
    borderBottomWidth: 0.5,
    borderTopColor: "rgba(255, 255, 255, 0.12)",
    borderLeftColor: "rgba(255, 255, 255, 0.08)",
    borderRightColor: "rgba(0, 0, 0, 0.3)",
    borderBottomColor: "rgba(0, 0, 0, 0.5)",
    padding: 18,
    shadowColor: "#FFFFFF",
    shadowOffset: { width: -2, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    transform: [
      { perspective: 1200 },
      { rotateX: "-2deg" },
      { rotateZ: "-0.5deg" },
    ],
  },
  statContent: {
    alignItems: "center",
  },
  statHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
  },
  statProgressBar: {
    width: 40,
    height: 4,
    backgroundColor: "#4285F4",
    borderRadius: 2,
  },
  progressPurple: {
    backgroundColor: "#9D4EDD",
  },
  progressYellow: {
    backgroundColor: "#FFD60A",
  },
  progressGreen: {
    backgroundColor: "#4285F4",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 2,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
    opacity: 0.6,
    textAlign: "center",
  },
  chartCard: {
    backgroundColor: "#0F0F0F",
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    padding: 20,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  chartSubtitle: {
    fontSize: 13,
    fontWeight: "400",
    color: "#FFFFFF",
    opacity: 0.5,
  },
  chartMetric: {
    alignItems: "flex-end",
    backgroundColor: "rgba(66, 133, 244, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(66, 133, 244, 0.2)",
  },
  chartMetricLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FFFFFF",
    opacity: 0.6,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  chartMetricValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#4285F4",
    letterSpacing: -0.5,
  },
  simpleChart: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    height: 200,
    paddingTop: 20,
  },
  chartBar: {
    alignItems: "center",
    flex: 1,
  },
  barContainer: {
    width: "100%",
    height: 160,
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 8,
  },
  bar: {
    width: 24,
    backgroundColor: "#4285F4",
    borderRadius: 12,
    minHeight: 20,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
    opacity: 0.7,
    marginTop: 4,
  },
  barValue: {
    fontSize: 10,
    fontWeight: "500",
    color: "#FFFFFF",
    opacity: 0.5,
    marginTop: 2,
  },
  recentCard: {
    backgroundColor: "#0F0F0F",
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    padding: 20,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  earningsList: {
    marginTop: 16,
  },
  earningItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  earningLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  earningIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
  },
  earningTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  earningDate: {
    fontSize: 12,
    fontWeight: "400",
    color: "#FFFFFF",
    opacity: 0.5,
  },
  earningAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4285F4",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: "500",
    color: "#999999",
  },
  emptyEarnings: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyEarningsText: {
    fontSize: 14,
    fontWeight: "400",
    color: "#666666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 14,
    fontWeight: "400",
    color: "#999999",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: "#4285F4",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 380,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#0F0F0F",
  },
  modalRouteSection: {
    marginBottom: 20,
    paddingVertical: 12,
  },
  modalRouteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalRouteDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4285F4",
  },
  modalRouteDotEnd: {
    backgroundColor: "#34C759",
  },
  modalRouteLine: {
    width: 2,
    height: 12,
    backgroundColor: "#2A2A2A",
    marginLeft: 3,
    marginVertical: 6,
  },
  modalRouteText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
    flex: 1,
  },
  modalEarningsCard: {
    backgroundColor: "#0F0F0F",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    alignItems: "center",
  },
  modalEarningsLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#999999",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalEarningsAmount: {
    fontSize: 36,
    fontWeight: "800",
    color: "#4285F4",
    letterSpacing: -1,
    marginBottom: 4,
  },
  modalEarningsSubtext: {
    fontSize: 13,
    fontWeight: "400",
    color: "#666666",
  },
  modalBreakdownSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999999",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalBreakdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  modalBreakdownLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#CCCCCC",
  },
  modalBreakdownValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  modalBreakdownFee: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FF9500",
  },
  modalBreakdownDivider: {
    height: 1,
    backgroundColor: "#2A2A2A",
    marginVertical: 12,
  },
  modalBreakdownTotalLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalBreakdownTotalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#4285F4",
  },
  modalDetailsSection: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2A",
  },
  modalDetailRow: {
    alignItems: "center",
    gap: 4,
  },
  modalDetailLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#666666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalDetailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
