import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LoadingScreen } from "@/components/LoadingScreen";
import { getPastRides, type Ride } from "@/services/api";
import { useUser } from "@/context/UserContext";
import { calculateTotalDistance } from "@/utils/distance";

export default function PastRidesScreen(): React.JSX.Element {
  const { user } = useUser();
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchPastRides = useCallback(async () => {
    if (!user?.id) return;

    try {
      const pastRides = await getPastRides(user.id);
      setRides(pastRides);
    } catch (error: unknown) {
      // Silently handle error - user can retry by refreshing
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPastRides();
  }, [fetchPastRides]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchPastRides();
  };

  const formatDate = (dateString: string, fallbackDate?: string, fallbackTime?: string): string => {
    try {
      // Try to parse as ISO string first
      if (dateString) {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        }
      }
      
      // If that fails and we have fallback date/time, combine them
      if (fallbackDate && fallbackTime) {
        try {
          // Parse MM/DD/YYYY format
          const dateParts = fallbackDate.split('/').map(Number);
          if (dateParts.length === 3) {
            const [month, day, year] = dateParts;
            
            // Parse time with AM/PM
            const timeMatch = fallbackTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (timeMatch) {
              let hours = parseInt(timeMatch[1], 10);
              const minutes = parseInt(timeMatch[2], 10);
              const meridiem = timeMatch[3].toUpperCase();
              
              if (meridiem === 'PM' && hours !== 12) hours += 12;
              if (meridiem === 'AM' && hours === 12) hours = 0;
              
              const date = new Date(year, month - 1, day, hours, minutes);
              return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
            }
          }
        } catch (e) {
        }
      }
      
      // Last resort: return the original string or a default
      return fallbackDate || dateString || "Invalid Date";
    } catch {
      return fallbackDate || dateString || "Invalid Date";
    }
  };

  const formatTime = (dateString: string, fallbackTime?: string, fallbackDate?: string): string => {
    try {
      // Try to parse as ISO string first
      if (dateString) {
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
          return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          });
        }
      }
      
      // If that fails and we have fallback date/time, combine them to create a proper date
      if (fallbackDate && fallbackTime) {
        try {
          // Parse MM/DD/YYYY format
          const dateParts = fallbackDate.split('/').map(Number);
          if (dateParts.length === 3) {
            const [month, day, year] = dateParts;
            
            // Parse time with AM/PM
            const timeMatch = fallbackTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (timeMatch) {
              let hours = parseInt(timeMatch[1], 10);
              const minutes = parseInt(timeMatch[2], 10);
              const meridiem = timeMatch[3].toUpperCase();
              
              if (meridiem === 'PM' && hours !== 12) hours += 12;
              if (meridiem === 'AM' && hours === 12) hours = 0;
              
              const date = new Date(year, month - 1, day, hours, minutes);
              return date.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              });
            }
          }
        } catch (e) {
        }
      }
      
      // If we have a fallback time string, try to format it directly
      if (fallbackTime) {
        // If it's already in "HH:MM AM/PM" format, return it as is
        const timeMatch = fallbackTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (timeMatch) {
          return fallbackTime; // Return formatted time string
        }
      }
      
      return "";
    } catch {
      return fallbackTime || "";
    }
  };

  const renderRideItem = ({ item }: { item: Ride }) => {
    const passengerCount = item.passengers?.length || 0;
    // Use stored totalEarnings from database, or calculate if not available (for backward compatibility)
    // Using centralized calculation utility
    const totalEarnings = item.totalEarnings !== undefined && item.totalEarnings !== null
      ? item.totalEarnings
      : calculateRideEarnings(item);
    
    // Calculate total distance including passenger pickups
    const totalDistance = calculateTotalDistance(item);

    return (
      <TouchableOpacity
        style={styles.rideCard}
        activeOpacity={0.7}
        onPress={() => {
          router.push({
            pathname: "/past-ride-details",
            params: { rideId: item.id.toString() },
          });
        }}
      >
        <View style={styles.rideHeader}>
          <View style={styles.rideHeaderLeft}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Completed</Text>
            </View>
            <Text style={styles.rideDate}>
              {formatDate(item.departureTime || "", item.departureDate, item.departureTimeString)}
            </Text>
          </View>
          <Text style={styles.rideTime}>
            {formatTime(item.departureTime || "", item.departureTimeString, item.departureDate)}
          </Text>
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.routePoint}>
            <View style={styles.routeMarker} />
            <View style={styles.routeContent}>
              <Text style={styles.routeLabel}>FROM</Text>
              <Text style={styles.routeAddress} numberOfLines={1}>
                {item.fromAddress}
              </Text>
            </View>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routePoint}>
            <View style={[styles.routeMarker, styles.routeMarkerDest]} />
            <View style={styles.routeContent}>
              <Text style={styles.routeLabel}>TO</Text>
              <Text style={styles.routeAddress} numberOfLines={1}>
                {item.toAddress}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.rideFooter}>
          <View style={styles.rideStats}>
            <View style={styles.statItem}>
              <IconSymbol size={16} name="person.2.fill" color="#999999" />
              <Text style={styles.statText}>
                {passengerCount} passenger{passengerCount !== 1 ? "s" : ""}
              </Text>
            </View>
            {totalDistance > 0 && (
              <View style={styles.statItem}>
                <IconSymbol size={16} name="mappin" color="#999999" />
                <Text style={styles.statText}>{totalDistance.toFixed(1)} mi</Text>
              </View>
            )}
          </View>
          <View style={styles.earningsContainer}>
            <Text style={styles.earningsLabel}>Earnings</Text>
            <Text style={styles.earningsAmount}>${totalEarnings.toFixed(2)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Past Rides</Text>
          <View style={styles.backButton} />
        </View>
        <LoadingScreen message="Loading past rides..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Past Rides</Text>
        <View style={styles.backButton} />
      </View>

      {rides.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol size={64} name="clock" color="#666666" />
          <Text style={styles.emptyTitle}>No Past Rides</Text>
          <Text style={styles.emptyText}>
            Your completed rides will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          renderItem={renderRideItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#4285F4"
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  rideCard: {
    backgroundColor: "#0F0F0F",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1A1A1A",
  },
  rideHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  rideHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(52, 199, 89, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34C759",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#34C759",
    textTransform: "uppercase",
  },
  rideDate: {
    fontSize: 14,
    fontWeight: "500",
    color: "#999999",
  },
  rideTime: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  routeContainer: {
    marginBottom: 16,
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  routeMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4285F4",
    marginTop: 4,
  },
  routeMarkerDest: {
    backgroundColor: "#FF3B30",
  },
  routeContent: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666666",
    textTransform: "uppercase",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  routeAddress: {
    fontSize: 15,
    fontWeight: "500",
    color: "#FFFFFF",
    lineHeight: 20,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: "#1A1A1A",
    marginLeft: 5,
    marginVertical: 4,
  },
  rideFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#1A1A1A",
  },
  rideStats: {
    flexDirection: "row",
    gap: 16,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#999999",
  },
  earningsContainer: {
    alignItems: "flex-end",
  },
  earningsLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#666666",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  earningsAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#34C759",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "400",
    color: "#999999",
    textAlign: "center",
  },
});

