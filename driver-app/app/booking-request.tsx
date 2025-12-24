import React, { useState, useEffect, useRef } from "react";
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
  TextInput,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from "react-native-maps";
import { useUser } from "@/context/UserContext";
import {
  acceptBooking,
  rejectBooking,
  markNotificationRead,
  type Notification,
} from "@/services/api";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LoadingScreen } from "@/components/LoadingScreen";
import { HapticFeedback } from "@/utils/haptics";

export default function BookingRequestScreen(): React.JSX.Element {
  const params = useLocalSearchParams();
  const { user } = useUser();
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (params.notification) {
      try {
        const notificationData = JSON.parse(params.notification as string);
        setNotification(notificationData);
        
        // Mark as read when opened
        if (notificationData.unread && user?.id) {
          const driverId = user.id; // user.id is now guaranteed to be a number in UserContext
          markNotificationRead(notificationData.id, driverId).catch((error) => {
          });
        }
      } catch (error) {
        Alert.alert("Error", "Invalid notification data");
        router.back();
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [params.notification, user]);

  // Decode polyline from Google Directions API
  const decodePolyline = (encoded: string): { latitude: number; longitude: number }[] => {
    const points: { latitude: number; longitude: number }[] = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b: number;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  };

  // Fetch route from Google Directions API
  const fetchRoute = async () => {
    if (!notification?.booking?.ride || !notification.booking.ride.fromLatitude || !notification.booking.ride.fromLongitude || !notification.booking.ride.toLatitude || !notification.booking.ride.toLongitude) {
      return;
    }

    try {
      const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';
      if (!GOOGLE_API_KEY) {
        // Fallback to straight line if no API key
        const fromCoords = {
          latitude: notification.booking.ride.fromLatitude,
          longitude: notification.booking.ride.fromLongitude,
        };
        const toCoords = {
          latitude: notification.booking.ride.toLatitude,
          longitude: notification.booking.ride.toLongitude,
        };
        setRouteCoordinates([fromCoords, toCoords]);
        calculateMapRegion();
        return;
      }

      const origin = `${notification.booking.ride.fromLatitude},${notification.booking.ride.fromLongitude}`;
      const destination = `${notification.booking.ride.toLatitude},${notification.booking.ride.toLongitude}`;
      
      // Include pickup location as waypoint if available
      let waypoints = '';
      if (notification.booking.pickupLatitude && notification.booking.pickupLongitude) {
        waypoints = `&waypoints=${notification.booking.pickupLatitude},${notification.booking.pickupLongitude}`;
      }

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}${waypoints}&key=${GOOGLE_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        let allPoints: { latitude: number; longitude: number }[] = [];

        // Extract all points from route steps
        if (route.legs && route.legs.length > 0) {
          route.legs.forEach((leg: any) => {
            if (leg.steps) {
              leg.steps.forEach((step: any) => {
                if (step.polyline && step.polyline.points) {
                  const stepPoints = decodePolyline(step.polyline.points);
                  allPoints = allPoints.concat(stepPoints);
                }
              });
            }
          });
        }

        // If we couldn't get detailed steps, use overview polyline
        if (allPoints.length === 0 && route.overview_polyline && route.overview_polyline.points) {
          allPoints = decodePolyline(route.overview_polyline.points);
        }

        setRouteCoordinates(allPoints.length > 0 ? allPoints : []);
        calculateMapRegion();
      } else {
        // Fallback to straight line
        const fromCoords = {
          latitude: notification.booking.ride.fromLatitude,
          longitude: notification.booking.ride.fromLongitude,
        };
        const toCoords = {
          latitude: notification.booking.ride.toLatitude,
          longitude: notification.booking.ride.toLongitude,
        };
        setRouteCoordinates([fromCoords, toCoords]);
        calculateMapRegion();
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      // Fallback to straight line on error
      if (notification?.booking?.ride) {
        const fromCoords = {
          latitude: notification.booking.ride.fromLatitude!,
          longitude: notification.booking.ride.fromLongitude!,
        };
        const toCoords = {
          latitude: notification.booking.ride.toLatitude!,
          longitude: notification.booking.ride.toLongitude!,
        };
        setRouteCoordinates([fromCoords, toCoords]);
        calculateMapRegion();
      }
    }
  };

  // Calculate map region to show all markers
  const calculateMapRegion = () => {
    if (!notification?.booking?.ride) return;

    const coords: { latitude: number; longitude: number }[] = [];

    // Add driver route coordinates
    if (notification.booking.ride.fromLatitude && notification.booking.ride.fromLongitude) {
      coords.push({
        latitude: notification.booking.ride.fromLatitude,
        longitude: notification.booking.ride.fromLongitude,
      });
    }
    if (notification.booking.ride.toLatitude && notification.booking.ride.toLongitude) {
      coords.push({
        latitude: notification.booking.ride.toLatitude,
        longitude: notification.booking.ride.toLongitude,
      });
    }

    // Add rider pickup coordinates
    if (notification.booking.pickupLatitude && notification.booking.pickupLongitude) {
      coords.push({
        latitude: notification.booking.pickupLatitude,
        longitude: notification.booking.pickupLongitude,
      });
    }

    if (coords.length === 0) return;

    const minLat = Math.min(...coords.map(c => c.latitude));
    const maxLat = Math.max(...coords.map(c => c.latitude));
    const minLng = Math.min(...coords.map(c => c.longitude));
    const maxLng = Math.max(...coords.map(c => c.longitude));

    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    const latDelta = (maxLat - minLat) * 1.5; // Add 50% padding
    const lngDelta = (maxLng - minLng) * 1.5;

    setMapRegion({
      latitude: midLat,
      longitude: midLng,
      latitudeDelta: Math.max(latDelta, 0.05),
      longitudeDelta: Math.max(lngDelta, 0.05),
    });
  };

  // Fetch route when notification data is available
  useEffect(() => {
    if (notification?.booking?.ride) {
      fetchRoute();
    }
  }, [notification]);

  const formatDate = (dateStr: string, timeStr: string): string => {
    try {
      // Check if dateStr is already an ISO string
      if (dateStr.includes("T") || dateStr.includes("Z")) {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      }
      
      // Parse MM/DD/YYYY format
      const dateParts = dateStr.split("/").map(Number);
      if (dateParts.length !== 3) {
        // Try to parse as-is if it's not in expected format
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          });
        }
        return dateStr;
      }
      
      const [month, day, year] = dateParts;
      if (!month || !day || !year) return dateStr;
      
      // Parse time with AM/PM
      const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!timeMatch || !timeMatch[1] || !timeMatch[2] || !timeMatch[3]) {
        // If time parsing fails, just format the date
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      }
      
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const meridiem = timeMatch[3].toUpperCase();
      
      // Convert to 24-hour format
      if (meridiem === "PM" && hours !== 12) hours += 12;
      if (meridiem === "AM" && hours === 12) hours = 0;
      
      const date = new Date(year, month - 1, day, hours, minutes);
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch (error) {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string): string => {
    try {
      // Return time as-is if it's already formatted
      return timeStr;
    } catch {
      return "Invalid time";
    }
  };

  const handleCallRider = () => {
    if (!notification?.booking?.rider.phoneNumber) return;
    const phoneNumber = notification.booking.rider.phoneNumber.replace(/\D/g, "");
    if (!phoneNumber || phoneNumber.length === 0) {
      Alert.alert("Error", "Invalid phone number");
      return;
    }
    const url = Platform.OS === "ios" ? `telprompt:${phoneNumber}` : `tel:${phoneNumber}`;
    Linking.openURL(url).catch((err) => {
      Alert.alert("Error", "Unable to make phone call");
    });
  };

  const handleMessageRider = () => {
    if (!notification?.booking?.rider.phoneNumber) return;
    const phoneNumber = notification.booking.rider.phoneNumber.replace(/\D/g, "");
    if (!phoneNumber || phoneNumber.length === 0) {
      Alert.alert("Error", "Invalid phone number");
      return;
    }
    const url = `sms:${phoneNumber}`;
    Linking.openURL(url).catch((err) => {
      Alert.alert("Error", "Unable to open messages");
    });
  };

  const handleAccept = async () => {
    if (!notification?.booking || !user?.id) {
      Alert.alert("Error", "Unable to accept booking. Please try again.");
      return;
    }

    // Check if booking is still pending
    if (notification.booking.status !== "pending") {
      Alert.alert(
        "Already Processed",
        "This booking request has already been processed."
      );
      return;
    }

    Alert.alert(
      "Accept Request",
      `Accept ${notification.booking.rider.fullName}'s request for ${notification.booking.numberOfSeats} seat${notification.booking.numberOfSeats !== 1 ? "s" : ""}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Accept",
          onPress: async () => {
            setIsProcessing(true);
            HapticFeedback.action();
            
            // Optimistic update: Update UI immediately
            if (notification) {
              setNotification({
                ...notification,
                booking: notification.booking ? {
                  ...notification.booking,
                  status: 'confirmed',
                } : null,
              });
            }
            
            try {
              const driverId = user.id; // user.id is now guaranteed to be a number in UserContext
              await acceptBooking(notification.booking!.id, driverId);
              
              HapticFeedback.success();
              Alert.alert(
                "Success",
                "Booking request accepted!",
                [
                  {
                    text: "OK",
                    onPress: () => router.back(),
                  },
                ]
              );
            } catch (error: unknown) {
              // Revert optimistic update on error
              if (notification) {
                setNotification({
                  ...notification,
                  booking: notification.booking ? {
                    ...notification.booking,
                    status: 'pending',
                  } : null,
                });
              }
              
              const errorMessage = error instanceof Error ? error.message : "Failed to accept booking request";
              HapticFeedback.error();
              Alert.alert("Error", errorMessage);
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = () => {
    if (!notification?.booking || !user?.id) {
      Alert.alert("Error", "Unable to reject booking. Please try again.");
      return;
    }

    // Check if booking is still pending
    if (notification.booking.status !== "pending") {
      Alert.alert(
        "Already Processed",
        "This booking request has already been processed."
      );
      return;
    }

    // Show modal to enter rejection reason
    setShowRejectionModal(true);
  };

  const handleConfirmReject = async () => {
    if (!notification?.booking || !user?.id) {
      Alert.alert("Error", "Unable to reject booking. Please try again.");
      return;
    }

    setShowRejectionModal(false);
    setIsProcessing(true);
    HapticFeedback.action();
    
    // Optimistic update: Update UI immediately
    if (notification) {
      setNotification({
        ...notification,
        booking: notification.booking ? {
          ...notification.booking,
          status: 'rejected',
        } : null,
      });
    }
    
    try {
      const driverId = user.id; // user.id is now guaranteed to be a number in UserContext
      await rejectBooking(notification.booking!.id, driverId, rejectionReason.trim() || undefined);
      
      HapticFeedback.tap();
      Alert.alert(
        "Request Rejected",
        "The booking request has been rejected.",
        [
          {
            text: "OK",
            onPress: () => {
              setRejectionReason(""); // Clear reason for next time
              router.back();
            },
          },
        ]
      );
    } catch (error: unknown) {
      // Revert optimistic update on error
      if (notification) {
        setNotification({
          ...notification,
          booking: notification.booking ? {
            ...notification.booking,
            status: 'pending',
          } : null,
        });
      }
      
      const errorMessage = error instanceof Error ? error.message : "Failed to reject booking request";
      HapticFeedback.error();
      Alert.alert("Error", errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen message="Loading booking details..." />;
  }

  if (!notification || !notification.booking) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Booking request not found</Text>
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

  const booking = notification.booking;
  const isPending = booking.status === "pending";
  const isConfirmed = booking.status === "confirmed";
  const isRejected = booking.status === "rejected";

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
        <Text style={styles.headerTitle}>Booking Request</Text>
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
                  isRejected
                    ? "#FF3B3020"
                    : isConfirmed
                    ? "#34C75920"
                    : "#FF950020",
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isRejected
                    ? "#FF3B30"
                    : isConfirmed
                    ? "#34C759"
                    : "#FF9500",
                },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                {
                  color: isRejected
                    ? "#FF3B30"
                    : isConfirmed
                    ? "#34C759"
                    : "#FF9500",
                },
              ]}
            >
              {isRejected
                ? "Rejected"
                : isConfirmed
                ? "Accepted"
                : "Pending"}
            </Text>
          </View>
          <Text style={styles.confirmationNumber}>
            {booking.confirmationNumber}
          </Text>
        </View>

        {/* Route Preview Map */}
        {booking.ride.fromLatitude && booking.ride.fromLongitude && mapRegion && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Route Preview</Text>
            <View style={styles.mapContainer}>
              <MapView
                ref={mapRef}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                style={styles.map}
                initialRegion={mapRegion}
                scrollEnabled={true}
                zoomEnabled={true}
                showsUserLocation={false}
                showsMyLocationButton={false}
              >
                {/* Driver Route Polyline */}
                {routeCoordinates.length > 0 && (
                  <Polyline
                    coordinates={routeCoordinates}
                    strokeColor="#4285F4"
                    strokeWidth={5}
                    lineCap="round"
                    lineJoin="round"
                    geodesic={true}
                  />
                )}

                {/* Driver Starting Point */}
                {booking.ride.fromLatitude && booking.ride.fromLongitude && (
                  <Marker
                    coordinate={{
                      latitude: booking.ride.fromLatitude,
                      longitude: booking.ride.fromLongitude,
                    }}
                    title="Your Starting Point"
                    description={booking.ride.fromAddress}
                    pinColor="#34C759"
                  />
                )}

                {/* Rider Pickup Location */}
                {booking.pickupLatitude && booking.pickupLongitude && (
                  <Marker
                    coordinate={{
                      latitude: booking.pickupLatitude,
                      longitude: booking.pickupLongitude,
                    }}
                    title="Rider Pickup"
                    description={booking.pickupAddress}
                    pinColor="#FF9500"
                  />
                )}

                {/* Driver Destination */}
                {booking.ride.toLatitude && booking.ride.toLongitude && (
                  <Marker
                    coordinate={{
                      latitude: booking.ride.toLatitude,
                      longitude: booking.ride.toLongitude,
                    }}
                    title="Your Destination"
                    description={booking.ride.toAddress}
                    pinColor="#FF3B30"
                  />
                )}
              </MapView>
            </View>
          </View>
        )}

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
                  {formatDate(booking.ride.departureDate, booking.ride.departureTime)}
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
              <IconSymbol name="person.2.fill" size={18} color="#999999" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Seats Requested</Text>
                <Text style={styles.detailValue}>
                  {booking.numberOfSeats} seat
                  {booking.numberOfSeats !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Pricing Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pricing</Text>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingLabel}>
              ${booking.ride.pricePerSeat ? booking.ride.pricePerSeat.toFixed(2) : '0.00'} × {booking.numberOfSeats}{" "}
              seat
              {booking.numberOfSeats !== 1 ? "s" : ""}
            </Text>
            <Text style={styles.pricingValue}>
              ${((booking.ride.pricePerSeat || 0) * booking.numberOfSeats).toFixed(2)}
            </Text>
          </View>
          <View style={styles.pricingDivider} />
          <View style={styles.pricingRow}>
            <Text style={styles.pricingTotalLabel}>Total</Text>
            <Text style={styles.pricingTotalValue}>
              ${((booking.ride.pricePerSeat || 0) * booking.numberOfSeats).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Rider Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Rider Information</Text>
          <View style={styles.riderSection}>
            <View style={styles.riderAvatar}>
              <Text style={styles.riderAvatarText}>
                {booking.rider.fullName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.riderInfo}>
              <Text style={styles.riderName}>{booking.rider.fullName}</Text>
              <Text style={styles.riderEmail}>{booking.rider.email}</Text>
            </View>
          </View>
          {isPending && (
            <View style={styles.contactButtons}>
              <TouchableOpacity
                style={[styles.contactButton, styles.callButton]}
                onPress={handleCallRider}
                activeOpacity={0.8}
              >
                <IconSymbol name="phone.fill" size={18} color="#FFFFFF" />
                <Text style={styles.contactButtonText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactButton, styles.messageButton]}
                onPress={handleMessageRider}
                activeOpacity={0.8}
              >
                <IconSymbol name="message.fill" size={18} color="#FFFFFF" />
                <Text style={styles.contactButtonText}>Message</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      {isPending && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.rejectButton, isProcessing && styles.buttonDisabled]}
            onPress={handleReject}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol name="xmark.circle.fill" size={20} color="#FFFFFF" />
                <Text style={styles.rejectButtonText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptButton, isProcessing && styles.buttonDisabled]}
            onPress={handleAccept}
            disabled={isProcessing}
            activeOpacity={0.8}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol name="checkmark" size={20} color="#FFFFFF" />
                <Text style={styles.acceptButtonText}>Accept</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Rejection Reason Modal */}
      <Modal
        visible={showRejectionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRejectionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reject Booking Request</Text>
            <Text style={styles.modalSubtitle}>
              Please provide a reason for rejecting this booking (optional but recommended)
            </Text>
            
            <TextInput
              style={styles.reasonInput}
              placeholder="Enter rejection reason..."
              placeholderTextColor="#999"
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={styles.charCount}>
              {rejectionReason.length}/500 characters
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowRejectionModal(false);
                  setRejectionReason("");
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.rejectButtonModal]}
                onPress={handleConfirmReject}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.rejectButtonTextModal}>Reject</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    borderRadius: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
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
  riderSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  riderAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#4285F4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  riderAvatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  riderInfo: {
    flex: 1,
  },
  riderName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  riderEmail: {
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
  routeSection: {
    gap: 8,
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
  footer: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: "#000000",
    borderTopWidth: 1,
    borderTopColor: "#1A1A1A",
    flexDirection: "row",
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#34C759",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF3B30",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4285F4",
  },
  mapContainer: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 12,
  },
  map: {
    width: "100%",
    height: 300,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#1C1C1E",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#999999",
    marginBottom: 20,
    lineHeight: 20,
  },
  reasonInput: {
    backgroundColor: "#2C2C2E",
    borderRadius: 12,
    padding: 16,
    color: "#FFFFFF",
    fontSize: 16,
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#3A3A3C",
    marginBottom: 8,
  },
  charCount: {
    fontSize: 12,
    color: "#666666",
    textAlign: "right",
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#2C2C2E",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  rejectButtonModal: {
    backgroundColor: "#FF3B30",
  },
  rejectButtonTextModal: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

