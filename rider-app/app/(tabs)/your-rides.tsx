import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useFocusEffect } from "expo-router";
import { useUser } from "@/context/UserContext";
import { getRiderBookings, type RiderBooking } from "@/services/api";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function YourRidesScreen(): React.JSX.Element {
  const { user, isLoading: isLoadingUser } = useUser();
  const [bookings, setBookings] = useState<RiderBooking[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

  useEffect(() => {
    if (!isLoadingUser && !user) {
      router.replace("/welcome");
    }
  }, [user, isLoadingUser]);

  const fetchBookings = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const userId = typeof user.id === "string" ? parseInt(user.id) : user.id;
      const response = await getRiderBookings(userId);
      if (response.success) {
        setBookings(response.bookings);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [fetchBookings])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBookings();
  }, [fetchBookings]);

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "Invalid date";
    }
  };

  const formatTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "Invalid time";
    }
  };

  const getStatusColor = (
    status: string,
    rideStatus: string,
    isPast: boolean
  ): string => {
    // Check ride status first (if ride is cancelled, booking is cancelled too)
    if (rideStatus === "cancelled") return "#FF3B30";
    if (status === "cancelled" || status === "rejected") return "#FF3B30";
    if (status === "pending") return "#FF9500";
    if (isPast || status === "completed" || rideStatus === "completed")
      return "#999999";
    return "#34C759";
  };

  const getStatusText = (
    status: string,
    rideStatus: string,
    isPast: boolean
  ): string => {
    // Check ride status first (if ride is cancelled, booking is cancelled too)
    if (rideStatus === "cancelled") return "Cancelled";
    if (status === "cancelled") return "Cancelled";
    if (status === "rejected") return "Rejected";
    if (status === "pending") return "Pending";
    if (isPast || status === "completed" || rideStatus === "completed")
      return "Completed";
    return "Confirmed";
  };

  const upcomingBookings = bookings.filter((booking) => {
    // Exclude if ride is cancelled
    if (booking.ride.status === "cancelled") return false;
    // Exclude if booking is cancelled or rejected
    if (booking.status === "cancelled" || booking.status === "rejected")
      return false;
    // Exclude if past
    if (booking.isPast) return false;
    return true;
  });

  const pastBookings = bookings.filter((booking) => {
    // Include if ride is cancelled
    if (booking.ride.status === "cancelled") return true;
    // Include if booking is cancelled, rejected, or completed
    if (
      booking.status === "cancelled" ||
      booking.status === "rejected" ||
      booking.status === "completed"
    )
      return true;
    // Include if past
    if (booking.isPast) return true;
    return false;
  });

  const displayedBookings =
    activeTab === "upcoming" ? upcomingBookings : pastBookings;

  if (isLoadingUser) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Rides</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "upcoming" && styles.tabActive]}
          onPress={() => setActiveTab("upcoming")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "upcoming" && styles.tabTextActive,
            ]}
          >
            Upcoming ({upcomingBookings.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "past" && styles.tabActive]}
          onPress={() => setActiveTab("past")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "past" && styles.tabTextActive,
            ]}
          >
            Past ({pastBookings.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading && bookings.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
        </View>
      ) : displayedBookings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol name="car" size={48} color="#666666" />
          <Text style={styles.emptyText}>
            {activeTab === "upcoming" ? "No upcoming rides" : "No past rides"}
          </Text>
          <Text style={styles.emptySubtext}>
            {activeTab === "upcoming"
              ? "Your booked rides will appear here"
              : "Your completed rides will appear here"}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4285F4"
            />
          }
          showsVerticalScrollIndicator={true}
        >
          {displayedBookings.map((booking) => (
            <TouchableOpacity
              key={booking.id}
              style={styles.bookingCard}
              activeOpacity={0.8}
              onPress={() => {
                router.push({
                  pathname: "/booking-details",
                  params: {
                    booking: JSON.stringify(booking),
                  },
                });
              }}
            >
              {/* Status Badge */}
              <View style={styles.cardHeader}>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        getStatusColor(
                          booking.status,
                          booking.ride.status,
                          booking.isPast
                        ) + "20",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: getStatusColor(
                          booking.status,
                          booking.ride.status,
                          booking.isPast
                        ),
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color: getStatusColor(
                          booking.status,
                          booking.ride.status,
                          booking.isPast
                        ),
                      },
                    ]}
                  >
                    {getStatusText(
                      booking.status,
                      booking.ride.status,
                      booking.isPast
                    )}
                  </Text>
                </View>
                <Text style={styles.confirmationNumber}>
                  {booking.confirmationNumber}
                </Text>
              </View>

              {/* Route */}
              <View style={styles.routeSection}>
                <View style={styles.routeItem}>
                  <View style={styles.routeDot} />
                  <View style={styles.routeContent}>
                    <Text style={styles.routeLabel}>From</Text>
                    <Text style={styles.routeAddress} numberOfLines={1}>
                      {booking.ride.fromAddress}
                    </Text>
                  </View>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routeItem}>
                  <View style={[styles.routeDot, styles.routeDotEnd]} />
                  <View style={styles.routeContent}>
                    <Text style={styles.routeLabel}>To</Text>
                    <Text style={styles.routeAddress} numberOfLines={1}>
                      {booking.ride.toAddress}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Pickup Location */}
              <View style={styles.pickupSection}>
                <IconSymbol name="mappin" size={14} color="#4285F4" />
                <Text style={styles.pickupText} numberOfLines={1}>
                  Pickup: {booking.pickupAddress}
                </Text>
              </View>

              {/* Details */}
              <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                  <IconSymbol name="clock" size={14} color="#999999" />
                  <Text style={styles.detailText}>
                    {formatDate(booking.ride.departureTime)} •{" "}
                    {formatTime(booking.ride.departureTime)}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <IconSymbol name="person" size={14} color="#999999" />
                  <Text style={styles.detailText}>
                    {booking.numberOfSeats} seat
                    {booking.numberOfSeats !== 1 ? "s" : ""}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <IconSymbol
                    name="dollarsign.circle.fill"
                    size={14}
                    color="#999999"
                  />
                  <Text style={styles.detailText}>
                    $
                    {(
                      booking.ride.pricePerSeat * booking.numberOfSeats
                    ).toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Driver Info */}
              <View style={styles.driverSection}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {booking.ride.driverName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>
                    {booking.ride.driverName}
                  </Text>
                  {booking.ride.carMake && booking.ride.carModel && (
                    <Text style={styles.carInfo}>
                      {booking.ride.carYear} {booking.ride.carMake}{" "}
                      {booking.ride.carModel}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#000000",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#000000",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: "#1C1C1E",
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: "#4285F4",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#999999",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontWeight: "400",
    color: "#999999",
    textAlign: "center",
  },
  bookingCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2A2A2C",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  confirmationNumber: {
    fontSize: 11,
    fontWeight: "500",
    color: "#999999",
  },
  routeSection: {
    marginBottom: 12,
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4285F4",
    marginTop: 4,
    marginRight: 12,
  },
  routeDotEnd: {
    backgroundColor: "#FF3B30",
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: "#2A2A2C",
    marginLeft: 5,
    marginVertical: 4,
  },
  routeContent: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#999999",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  routeAddress: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
    lineHeight: 20,
  },
  pickupSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2C",
    gap: 6,
  },
  pickupText: {
    fontSize: 13,
    fontWeight: "400",
    color: "#999999",
    flex: 1,
  },
  detailsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2C",
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    fontWeight: "400",
    color: "#999999",
  },
  driverSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2C",
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#4285F4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  driverAvatarText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  carInfo: {
    fontSize: 12,
    fontWeight: "400",
    color: "#999999",
  },
});
