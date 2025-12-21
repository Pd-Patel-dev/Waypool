import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useFocusEffect } from "expo-router";
import { useUser } from "@/context/UserContext";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LoadingScreen } from "@/components/LoadingScreen";
import { SkeletonRideList } from "@/components/SkeletonLoader";
import { HomeHeader, ActiveRideCard, RideCard } from "@/components/home";
import { useRides } from "@/features/rides";
import { calculateTotalDistance } from "@/utils/distance";
import { calculateRideEarnings } from "@/utils/price";
import { formatDate, formatTime, safeParseDate } from "@/utils/date";
import { theme } from "@/design-system";
import type { Ride } from "@/features/rides";

// Custom formatDate that includes "Today"/"Tomorrow" logic
const formatDateWithRelative = (dateString: string): string => {
  const date = safeParseDate(dateString);
  if (!date) return formatDate(dateString);

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    if (dateOnly.getTime() === today.getTime()) {
      return "Today";
    } else if (dateOnly.getTime() === tomorrow.getTime()) {
      return "Tomorrow";
    } else {
      return formatDate(dateString);
    }
  } catch (error) {
    return formatDate(dateString);
  }
};

const isToday = (dateString: string): boolean => {
  const date = new Date(dateString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
};

const getStatusBadge = (ride: Ride) => {
  if (ride.status === "in-progress") {
    return {
      text: "IN PROGRESS",
      color: "#4285F4",
      bgColor: "rgba(66, 133, 244, 0.15)",
    };
  }
  if (ride.status === "completed") {
    return {
      text: "COMPLETED",
      color: "#34C759",
      bgColor: "rgba(52, 199, 89, 0.15)",
    };
  }
  if (ride.status === "cancelled") {
    return {
      text: "CANCELLED",
      color: "#FF3B30",
      bgColor: "rgba(255, 59, 48, 0.15)",
    };
  }
  return {
    text: "SCHEDULED",
    color: "#FFD60A",
    bgColor: "rgba(255, 214, 10, 0.15)",
  };
};

export default function HomeScreen(): React.JSX.Element {
  const { user } = useUser();
  const [showFilters, setShowFilters] = useState(false);

  // Use the useRides hook - all business logic is handled here
  const {
    rides,
    isLoading,
    refreshing,
    onRefresh,
    greeting,
    currentCity,
    currentState,
    currentLocation,
    currentRide,
    todaysRides,
    upcomingRides,
    filterStatus,
    setFilterStatus,
    sortBy,
    setSortBy,
    handleRidePress,
    handleAddRide,
    deleteRide,
  } = useRides();

  // Refetch rides when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        onRefresh();
      }
    }, [user, onRefresh])
  );

  const handleStartRide = useCallback((ride: Ride) => {
    router.push({
      pathname: "/current-ride",
      params: {
        rideId: String(ride.id),
        ride: JSON.stringify(ride),
      },
    });
  }, []);

  const handleDeleteRideWithConfirm = useCallback(
    async (ride: Ride) => {
      Alert.alert(
        "Delete Ride",
        "Are you sure you want to delete this ride? This action cannot be undone.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteRide(ride.id);
              } catch (error: unknown) {
                const errorMessage =
                  error instanceof Error
                    ? error.message
                    : "Failed to delete ride. Please try again.";
                Alert.alert("Error", errorMessage);
              }
            },
          },
        ]
      );
    },
    [deleteRide]
  );

  // If user is not logged in, show loading
  if (!user) {
    return <LoadingScreen message="Loading..." safeArea={true} />;
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top"]}
    >
      <StatusBar style="light" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
            progressBackgroundColor={theme.colors.surface.secondary}
          />
        }
      >
        {/* Greeting Section */}
        <HomeHeader
          userName={user.fullName}
          greeting={greeting}
          currentCity={currentCity}
          currentState={currentState}
        />

        {/* Current Active Ride */}
        {currentRide && (
          <ActiveRideCard
            ride={currentRide}
            onPress={() => handleRidePress(currentRide.id)}
            activeRideProgress={0}
          />
        )}

        {/* Filter and Sort Section */}
        <View style={styles.filterSection}>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[
                styles.filterToggle,
                {
                  backgroundColor: theme.colors.surface.secondary,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={() => setShowFilters(!showFilters)}
              activeOpacity={0.7}
            >
              <IconSymbol
                size={18}
                name="line.3.horizontal.decrease"
                color={theme.colors.text.primary}
              />
              <Text
                style={[
                  styles.filterToggleText,
                  { color: theme.colors.text.primary },
                ]}
              >
                Filter & Sort
              </Text>
              {showFilters ? (
                <IconSymbol
                  size={14}
                  name="chevron.up"
                  color={theme.colors.text.primary}
                />
              ) : (
                <IconSymbol
                  size={14}
                  name="chevron.down"
                  color={theme.colors.text.primary}
                />
              )}
            </TouchableOpacity>
            {(filterStatus !== "all" || sortBy !== "date") && (
              <TouchableOpacity
                style={[
                  styles.clearFiltersButton,
                  {
                    backgroundColor: theme.colors.surface.secondary,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => {
                  setFilterStatus("all");
                  setSortBy("date");
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.clearFiltersText,
                    { color: theme.colors.primary },
                  ]}
                >
                  Clear
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {showFilters && (
            <View
              style={[
                styles.filtersContainer,
                {
                  backgroundColor: theme.colors.surface.primary,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              {/* Status Filter */}
              <View style={styles.filterGroup}>
                <Text
                  style={[
                    styles.filterLabel,
                    { color: theme.colors.text.secondary },
                  ]}
                >
                  Status
                </Text>
                <View style={styles.filterOptions}>
                  {(
                    ["all", "scheduled", "in-progress", "completed"] as const
                  ).map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: theme.colors.surface.secondary,
                          borderColor: theme.colors.border,
                        },
                        filterStatus === status && {
                          backgroundColor: theme.colors.primary,
                          borderColor: theme.colors.primary,
                        },
                      ]}
                      onPress={() => setFilterStatus(status)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: theme.colors.text.primary },
                          filterStatus === status && { color: "#000000" },
                        ]}
                      >
                        {status === "all"
                          ? "All"
                          : status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Sort Options */}
              <View style={styles.filterGroup}>
                <Text
                  style={[
                    styles.filterLabel,
                    { color: theme.colors.text.secondary },
                  ]}
                >
                  Sort By
                </Text>
                <View style={styles.filterOptions}>
                  {(["date", "distance", "earnings"] as const).map((sort) => (
                    <TouchableOpacity
                      key={sort}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: theme.colors.surface.secondary,
                          borderColor: theme.colors.border,
                        },
                        sortBy === sort && {
                          backgroundColor: theme.colors.primary,
                          borderColor: theme.colors.primary,
                        },
                      ]}
                      onPress={() => setSortBy(sort)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: theme.colors.text.primary },
                          sortBy === sort && { color: "#000000" },
                        ]}
                      >
                        {sort === "date"
                          ? "Date"
                          : sort.charAt(0).toUpperCase() + sort.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Today's Rides Section */}
        {todaysRides.length > 0 && (
          <View style={styles.ridesContainer}>
            <View style={styles.sectionHeader}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: theme.colors.text.primary },
                ]}
              >
                Today&apos;s rides
              </Text>
            </View>
            {todaysRides.map((ride) => (
              <RideCard
                key={ride.id}
                ride={ride}
                onPress={() => handleRidePress(ride.id)}
                onEdit={() =>
                  router.push({
                    pathname: "/edit-ride",
                    params: { rideId: ride.id.toString() },
                  })
                }
                onDelete={() => handleDeleteRideWithConfirm(ride)}
                onStartRide={() => handleStartRide(ride)}
                showActions={true}
              />
            ))}
          </View>
        )}

        {/* Upcoming Rides Section */}
        <View style={styles.ridesContainer}>
          <View style={styles.sectionHeader}>
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.colors.text.primary },
              ]}
            >
              Upcoming rides
            </Text>
            <TouchableOpacity
              style={[
                styles.addRideButton,
                { backgroundColor: theme.colors.primary },
              ]}
              onPress={handleAddRide}
              activeOpacity={0.7}
            >
              <Text style={styles.addRideIcon}>+</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <SkeletonRideList count={3} />
          ) : rides.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol
                size={48}
                name="car"
                color={theme.colors.text.tertiary}
              />
              <Text
                style={[
                  styles.emptyTitle,
                  { color: theme.colors.text.primary },
                ]}
              >
                No upcoming rides
              </Text>
              <Text
                style={[
                  styles.emptySubtext,
                  { color: theme.colors.text.secondary },
                ]}
              >
                Tap the + button to create your first ride
              </Text>
            </View>
          ) : upcomingRides.length === 0 && todaysRides.length > 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol
                size={48}
                name="calendar"
                color={theme.colors.text.tertiary}
              />
              <Text
                style={[
                  styles.emptyTitle,
                  { color: theme.colors.text.primary },
                ]}
              >
                No upcoming rides
              </Text>
              <Text
                style={[
                  styles.emptySubtext,
                  { color: theme.colors.text.secondary },
                ]}
              >
                All your rides are scheduled for today
              </Text>
            </View>
          ) : (
            upcomingRides.map((ride) => (
              <RideCard
                key={ride.id}
                ride={ride}
                onPress={() => handleRidePress(ride.id)}
                onEdit={() =>
                  router.push({
                    pathname: "/edit-ride",
                    params: { rideId: ride.id.toString() },
                  })
                }
                onDelete={() => handleDeleteRideWithConfirm(ride)}
                showActions={true}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  filterSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: "600",
  },
  clearFiltersButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  clearFiltersText: {
    fontSize: 14,
    fontWeight: "600",
  },
  filtersContainer: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 16,
  },
  filterGroup: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filterOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  ridesContainer: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  addRideButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  addRideIcon: {
    fontSize: 24,
    fontWeight: "300",
    color: "#000000",
  },
  rideCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  rideCardHeader: {
    position: "relative",
  },
  rideCardContent: {
    padding: 20,
  },
  rideHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  rideTimeContainer: {
    flex: 1,
  },
  rideTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  rideDate: {
    fontSize: 16,
    fontWeight: "700",
  },
  rideTime: {
    fontSize: 14,
    fontWeight: "500",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  seatsContainer: {
    alignItems: "flex-end",
  },
  seatsInfo: {
    alignItems: "flex-end",
  },
  seatsValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  seatsLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  bookedSeatsLabel: {
    fontSize: 11,
    fontWeight: "400",
    marginTop: 2,
  },
  routeContainer: {
    marginBottom: 16,
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  routeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeIndicatorDest: {
    backgroundColor: "#FF3B30",
  },
  routeContent: {
    flex: 1,
  },
  routeAddress: {
    fontSize: 15,
    fontWeight: "500",
  },
  routeConnector: {
    width: 2,
    height: 12,
    marginLeft: 3,
    marginVertical: 2,
    borderRadius: 1,
  },
  infoContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#1A1A1A",
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "500",
  },
  priceValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  earningsValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  actionButtons: {
    position: "absolute",
    top: 20,
    right: 20,
    flexDirection: "row",
    gap: 8,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(66, 133, 244, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  startRideButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  startRideButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  viewRideButtonStyle: {
    borderWidth: 1,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: "400",
    textAlign: "center",
  },
});
