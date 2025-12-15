import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { useUser } from "@/context/UserContext";
import { cancelBooking, type RiderBooking } from "@/services/api";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { calculateDistance } from "@/utils/distance";

export default function BookingDetailsScreen(): React.JSX.Element {
  const params = useLocalSearchParams();
  const { user } = useUser();
  const [booking, setBooking] = useState<RiderBooking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (params.booking) {
      try {
        const bookingData = JSON.parse(params.booking as string);
        setBooking(bookingData);
      } catch (error) {
        console.error("Error parsing booking data:", error);
        Alert.alert("Error", "Invalid booking data");
        router.back();
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [params.booking]);

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
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

  // Calculate total distance including booking pickup location
  const calculateTotalDistance = (): number => {
    if (!booking) return 0;
    
    const ride = booking.ride;
    if (!ride.fromLatitude || !ride.fromLongitude || !ride.toLatitude || !ride.toLongitude) {
      return ride.distance || 0;
    }

    if (!booking.pickupLatitude || !booking.pickupLongitude) {
      return ride.distance || 0;
    }

    // Calculate: origin → pickup → destination
    const originToPickup = calculateDistance(
      ride.fromLatitude,
      ride.fromLongitude,
      booking.pickupLatitude,
      booking.pickupLongitude
    );
    
    const pickupToDestination = calculateDistance(
      booking.pickupLatitude,
      booking.pickupLongitude,
      ride.toLatitude,
      ride.toLongitude
    );

    return originToPickup + pickupToDestination;
  };

  const totalDistance = calculateTotalDistance();

  const handleCallDriver = () => {
    if (!booking?.ride.driverPhone) return;
    const phoneNumber = booking.ride.driverPhone.replace(/\D/g, "");
    const url =
      Platform.OS === "ios" ? `telprompt:${phoneNumber}` : `tel:${phoneNumber}`;
    Linking.openURL(url).catch((err) => {
      console.error("Error opening phone:", err);
      Alert.alert("Error", "Unable to make phone call");
    });
  };

  const handleMessageDriver = () => {
    if (!booking?.ride.driverPhone) return;
    const phoneNumber = booking.ride.driverPhone.replace(/\D/g, "");
    const url = `sms:${phoneNumber}`;
    Linking.openURL(url).catch((err) => {
      console.error("Error opening messages:", err);
      Alert.alert("Error", "Unable to open messages");
    });
  };

  const handleCancelBooking = () => {
    if (!booking || !user) {
      Alert.alert("Error", "Unable to cancel booking. Please try again.");
      return;
    }

    // Don't allow cancellation if already cancelled, rejected, or completed
    if (booking.status === "cancelled" || booking.status === "rejected") {
      Alert.alert(
        "Cannot Cancel",
        `This booking has already been ${
          booking.status === "cancelled" ? "cancelled" : "rejected"
        }.`
      );
      return;
    }

    if (booking.status === "completed" || booking.isPast) {
      Alert.alert(
        "Cannot Cancel",
        "This booking cannot be cancelled as it has already been completed."
      );
      return;
    }

    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking? This action cannot be undone.",
      [
        {
          text: "No",
          style: "cancel",
        },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            setIsCancelling(true);
            try {
              const userId =
                typeof user.id === "string" ? parseInt(user.id) : user.id;
              await cancelBooking(booking.id, userId);
              Alert.alert(
                "Booking Cancelled",
                "Your booking has been cancelled successfully.",
                [
                  {
                    text: "OK",
                    onPress: () => router.back(),
                  },
                ]
              );
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.message || "Failed to cancel booking. Please try again."
              );
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Booking not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const canCancel =
    (booking.status === "pending" || booking.status === "confirmed") &&
    !booking.isPast;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <IconSymbol name="chevron.left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Status Badge */}
        <View style={styles.statusSection}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  booking.status === "cancelled" ||
                  booking.status === "rejected"
                    ? "#FF3B3020"
                    : booking.status === "pending"
                    ? "#FF950020"
                    : booking.isPast || booking.status === "completed"
                    ? "#99999920"
                    : "#34C75920",
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    booking.status === "cancelled" ||
                    booking.status === "rejected"
                      ? "#FF3B30"
                      : booking.status === "pending"
                      ? "#FF9500"
                      : booking.isPast || booking.status === "completed"
                      ? "#999999"
                      : "#34C759",
                },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    booking.status === "cancelled" ||
                    booking.status === "rejected"
                      ? "#FF3B30"
                      : booking.status === "pending"
                      ? "#FF9500"
                      : booking.isPast || booking.status === "completed"
                      ? "#999999"
                      : "#34C759",
                },
              ]}
            >
              {booking.status === "cancelled"
                ? "Cancelled"
                : booking.status === "rejected"
                ? "Rejected"
                : booking.status === "pending"
                ? "Pending"
                : booking.isPast || booking.status === "completed"
                ? "Completed"
                : "Confirmed"}
            </Text>
          </View>
          <Text style={styles.confirmationNumber}>
            {booking.confirmationNumber}
          </Text>
        </View>

        {/* Route Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Route</Text>
          <View style={styles.routeSection}>
            <View style={styles.routeItem}>
              <View style={styles.routeDot} />
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>From</Text>
                <Text style={styles.routeAddress}>
                  {booking.ride.fromAddress}
                </Text>
                <Text style={styles.routeCity}>{booking.ride.fromCity}</Text>
              </View>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeItem}>
              <View style={[styles.routeDot, styles.routeDotEnd]} />
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>To</Text>
                <Text style={styles.routeAddress}>
                  {booking.ride.toAddress}
                </Text>
                <Text style={styles.routeCity}>{booking.ride.toCity}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Pickup Location Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pickup Location</Text>
          <View style={styles.pickupSection}>
            <IconSymbol name="mappin" size={20} color="#4285F4" />
            <View style={styles.pickupContent}>
              <Text style={styles.pickupAddress}>{booking.pickupAddress}</Text>
              {booking.pickupCity && (
                <Text style={styles.pickupCity}>
                  {booking.pickupCity}
                  {booking.pickupState && `, ${booking.pickupState}`}
                  {booking.pickupZipCode && ` ${booking.pickupZipCode}`}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Trip Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trip Details</Text>
          <View style={styles.detailsGrid}>
            <View style={styles.detailRow}>
              <IconSymbol name="calendar" size={18} color="#999999" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>
                  {formatDate(booking.ride.departureTime)}
                </Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <IconSymbol name="clock" size={18} color="#999999" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Time</Text>
                <Text style={styles.detailValue}>
                  {formatTime(booking.ride.departureTime)}
                </Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <IconSymbol name="person" size={18} color="#999999" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Seats</Text>
                <Text style={styles.detailValue}>
                  {booking.numberOfSeats} seat
                  {booking.numberOfSeats !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>
            {totalDistance > 0 && (
              <View style={styles.detailRow}>
                <IconSymbol name="mappin" size={18} color="#999999" />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Total Distance</Text>
                  <Text style={styles.detailValue}>
                    {totalDistance.toFixed(1)} mi
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Pricing Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pricing</Text>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>
              ${booking.ride.pricePerSeat.toFixed(2)} × {booking.numberOfSeats}{" "}
              seat
              {booking.numberOfSeats !== 1 ? "s" : ""}
            </Text>
            <Text style={styles.pricingValue}>
              ${(booking.ride.pricePerSeat * booking.numberOfSeats).toFixed(2)}
            </Text>
          </View>
          <View style={styles.pricingDivider} />
          <View style={styles.pricingRow}>
            <Text style={styles.pricingTotalLabel}>Total</Text>
            <Text style={styles.pricingTotalValue}>
              ${(booking.ride.pricePerSeat * booking.numberOfSeats).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Driver Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Driver</Text>
          <View style={styles.driverSection}>
            <View style={styles.driverAvatar}>
              <Text style={styles.driverAvatarText}>
                {booking.ride.driverName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{booking.ride.driverName}</Text>
              {booking.ride.carMake && booking.ride.carModel && (
                <Text style={styles.carInfo}>
                  {booking.ride.carYear} {booking.ride.carMake}{" "}
                  {booking.ride.carModel}
                  {booking.ride.carColor && ` • ${booking.ride.carColor}`}
                </Text>
              )}
            </View>
          </View>
          {canCancel && (
            <View style={styles.contactButtons}>
              <TouchableOpacity
                style={[styles.contactButton, styles.callButton]}
                onPress={handleCallDriver}
                activeOpacity={0.8}
              >
                <IconSymbol name="phone.fill" size={18} color="#FFFFFF" />
                <Text style={styles.contactButtonText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactButton, styles.messageButton]}
                onPress={handleMessageDriver}
                activeOpacity={0.8}
              >
                <IconSymbol name="message.fill" size={18} color="#FFFFFF" />
                <Text style={styles.contactButtonText}>Message</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Cancel Button */}
      {canCancel && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.cancelButton,
              isCancelling && styles.cancelButtonDisabled,
            ]}
            onPress={handleCancelBooking}
            disabled={isCancelling}
            activeOpacity={0.8}
          >
            {isCancelling ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol
                  name="xmark.circle.fill"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.cancelButtonText}>Cancel Booking</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
  errorText: {
    fontSize: 16,
    color: "#999999",
    marginBottom: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: "#000000",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  statusSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  confirmationNumber: {
    fontSize: 12,
    fontWeight: "500",
    color: "#999999",
  },
  card: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2A2A2C",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  routeSection: {
    gap: 12,
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  routeDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#4285F4",
    marginTop: 4,
    marginRight: 12,
  },
  routeDotEnd: {
    backgroundColor: "#FF3B30",
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: "#2A2A2C",
    marginLeft: 6,
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
    fontSize: 15,
    fontWeight: "500",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  routeCity: {
    fontSize: 13,
    fontWeight: "400",
    color: "#999999",
  },
  pickupSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  pickupContent: {
    flex: 1,
  },
  pickupAddress: {
    fontSize: 15,
    fontWeight: "500",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  pickupCity: {
    fontSize: 13,
    fontWeight: "400",
    color: "#999999",
  },
  detailsGrid: {
    gap: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#999999",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  pricingLabel: {
    fontSize: 14,
    fontWeight: "400",
    color: "#999999",
  },
  pricingValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  pricingDivider: {
    height: 1,
    backgroundColor: "#2A2A2C",
    marginBottom: 12,
  },
  pricingTotalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  pricingTotalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4285F4",
  },
  driverSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#4285F4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  driverAvatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  carInfo: {
    fontSize: 13,
    fontWeight: "400",
    color: "#999999",
  },
  contactButtons: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#2A2A2C",
  },
  contactButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  callButton: {
    backgroundColor: "#34C759",
  },
  messageButton: {
    backgroundColor: "#4285F4",
  },
  contactButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  footer: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: "#000000",
    borderTopWidth: 1,
    borderTopColor: "#1A1A1A",
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF3B30",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
