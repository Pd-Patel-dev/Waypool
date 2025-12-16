import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from "react-native-maps";
import { type Ride, getRideById, cancelRide } from "@/services/api";
import { useUser } from "@/context/UserContext";
import { Platform } from "react-native";
import { calculateTotalDistance } from "@/utils/distance";

export default function UpcomingRideDetailsScreen(): React.JSX.Element {
  const params = useLocalSearchParams();
  const { user } = useUser();
  const [rideData, setRideData] = useState<Ride | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

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
        console.error("Error fetching ride details:", error);
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
            <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ride Details</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
        </View>
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
            <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ride Details</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.emptyContainer}>
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
  const potentialEarnings = totalSeatsBooked * pricePerSeat;
  const passengerCount = rideData.passengers?.length || 0;

  const formatDateTime = (dateString: string, fallbackDate?: string, fallbackTime?: string): string => {
    try {
      let date: Date | null = null;
      
      // Try to parse as ISO string first
      if (dateString) {
        date = new Date(dateString);
        if (isNaN(date.getTime())) {
          date = null;
        }
      }
      
      // If that fails and we have fallback date/time, combine them
      if (!date && fallbackDate && fallbackTime) {
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
              
              date = new Date(year, month - 1, day, hours, minutes);
            }
          }
        } catch (e) {
          console.error("Error parsing fallback date:", e);
        }
      }
      
      // Format the date and time together
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
      
      // Last resort: combine fallback strings
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

  // Calculate total distance including all passenger pickups
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

  // Get status badge info
  const getStatusBadge = () => {
    if (rideData.status === 'in-progress') {
      return { text: 'IN PROGRESS', color: '#4285F4', bgColor: 'rgba(66, 133, 244, 0.15)' };
    }
    if (rideData.status === 'completed') {
      return { text: 'COMPLETED', color: '#34C759', bgColor: 'rgba(52, 199, 89, 0.15)' };
    }
    if (rideData.status === 'cancelled') {
      return { text: 'CANCELLED', color: '#FF3B30', bgColor: 'rgba(255, 59, 48, 0.15)' };
    }
    return { text: 'SCHEDULED', color: '#FFD60A', bgColor: 'rgba(255, 214, 10, 0.15)' };
  };

  const statusBadge = getStatusBadge();

  const handleCancelRide = () => {
    if (!rideData || !user?.id) return;

    const passengerCount = rideData.passengers?.length || 0;
    const hasConfirmedBookings = rideData.passengers?.some(
      (p) => p.status === "confirmed"
    );

    Alert.alert(
      "Cancel Ride",
      hasConfirmedBookings
        ? `This ride has ${passengerCount} confirmed booking${passengerCount !== 1 ? "s" : ""}. Cancelling will notify all passengers and refund their bookings. Are you sure you want to cancel?`
        : "Are you sure you want to cancel this ride?",
      [
        {
          text: "No",
          style: "cancel",
        },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              setIsCancelling(true);
              await cancelRide(rideData.id, user.id);
              Alert.alert("Success", "Ride cancelled successfully", [
                {
                  text: "OK",
                  onPress: () => router.back(),
                },
              ]);
            } catch (error: any) {
              console.error("Error cancelling ride:", error);
              Alert.alert(
                "Error",
                error.message || "Failed to cancel ride. Please try again."
              );
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

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
        <Text style={styles.headerTitle}>Ride Details</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Badge */}
        <View style={styles.statusSection}>
          <View style={[styles.statusBadge, { backgroundColor: statusBadge.bgColor }]}>
            <View style={[styles.statusDot, { backgroundColor: statusBadge.color }]} />
            <Text style={[styles.statusText, { color: statusBadge.color }]}>
              {statusBadge.text}
            </Text>
          </View>
        </View>

        {/* Potential Earnings Card - Only if passengers booked */}
        {totalSeatsBooked > 0 && (
          <View style={styles.earningsCard}>
            <Text style={styles.earningsLabel}>Potential Earnings</Text>
            <Text style={styles.earningsAmount}>${potentialEarnings.toFixed(2)}</Text>
            <View style={styles.earningsBreakdown}>
              <Text style={styles.earningsBreakdownText}>
                {totalSeatsBooked} seat{totalSeatsBooked !== 1 ? "s" : ""} × ${pricePerSeat.toFixed(2)} per seat
              </Text>
              {passengerCount > 0 && (
                <Text style={styles.earningsBreakdownText}>
                  ({passengerCount} passenger{passengerCount !== 1 ? "s" : ""})
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Recurring Ride Badge */}
        {rideData.isRecurring && (
          <View style={styles.recurringCard}>
            <View style={styles.recurringHeader}>
              <IconSymbol size={18} name="repeat" color="#4285F4" />
              <Text style={styles.recurringTitle}>Recurring Ride</Text>
            </View>
            <View style={styles.recurringContent}>
              <View style={styles.recurringRow}>
                <Text style={styles.recurringLabel}>Pattern:</Text>
                <Text style={styles.recurringValue}>
                  {rideData.recurringPattern === 'daily' ? 'Daily' : 
                   rideData.recurringPattern === 'weekly' ? 'Weekly' : 
                   rideData.recurringPattern === 'monthly' ? 'Monthly' : 'N/A'}
                </Text>
              </View>
              {rideData.recurringEndDate && (
                <View style={styles.recurringRow}>
                  <Text style={styles.recurringLabel}>Ends:</Text>
                  <Text style={styles.recurringValue}>
                    {new Date(rideData.recurringEndDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Date & Time */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <IconSymbol size={18} name="calendar" color="#4285F4" />
            <Text style={styles.sectionTitle}>Date & Time</Text>
          </View>
          <View style={styles.sectionContent}>
            <Text style={styles.dateTimeText}>
              {formatDateTime(rideData.departureTime || "", rideData.departureDate, rideData.departureTimeString)}
            </Text>
          </View>
        </View>

        {/* Route Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <IconSymbol size={18} name="mappin" color="#4285F4" />
            <Text style={styles.sectionTitle}>Route</Text>
          </View>
          <View style={styles.routeContainer}>
            <View style={styles.routePoint}>
              <View style={styles.routeMarker} />
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>FROM</Text>
                <Text style={styles.routeAddress}>{rideData.fromAddress}</Text>
                {rideData.fromCity && (
                  <Text style={styles.routeCity}>
                    {rideData.fromCity}, {rideData.fromState}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.routeLine} />

            {/* Passenger Pickups */}
            {rideData.passengers &&
              rideData.passengers.length > 0 &&
              rideData.passengers.map((passenger, index) => (
                <React.Fragment key={`passenger-${passenger.id || index}`}>
                  <View style={styles.routeLine} />
                  <View style={styles.routePoint}>
                    <View style={styles.passengerRouteMarker} />
                    <View style={styles.routeContent}>
                      <Text style={styles.routeLabel}>
                        PICKUP {index + 1}
                        {passenger.riderName ? ` • ${passenger.riderName}` : ""}
                      </Text>
                      <Text style={styles.routeAddress}>
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

            <View style={styles.routeLine} />

            <View style={styles.routePoint}>
              <View style={[styles.routeMarker, styles.routeMarkerDest]} />
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>TO</Text>
                <Text style={styles.routeAddress}>{rideData.toAddress}</Text>
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
            <View style={styles.sectionHeader}>
              <IconSymbol size={18} name="mappin" color="#4285F4" />
              <Text style={styles.sectionTitle}>Route Map</Text>
            </View>
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
                {/* Pickup marker */}
                {rideData.fromLatitude && rideData.fromLongitude && (
                  <Marker
                    coordinate={{
                      latitude: rideData.fromLatitude,
                      longitude: rideData.fromLongitude,
                    }}
                    title="Pickup"
                    description={rideData.fromAddress}
                  >
                    <View style={styles.markerContainer}>
                      <View style={styles.pickupMarker}>
                        <IconSymbol size={16} name="car" color="#FFFFFF" />
                      </View>
                    </View>
                  </Marker>
                )}

                {/* Passenger pickup markers */}
                {rideData.passengers &&
                  rideData.passengers.map((passenger, index) => {
                    if (!passenger.pickupLatitude || !passenger.pickupLongitude)
                      return null;
                    return (
                      <Marker
                        key={`passenger-${passenger.id || index}`}
                        coordinate={{
                          latitude: passenger.pickupLatitude,
                          longitude: passenger.pickupLongitude,
                        }}
                        title={`Passenger ${index + 1} Pickup`}
                        description={passenger.pickupAddress}
                      >
                        <View style={styles.markerContainer}>
                          <View style={styles.passengerMarker}>
                            <IconSymbol
                              size={14}
                              name="person.fill"
                              color="#FFFFFF"
                            />
                          </View>
                        </View>
                      </Marker>
                    );
                  })}

                {/* Destination marker */}
                {rideData.toLatitude && rideData.toLongitude && (
                  <Marker
                    coordinate={{
                      latitude: rideData.toLatitude,
                      longitude: rideData.toLongitude,
                    }}
                    title="Destination"
                    description={rideData.toAddress}
                  >
                    <View style={styles.markerContainer}>
                      <View style={styles.destinationMarker}>
                        <IconSymbol size={14} name="flag" color="#FFFFFF" />
                      </View>
                    </View>
                  </Marker>
                )}
              </MapView>
            </View>
          </View>
        )}

        {/* Trip Details */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <IconSymbol size={18} name="info.circle" color="#4285F4" />
            <Text style={styles.sectionTitle}>Trip Details</Text>
          </View>
          <View style={styles.sectionContent}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Available Seats</Text>
              <Text style={styles.detailValue}>
                {rideData.availableSeats} of {rideData.totalSeats}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Booked Seats</Text>
              <Text style={styles.detailValue}>
                {totalSeatsBooked} seat{totalSeatsBooked !== 1 ? "s" : ""}
              </Text>
            </View>
            {totalDistance > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total Distance</Text>
                <Text style={styles.detailValue}>
                  {totalDistance.toFixed(1)} mi
                </Text>
              </View>
            )}
            <View style={[styles.detailRow, styles.detailRowLast]}>
              <Text style={styles.detailLabel}>Price per Seat</Text>
              <Text style={styles.detailValue}>${pricePerSeat.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Passengers List */}
        {rideData.passengers && rideData.passengers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <IconSymbol size={18} name="person.2.fill" color="#4285F4" />
              <Text style={styles.sectionTitle}>
                Passengers ({rideData.passengers.length})
              </Text>
            </View>
            {rideData.passengers.map((passenger, index) => (
              <View key={`passenger-info-${passenger.id || index}`} style={styles.passengerCard}>
                <View style={styles.passengerInfo}>
                  <View style={styles.passengerHeader}>
                    <Text style={styles.passengerName}>
                      {passenger.riderName || `Passenger ${index + 1}`}
                    </Text>
                    {passenger.status === 'confirmed' && (
                      <View style={styles.confirmedBadge}>
                        <Text style={styles.confirmedText}>Confirmed</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.passengerPickup}>
                    Pickup: {passenger.pickupAddress}
                  </Text>
                  {passenger.numberOfSeats && passenger.numberOfSeats > 1 && (
                    <Text style={styles.passengerSeats}>
                      {passenger.numberOfSeats} seats booked
                    </Text>
                  )}
                  {passenger.confirmationNumber && (
                    <Text style={styles.confirmationNumber}>
                      Confirmation: {passenger.confirmationNumber}
                    </Text>
                  )}
                  {/* Call and Message Buttons */}
                  {passenger.riderPhone && (
                    <View style={styles.contactButtons}>
                      <TouchableOpacity
                        style={styles.callButton}
                        onPress={() => {
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
                            .catch((err) => {
                              console.error('Error opening phone:', err);
                              Alert.alert('Error', 'Unable to make phone call.');
                            });
                        }}
                        activeOpacity={0.7}
                      >
                        <IconSymbol size={16} name="phone.fill" color="#4285F4" />
                        <Text style={styles.contactButtonText}>Call</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.messageButton}
                        onPress={() => {
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
                            .catch((err) => {
                              console.error('Error opening SMS:', err);
                              Alert.alert('Error', 'Unable to open messaging app');
                            });
                        }}
                        activeOpacity={0.7}
                      >
                        <IconSymbol size={16} name="message.fill" color="#4285F4" />
                        <Text style={styles.messageButtonText}>Message</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Empty State for No Passengers */}
        {(!rideData.passengers || rideData.passengers.length === 0) && (
          <View style={styles.emptyPassengersSection}>
            <IconSymbol size={48} name="person.2.fill" color="#666666" />
            <Text style={styles.emptyPassengersText}>No passengers yet</Text>
            <Text style={styles.emptyPassengersSubtext}>
              Passengers will appear here once they book a seat
            </Text>
          </View>
        )}

        {/* Cancel Ride Button - Only show for scheduled rides */}
        {rideData.status === "scheduled" && (
          <View style={styles.cancelButtonContainer}>
            <TouchableOpacity
              style={[styles.cancelButton, isCancelling && styles.cancelButtonDisabled]}
              onPress={handleCancelRide}
              disabled={isCancelling}
              activeOpacity={0.8}
            >
              {isCancelling ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <IconSymbol size={18} name="xmark.circle.fill" color="#FFFFFF" />
                  <Text style={styles.cancelButtonText}>Cancel Ride</Text>
                </>
              )}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  statusSection: {
    marginBottom: 20,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  earningsCard: {
    backgroundColor: "#0F0F0F",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    alignItems: "center",
  },
  earningsLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#999999",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  earningsAmount: {
    fontSize: 48,
    fontWeight: "800",
    color: "#FFD60A",
    marginBottom: 8,
    letterSpacing: -1,
  },
  earningsBreakdown: {
    marginTop: 8,
  },
  earningsBreakdownText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666666",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  sectionContent: {
    backgroundColor: "#0F0F0F",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1A1A1A",
  },
  dateTimeText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  routeContainer: {
    backgroundColor: "#0F0F0F",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1A1A1A",
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
  passengerRouteMarker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#34C759",
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
    marginBottom: 2,
  },
  routeCity: {
    fontSize: 13,
    fontWeight: "400",
    color: "#999999",
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: "#1A1A1A",
    marginLeft: 5,
    marginVertical: 4,
  },
  mapContainer: {
    height: 250,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1A1A1A",
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    alignItems: "center",
  },
  pickupMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#4285F4",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  passengerMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#34C759",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  destinationMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#999999",
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  passengerCard: {
    backgroundColor: "#0F0F0F",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1A1A1A",
  },
  passengerInfo: {
    flex: 1,
  },
  passengerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    flex: 1,
  },
  confirmedBadge: {
    backgroundColor: "rgba(52, 199, 89, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confirmedText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#34C759",
    textTransform: "uppercase",
  },
  passengerPickup: {
    fontSize: 13,
    fontWeight: "400",
    color: "#999999",
    marginBottom: 4,
  },
  passengerSeats: {
    fontSize: 12,
    fontWeight: "500",
    color: "#4285F4",
    marginBottom: 4,
  },
  confirmationNumber: {
    fontSize: 11,
    fontWeight: "400",
    color: "#666666",
    fontFamily: "monospace",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#999999",
  },
  emptyPassengersSection: {
    alignItems: "center",
    paddingVertical: 40,
    marginTop: 20,
  },
  emptyPassengersText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyPassengersSubtext: {
    fontSize: 14,
    fontWeight: "400",
    color: "#999999",
    textAlign: "center",
  },
  cancelButtonContainer: {
    marginTop: 24,
    marginBottom: 8,
  },
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FF3B30",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "#FF3B30",
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  contactButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    alignSelf: "flex-start",
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#1A1A1A",
  },
  messageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#1A1A1A",
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4285F4",
  },
  messageButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4285F4",
  },
});

