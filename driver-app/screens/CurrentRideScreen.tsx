import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  TouchableOpacity,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import MapView, { Region } from "react-native-maps";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  cancelRide,
  startRide,
  completeRide,
  markPassengerPickedUp,
  type ApiError,
} from "@/services/api";
import { useUser } from "@/context/UserContext";
import { calculateDistance as calculateDistanceMiles, calculateDistanceMeters } from "@/utils/distance";

// Import new components
import {
  RideMap,
  PassengerList,
  RideInfoCard,
  RideActions,
  PINModal,
} from "@/components/current-ride";

// Import custom hooks
import { useRideLocation } from "@/hooks/useRideLocation";
import { useRideData } from "@/hooks/useRideData";

interface LocationCoords {
  latitude: number;
  longitude: number;
}

export default function CurrentRideScreen(): React.JSX.Element {
  const params = useLocalSearchParams();
  const { user } = useUser();
  const mapRef = useRef<MapView>(null);

  // Helper function to safely navigate back or to home
  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, []);

  // Parse IDs
  const rideId = params.rideId ? parseInt(params.rideId as string) : null;
  const driverId = user?.id
    ? typeof user.id === "string"
      ? parseInt(user.id)
      : user.id
    : null;

  // USE CUSTOM HOOKS (replaces 500+ lines of logic)
  const { rideData, isLoading, error, refreshRide } = useRideData({
    rideId,
    driverId,
    autoRefresh: true,
    refreshInterval: 30000,
  });

  const { location, locationError, isWatching } = useRideLocation({
    driverId,
    rideId,
    isActive: rideData?.status === "in-progress",
  });

  // Local state for modals/UI
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(
    null
  );
  const [selectedPassengerName, setSelectedPassengerName] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);

  // Decode Google polyline to coordinates
  const decodePolyline = (
    encoded: string
  ): { latitude: number; longitude: number }[] => {
    const points: { latitude: number; longitude: number }[] = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
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

  // Fetch actual route from Google Directions API
  const fetchRoute = useCallback(async () => {
    if (!rideData) return;
      // Build waypoints (pickups in order)
      const waypoints: { latitude: number; longitude: number }[] = [];

      (rideData.passengers || []).forEach((passenger) => {
        if (passenger.pickupLatitude && passenger.pickupLongitude) {
          waypoints.push({
            latitude: passenger.pickupLatitude,
            longitude: passenger.pickupLongitude,
          });
        }
      });

      if (
        !rideData.fromLatitude ||
        !rideData.fromLongitude ||
        !rideData.toLatitude ||
        !rideData.toLongitude
      ) {
        return;
      }

      const origin = `${rideData.fromLatitude},${rideData.fromLongitude}`;
      const destination = `${rideData.toLatitude},${rideData.toLongitude}`;

      try {
        const GOOGLE_API_KEY =
          process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || "";

        if (!GOOGLE_API_KEY) {
          // Fallback to straight lines
          const points: { latitude: number; longitude: number }[] = [];
          points.push({
            latitude: rideData.fromLatitude,
            longitude: rideData.fromLongitude,
          });
          waypoints.forEach((wp) => points.push(wp));
          points.push({
            latitude: rideData.toLatitude,
            longitude: rideData.toLongitude,
          });
          setRouteCoordinates(points);
          return;
        }

        // Build waypoints string for API
        const waypointsStr = waypoints
          .map((w) => `${w.latitude},${w.longitude}`)
          .join("|");

        let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=driving&key=${GOOGLE_API_KEY}`;

        if (waypointsStr) {
          url += `&waypoints=${waypointsStr}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.status === "OK" && data.routes.length > 0) {
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
          if (
            allPoints.length === 0 &&
            route.overview_polyline &&
            route.overview_polyline.points
          ) {
            allPoints = decodePolyline(route.overview_polyline.points);
          }

          setRouteCoordinates(
            allPoints.length > 0
              ? allPoints
              : [
                  {
                    latitude: rideData.fromLatitude,
                    longitude: rideData.fromLongitude,
                  },
                  ...waypoints,
                  {
                    latitude: rideData.toLatitude,
                    longitude: rideData.toLongitude,
                  },
                ]
          );
        } else {
          // Fallback to straight lines
          const points: { latitude: number; longitude: number }[] = [];
          points.push({
            latitude: rideData.fromLatitude,
            longitude: rideData.fromLongitude,
          });
          waypoints.forEach((wp) => points.push(wp));
          points.push({
            latitude: rideData.toLatitude,
            longitude: rideData.toLongitude,
          });
          setRouteCoordinates(points);
        }
      } catch (error) {
        // Fallback to straight lines
        const points: { latitude: number; longitude: number }[] = [];
        points.push({
          latitude: rideData.fromLatitude,
          longitude: rideData.fromLongitude,
        });
        waypoints.forEach((wp) => points.push(wp));
        points.push({
          latitude: rideData.toLatitude,
          longitude: rideData.toLongitude,
        });
        setRouteCoordinates(points);
      }
  }, [rideData]);

  useEffect(() => {
    fetchRoute();
  }, [fetchRoute]);

  // Fit map to show all markers
  useEffect(() => {
    if (!mapRef.current || !rideData) return;

    const coordinates: LocationCoords[] = [];

    // Add driver location
    if (location) {
      coordinates.push(location);
    }

    // Add from location
    if (rideData.fromLatitude && rideData.fromLongitude) {
      coordinates.push({
        latitude: rideData.fromLatitude,
        longitude: rideData.fromLongitude,
      });
    }

    // Add to location
    if (rideData.toLatitude && rideData.toLongitude) {
      coordinates.push({
        latitude: rideData.toLatitude,
        longitude: rideData.toLongitude,
      });
    }

    // Add pickup locations
    (rideData.passengers || []).forEach((p) => {
      if (p.pickupLatitude && p.pickupLongitude) {
        coordinates.push({
          latitude: p.pickupLatitude,
          longitude: p.pickupLongitude,
        });
      }
    });

    if (coordinates.length > 0) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [location, rideData]);

  // Event handlers
  const handleStartRide = async () => {
    if (!rideId) {
      Alert.alert("Error", "Ride ID not found");
      return;
    }

    if (!driverId) {
      Alert.alert("Error", "Driver ID not found. Please log in again.");
      return;
    }

    Alert.alert("Start Ride", "Are you ready to start this ride?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Start",
        onPress: async () => {
          try {
            await startRide(rideId, driverId);
            await refreshRide();
            Alert.alert("Success", "Ride started successfully!");
          } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to start ride");
          }
        },
      },
    ]);
  };

  const handleCompleteRide = async () => {
    if (!rideId) {
      Alert.alert("Error", "Ride ID not found");
      return;
    }

    if (!driverId) {
      Alert.alert("Error", "Driver ID not found. Please log in again.");
      return;
    }

    // Check if location is available
    if (!location) {
      Alert.alert(
        "Location Required",
        "Please enable location services to complete the ride. We need to verify you've reached the destination."
      );
      return;
    }

    // Check if ride data is available
    if (!rideData || !rideData.toLatitude || !rideData.toLongitude) {
      Alert.alert(
        "Error",
        "Unable to verify destination location. Please try again."
      );
      return;
    }

    // Calculate distance from destination (in meters)
    const distanceToDestination = calculateDistanceMeters(
      location.latitude,
      location.longitude,
      rideData.toLatitude,
      rideData.toLongitude
    );

    // Note: Frontend validation removed - backend handles validation and test mode bypass
    // In test mode, backend will bypass location validation automatically

    // Show confirmation with distance info
    const distanceInFeet = Math.round(distanceToDestination * 3.28084);
    const distanceMessage = `You are ${Math.round(distanceToDestination)} meters (${distanceInFeet} feet) from the destination.\n\nMark this ride as completed?`;
    
    Alert.alert(
      "Complete Ride",
      distanceMessage,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: async () => {
            try {
              await completeRide(
                rideId,
                driverId,
                location.latitude,
                location.longitude
              );
              Alert.alert("Success", "Ride completed! Great job!", [
                { text: "OK", onPress: handleGoBack },
              ]);
            } catch (error: any) {
              Alert.alert(
                "Cannot Complete Ride",
                error.message || "Failed to complete ride"
              );
            }
          },
        },
      ]
    );
  };

  const handleCancelRide = async () => {
    if (!rideId) {
      Alert.alert("Error", "Ride ID not found");
      return;
    }

    if (!driverId) {
      Alert.alert("Error", "Driver ID not found. Please log in again.");
      return;
    }

    Alert.alert(
      "Cancel Ride",
      "Are you sure you want to cancel this ride? This action cannot be undone.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelRide(rideId, driverId);
              Alert.alert("Cancelled", "Ride has been cancelled.", [
                { text: "OK", onPress: handleGoBack },
              ]);
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to cancel ride");
            }
          },
        },
      ]
    );
  };

  const handleArrivedAtPickup = (bookingId: number, passengerName: string) => {
    setSelectedBookingId(bookingId);
    setSelectedPassengerName(passengerName);
    setPinModalVisible(true);
  };

  const handleVerifyPin = async (pin: string) => {
    if (!selectedBookingId || !user?.id) return;

    setIsVerifyingPin(true);
    try {
      const driverId = user.id; // user.id is now guaranteed to be a number in UserContext
      await markPassengerPickedUp(selectedBookingId, driverId, pin);
      await refreshRide();
      setPinModalVisible(false);
      setSelectedBookingId(null);
      Alert.alert("Success", `${selectedPassengerName} has been picked up!`);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Invalid PIN. Please try again.");
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleOpenNavigation = () => {
    if (!rideData) return;

    // Get current location for calculating closest pickup
    const currentLocation = location || {
      latitude: rideData.fromLatitude || 0,
      longitude: rideData.fromLongitude || 0,
    };

    // Find all pending pickups
    const pendingPickups = (rideData.passengers || []).filter(
      (p) =>
        p.pickupStatus !== "picked_up" && p.pickupLatitude && p.pickupLongitude
    );

    let destination: LocationCoords | null = null;
    let destinationAddress = "";

    if (pendingPickups.length > 0) {
      // Find CLOSEST pending pickup
      const pickupsWithDistance = pendingPickups.map((p) => ({
        passenger: p,
        distance: calculateDistanceMiles(
          currentLocation.latitude,
          currentLocation.longitude,
          p.pickupLatitude!,
          p.pickupLongitude!
        ),
      }));

      // Sort by distance (closest first)
      pickupsWithDistance.sort((a, b) => a.distance - b.distance);
      const closest = pickupsWithDistance[0];

      destination = {
        latitude: closest.passenger.pickupLatitude!,
        longitude: closest.passenger.pickupLongitude!,
      };
      destinationAddress = closest.passenger.pickupAddress;
    } else if (rideData.toLatitude && rideData.toLongitude) {
      // All picked up, navigate to final destination
      destination = {
        latitude: rideData.toLatitude,
        longitude: rideData.toLongitude,
      };
      destinationAddress = rideData.toAddress;
    }

    if (!destination) {
      Alert.alert("Error", "No destination available for navigation");
      return;
    }

    const lat = destination.latitude;
    const lng = destination.longitude;

    // Google Maps URLs for both platforms - START navigation directly
    let navigationUrl: string;

    if (Platform.OS === "ios") {
      // iOS Google Maps - STARTS navigation directly with navigate parameter
      navigationUrl = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving&navigate=yes`;
    } else {
      // Android Google Maps - STARTS navigation directly
      navigationUrl = `google.navigation:q=${lat},${lng}`;
    }

    // Launch Google Maps navigation NOW
    Linking.openURL(navigationUrl).catch((error) => {

      // Fallback to Apple Maps navigation on iOS, web on Android
      if (Platform.OS === "ios") {
        const appleMapsUrl = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;

        Linking.openURL(appleMapsUrl).catch(() => {
          Alert.alert(
            "Navigation Error",
            "Unable to open navigation. Please install Google Maps."
          );
        });
      } else {
        // Android fallback - try web Google Maps with dir_action=navigate
        const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&dir_action=navigate`;

        Linking.openURL(webUrl).catch(() => {
          Alert.alert(
            "Navigation Error",
            "Please install Google Maps for turn-by-turn navigation."
          );
        });
      }
    });
  };

  const areAllPassengersPickedUp = (): boolean => {
    if (!rideData?.passengers || rideData.passengers.length === 0) return true;
    return rideData.passengers.every((p) => p.pickupStatus === "picked_up");
  };

  const calculateRegion = (): Region | null => {
    if (!rideData) return null;

    const coords: LocationCoords[] = [];

    // Add driver's current location
    if (location) {
      coords.push(location);
    }

    // Add origin
    if (rideData.fromLatitude && rideData.fromLongitude) {
      coords.push({
        latitude: rideData.fromLatitude,
        longitude: rideData.fromLongitude,
      });
    }

    // Add all passenger pickup locations
    (rideData.passengers || []).forEach((p) => {
      if (p.pickupLatitude && p.pickupLongitude) {
        coords.push({
          latitude: p.pickupLatitude,
          longitude: p.pickupLongitude,
        });
      }
    });

    // Add destination
    if (rideData.toLatitude && rideData.toLongitude) {
      coords.push({
        latitude: rideData.toLatitude,
        longitude: rideData.toLongitude,
      });
    }

    if (coords.length === 0) {
      return null;
    }

    const lats = coords.map((c) => c.latitude);
    const lngs = coords.map((c) => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    const latDelta = (maxLat - minLat) * 1.5;
    const lngDelta = (maxLng - minLng) * 1.5;

    const region = {
      latitude: midLat,
      longitude: midLng,
      latitudeDelta: Math.max(latDelta, 0.05),
      longitudeDelta: Math.max(lngDelta, 0.05),
    };

    return region;
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !rideData) {
    // Show alert and go back
    Alert.alert("Error", error || "Ride not found", [
      { text: "Go Back", onPress: handleGoBack },
    ]);

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || "Ride not found"}</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleGoBack}
            activeOpacity={0.7}
          >
            <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // RENDER WITH COMPONENTS (replaces 2,400+ lines of JSX)
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleGoBack}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Current Ride</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.mapContainer}>
        <RideMap
          mapRef={mapRef}
          region={calculateRegion()}
          driverLocation={location}
          routeCoordinates={routeCoordinates}
          pickupMarkers={rideData.passengers || []}
          originLocation={
            rideData.fromLatitude && rideData.fromLongitude
              ? {
                  latitude: rideData.fromLatitude,
                  longitude: rideData.fromLongitude,
                }
              : null
          }
          originLabel={rideData.fromAddress || "Starting Point"}
          destinationLocation={
            rideData.toLatitude && rideData.toLongitude
              ? {
                  latitude: rideData.toLatitude,
                  longitude: rideData.toLongitude,
                }
              : null
          }
          destinationLabel={rideData.toAddress || "Destination"}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
      >
        <RideInfoCard
          fromAddress={rideData.fromAddress || ''}
          fromCity={rideData.fromCity || null}
          toAddress={rideData.toAddress || ''}
          toCity={rideData.toCity || null}
          departureDate={rideData.departureDate || ''}
          departureTime={rideData.departureTime || ''}
          totalSeats={rideData.totalSeats || 0}
          availableSeats={rideData.availableSeats || 0}
          distance={rideData.distance || null}
          pricePerSeat={rideData.pricePerSeat || null}
          status={rideData.status || 'scheduled'}
        />

        {rideData.passengers && rideData.passengers.length > 0 && (
          <PassengerList
            passengers={rideData.passengers}
            driverLocation={location}
            onArrivedAtPickup={handleArrivedAtPickup}
            calculateDistance={calculateDistanceMiles}
          />
        )}

        <RideActions
          rideStatus={rideData.status || 'scheduled'}
          allPassengersPickedUp={areAllPassengersPickedUp()}
          onStartRide={handleStartRide}
          onCompleteRide={handleCompleteRide}
          onCancelRide={handleCancelRide}
          onOpenNavigation={handleOpenNavigation}
        />
      </ScrollView>

      <PINModal
        visible={pinModalVisible}
        passengerName={selectedPassengerName}
        isVerifying={isVerifyingPin}
        onClose={() => setPinModalVisible(false)}
        onVerify={handleVerifyPin}
      />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#000000",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSpacer: {
    width: 40,
  },
  mapContainer: {
    height: 300,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#FF3B30",
    textAlign: "center",
    marginBottom: 20,
  },
});
