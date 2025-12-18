import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from "react-native-maps";
import { type Ride, getRideById } from "@/services/api";
import { useUser } from "@/context/UserContext";
import { calculateTotalDistance } from "@/utils/distance";
import { calculateNetEarnings } from "@/utils/price";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function PastRideDetailsScreen(): React.JSX.Element {
  const params = useLocalSearchParams();
  const { user } = useUser();
  const [rideData, setRideData] = useState<Ride | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const rideId = params.rideId ? parseInt(params.rideId as string) : null;

  useEffect(() => {
    const fetchRideDetails = async () => {
      if (!rideId || !user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const ride = await getRideById(rideId, user.id);
        setRideData(ride);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };

    fetchRideDetails();
  }, [rideId, user?.id]);

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
            <IconSymbol size={20} name="chevron.left" color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ride Details</Text>
          <View style={styles.backButton} />
        </View>
        <LoadingScreen message="Loading ride details..." />
      </SafeAreaView>
    );
  }

  if (!rideData) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <IconSymbol size={20} name="chevron.left" color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ride Details</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.emptyContainer}>
          <IconSymbol size={48} name="exclamationmark.circle" color="#666666" />
          <Text style={styles.emptyText}>Ride not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const pricePerSeat = rideData.pricePerSeat || rideData.price || 0;
  const totalSeatsBooked = rideData.passengers?.reduce((sum, passenger) => {
    const seats = (passenger as any).numberOfSeats || 1;
    return sum + seats;
  }, 0) || 0;
  const totalEarnings = rideData.totalEarnings !== undefined && rideData.totalEarnings !== null
    ? rideData.totalEarnings
    : calculateNetEarnings(rideData);
  const passengerCount = rideData.passengers?.length || 0;

  const formatDateTime = (dateString: string, fallbackDate?: string, fallbackTime?: string): string => {
    try {
      let date: Date | null = null;
      
      if (dateString) {
        date = new Date(dateString);
        if (isNaN(date.getTime())) {
          date = null;
        }
      }
      
      if (!date && fallbackDate && fallbackTime) {
        try {
          const dateParts = fallbackDate.split('/').map(Number);
          if (dateParts.length === 3) {
            const [month, day, year] = dateParts;
            const timeMatch = fallbackTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (timeMatch) {
              let hours = parseInt(timeMatch[1], 10);
              const minutes = parseInt(timeMatch[2], 10);
              const meridiem = timeMatch[3].toUpperCase();
              
              if (meridiem === 'PM' && hours !== 12) hours += 12;
              if (meridiem === 'AM' && hours === 12) hours = 0;
              
              date = new Date(year, month - 1, day, hours, minutes);
            }
          }
        } catch (e) {
        }
      }
      
      if (date && !isNaN(date.getTime())) {
        const dateStr = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        const timeStr = date.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
        return `${dateStr} at ${timeStr}`;
      }
      
      if (fallbackDate && fallbackTime) {
        return `${fallbackDate} at ${fallbackTime}`;
      }
      
      return fallbackDate || dateString || "Invalid Date";
    } catch {
      if (fallbackDate && fallbackTime) {
        return `${fallbackDate} at ${fallbackTime}`;
      }
      return fallbackDate || dateString || "Invalid Date";
    }
  };

  const totalDistance = calculateTotalDistance(rideData);

  const mapRegion: Region | undefined =
    rideData.fromLatitude && rideData.fromLongitude
      ? {
          latitude: rideData.fromLatitude,
          longitude: rideData.fromLongitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }
      : undefined;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <IconSymbol size={20} name="chevron.left" color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride Details</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Earnings Card - Hero Section */}
        <View style={styles.earningsCard}>
          <View style={styles.earningsHeader}>
            <Text style={styles.earningsLabel}>Net Earnings</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Completed</Text>
            </View>
          </View>
          <Text style={styles.earningsAmount}>${totalEarnings.toFixed(2)}</Text>
          <View style={styles.earningsInfo}>
            <Text style={styles.earningsInfoText}>
              {totalSeatsBooked} seat{totalSeatsBooked !== 1 ? "s" : ""} × ${pricePerSeat.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <IconSymbol size={20} name="person.2.fill" color="#4285F4" />
            <Text style={styles.statValue}>{passengerCount}</Text>
            <Text style={styles.statLabel}>Passengers</Text>
          </View>
          {totalDistance > 0 && (
            <View style={styles.statCard}>
              <IconSymbol size={20} name="mappin" color="#34C759" />
              <Text style={styles.statValue}>{totalDistance.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Miles</Text>
            </View>
          )}
          <View style={styles.statCard}>
            <IconSymbol size={20} name="dollarsign.circle" color="#FF9500" />
            <Text style={styles.statValue}>${pricePerSeat.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Per Seat</Text>
          </View>
        </View>

        {/* Route Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route</Text>
          <View style={styles.routeCard}>
            <View style={styles.routeItem}>
              <View style={styles.routeIcon}>
                <IconSymbol size={16} name="mappin.circle.fill" color="#4285F4" />
              </View>
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>From</Text>
                <Text style={styles.routeAddress} numberOfLines={2}>
                  {rideData.fromAddress}
                </Text>
                {rideData.fromCity && (
                  <Text style={styles.routeCity}>
                    {rideData.fromCity}, {rideData.fromState}
                  </Text>
                )}
              </View>
            </View>

            {/* Passenger Pickups */}
            {rideData.passengers && rideData.passengers.length > 0 && rideData.passengers.map((passenger, index) => (
              <React.Fragment key={`passenger-${passenger.id || index}`}>
                <View style={styles.routeDivider} />
                <View style={styles.routeItem}>
                  <View style={[styles.routeIcon, styles.routeIconPassenger]}>
                    <IconSymbol size={14} name="person.fill" color="#34C759" />
                  </View>
                  <View style={styles.routeContent}>
                    <Text style={styles.routeLabel}>
                      Pickup {index + 1}{passenger.riderName ? ` • ${passenger.riderName}` : ""}
                    </Text>
                    <Text style={styles.routeAddress} numberOfLines={2}>
                      {passenger.pickupAddress}
                    </Text>
                    {passenger.pickupCity && (
                      <Text style={styles.routeCity}>
                        {passenger.pickupCity}, {passenger.pickupState}
                      </Text>
                    )}
                  </View>
                </View>
              </React.Fragment>
            ))}

            <View style={styles.routeDivider} />
            <View style={styles.routeItem}>
              <View style={[styles.routeIcon, styles.routeIconDest]}>
                <IconSymbol size={16} name="flag.fill" color="#FF3B30" />
              </View>
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>To</Text>
                <Text style={styles.routeAddress} numberOfLines={2}>
                  {rideData.toAddress}
                </Text>
                {rideData.toCity && (
                  <Text style={styles.routeCity}>
                    {rideData.toCity}, {rideData.toState}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Map */}
        {mapRegion && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Map</Text>
            <View style={styles.mapContainer}>
              <MapView
                provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
                style={styles.map}
                initialRegion={mapRegion}
                scrollEnabled={true}
                zoomEnabled={true}
                showsUserLocation={false}
                showsMyLocationButton={false}
              >
                {rideData.fromLatitude && rideData.fromLongitude && (
                  <Marker
                    coordinate={{
                      latitude: rideData.fromLatitude,
                      longitude: rideData.fromLongitude,
                    }}
                    title="Pickup"
                  >
                    <View style={styles.markerContainer}>
                      <View style={styles.pickupMarker}>
                        <IconSymbol size={14} name="car.fill" color="#FFFFFF" />
                      </View>
                    </View>
                  </Marker>
                )}

                {rideData.passengers && rideData.passengers.map((passenger, index) => {
                  if (!passenger.pickupLatitude || !passenger.pickupLongitude) return null;
                  return (
                    <Marker
                      key={`passenger-${passenger.id || index}`}
                      coordinate={{
                        latitude: passenger.pickupLatitude,
                        longitude: passenger.pickupLongitude,
                      }}
                    >
                      <View style={styles.markerContainer}>
                        <View style={styles.passengerMarker}>
                          <IconSymbol size={12} name="person.fill" color="#FFFFFF" />
                        </View>
                      </View>
                    </Marker>
                  );
                })}

                {rideData.toLatitude && rideData.toLongitude && (
                  <Marker
                    coordinate={{
                      latitude: rideData.toLatitude,
                      longitude: rideData.toLongitude,
                    }}
                    title="Destination"
                  >
                    <View style={styles.markerContainer}>
                      <View style={styles.destinationMarker}>
                        <IconSymbol size={14} name="flag.fill" color="#FFFFFF" />
                      </View>
                    </View>
                  </Marker>
                )}
              </MapView>
            </View>
          </View>
        )}

        {/* Trip Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trip Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <IconSymbol size={18} name="calendar" color="#999999" />
                <Text style={styles.infoLabel}>Date & Time</Text>
              </View>
              <Text style={styles.infoValue}>
                {formatDateTime(rideData.departureTime || "", rideData.departureDate, rideData.departureTimeString)}
              </Text>
            </View>
            {rideData.isRecurring && (
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <IconSymbol size={18} name="repeat" color="#999999" />
                  <Text style={styles.infoLabel}>Recurring</Text>
                </View>
                <Text style={styles.infoValue}>
                  {rideData.recurringPattern === 'daily' ? 'Daily' : 
                   rideData.recurringPattern === 'weekly' ? 'Weekly' : 
                   rideData.recurringPattern === 'monthly' ? 'Monthly' : 'N/A'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Passengers */}
        {rideData.passengers && rideData.passengers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Passengers</Text>
            {rideData.passengers.map((passenger, index) => (
              <View key={`passenger-${passenger.id || index}`} style={styles.passengerCard}>
                <View style={styles.passengerHeader}>
                  <View style={styles.passengerAvatar}>
                    <IconSymbol size={20} name="person.fill" color="#4285F4" />
                  </View>
                  <View style={styles.passengerInfo}>
                    <Text style={styles.passengerName}>
                      {passenger.riderName || `Passenger ${index + 1}`}
                    </Text>
                    <Text style={styles.passengerSeats}>
                      {passenger.numberOfSeats || 1} seat{(passenger.numberOfSeats || 1) !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>
                <Text style={styles.passengerPickup} numberOfLines={1}>
                  {passenger.pickupAddress}
                </Text>
                {passenger.riderPhone && (
                  <View style={styles.passengerActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => {
                        if (!passenger.riderPhone) return;
                        const cleanPhone = passenger.riderPhone.replace(/\D/g, '');
                        const phoneUrl = Platform.OS === 'ios' ? `telprompt:${cleanPhone}` : `tel:${cleanPhone}`;
                        Linking.canOpenURL(phoneUrl)
                          .then((supported) => {
                            if (supported) {
                              return Linking.openURL(phoneUrl);
                            } else {
                              Alert.alert('Error', 'Unable to make phone call.');
                            }
                          })
                          .catch(() => {
                            Alert.alert('Error', 'Unable to make phone call.');
                          });
                      }}
                      activeOpacity={0.7}
                    >
                      <IconSymbol size={16} name="phone.fill" color="#4285F4" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => {
                        if (!passenger.riderPhone) return;
                        const cleanPhone = passenger.riderPhone.replace(/\D/g, '');
                        const smsUrl = `sms:${cleanPhone}`;
                        Linking.canOpenURL(smsUrl)
                          .then((supported) => {
                            if (supported) {
                              return Linking.openURL(smsUrl);
                            } else {
                              Alert.alert('Error', 'Unable to open messaging app');
                            }
                          })
                          .catch(() => {
                            Alert.alert('Error', 'Unable to open messaging app');
                          });
                      }}
                      activeOpacity={0.7}
                    >
                      <IconSymbol size={16} name="message.fill" color="#4285F4" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  earningsCard: {
    backgroundColor: "#0F0F0F",
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  earningsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  earningsLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  earningsAmount: {
    fontSize: 42,
    fontWeight: "800",
    color: "#34C759",
    letterSpacing: -1,
    marginBottom: 8,
  },
  earningsInfo: {
    marginTop: 4,
  },
  earningsInfoText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666666",
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
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#0F0F0F",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#666666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  routeCard: {
    backgroundColor: "#0F0F0F",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  routeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(66, 133, 244, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  routeIconPassenger: {
    backgroundColor: "rgba(52, 199, 89, 0.15)",
  },
  routeIconDest: {
    backgroundColor: "rgba(255, 59, 48, 0.15)",
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
    fontWeight: "600",
    color: "#FFFFFF",
    lineHeight: 20,
    marginBottom: 2,
  },
  routeCity: {
    fontSize: 13,
    fontWeight: "400",
    color: "#999999",
  },
  routeDivider: {
    height: 1,
    backgroundColor: "#2A2A2A",
    marginVertical: 16,
    marginLeft: 44,
  },
  mapContainer: {
    height: 220,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: "center",
  },
  pickupMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#4285F4",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  passengerMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#34C759",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  destinationMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  infoCard: {
    backgroundColor: "#0F0F0F",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2A2A2A",
    gap: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#999999",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "right",
    flex: 1,
  },
  passengerCard: {
    backgroundColor: "#0F0F0F",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  passengerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  passengerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(66, 133, 244, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  passengerSeats: {
    fontSize: 13,
    fontWeight: "500",
    color: "#666666",
  },
  passengerPickup: {
    fontSize: 14,
    fontWeight: "400",
    color: "#999999",
    marginBottom: 12,
  },
  passengerActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1A1A1A",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#999999",
    marginTop: 16,
  },
});
