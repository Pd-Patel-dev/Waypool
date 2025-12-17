import React, { useState, useEffect } from 'react';
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
import { calculateDistance as calculateDistanceMiles } from "@/utils/distance";
import NetInfo from '@react-native-community/netinfo';

// Conditionally import Location only on native platforms
let Location: any = null;
if (Platform.OS !== 'web') {
  try {
    Location = require('expo-location');
  } catch (e) {
    console.warn('expo-location not available:', e);
  }
}

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface CurrentRide {
  id: number;
  fromAddress: string;
  toAddress: string;
  fromLatitude: number;
  fromLongitude: number;
  toLatitude: number;
  toLongitude: number;
  passengerName?: string;
  estimatedDuration?: string;
  distance?: number;
}

export default function CurrentRideScreen(): React.JSX.Element {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const mapRef = React.useRef<MapView>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [rideData, setRideData] = useState<Ride | null>(null);
  const [isLoadingRide, setIsLoadingRide] = useState(true);
  const [totalRouteDistance, setTotalRouteDistance] = useState<number | null>(
    null
  );
  const [routeProgress, setRouteProgress] = useState<number>(0); // Progress percentage (0-100)
  const [distanceCovered, setDistanceCovered] = useState<number>(0); // Distance covered in miles
  const hasFetchedRef = useRef(false); // Track if we've already fetched
  const appStateRef = useRef(AppState.currentState);
  const navigationOpenedRef = useRef(false); // Track if navigation was opened
  const locationWatchSubscriptionRef = useRef<any>(null); // Track location watch subscription
  const lastRouteUpdateRef = useRef<{ latitude: number; longitude: number } | null>(null);
  
  // Navigation state tracking
  const [currentDestination, setCurrentDestination] = useState<{
    type: "pickup" | "destination";
    passengerId?: number;
    passengerName?: string;
    coordinates: { latitude: number; longitude: number };
  } | null>(null);
  
  // PIN modal state
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [selectedPassengerName, setSelectedPassengerName] = useState<string>("");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  
  // Track if driver is near destination
  const [isNearDestination, setIsNearDestination] = useState(false);
  // Track if driver is near current pickup location
  const [isNearPickup, setIsNearPickup] = useState(false);
  // Track if driver has arrived at pickup (very close, < 50m)
  const [hasArrivedAtPickup, setHasArrivedAtPickup] = useState(false);
  const [nearPickupBookingId, setNearPickupBookingId] = useState<number | null>(null);
  const [nearPickupPassengerName, setNearPickupPassengerName] = useState<string>("");
  // ETA and distance tracking
  const [distanceToNextStop, setDistanceToNextStop] = useState<number | null>(null);
  const [etaToNextStop, setEtaToNextStop] = useState<number | null>(null);
  const [passengerETAs, setPassengerETAs] = useState<Map<number, number>>(new Map());
  // Network status
  const [isOnline, setIsOnline] = useState(true);
  const lastLocationRef = useRef<LocationCoords | null>(null);

  // Swipeable bottom sheet state
  const screenHeight = Dimensions.get("window").height;
  const collapsedHeight = 400; // Height when collapsed (increased for better visibility)
  const expandedHeight = screenHeight * 0.9; // Height when expanded (90% of screen)
  const [sheetHeight] = useState(new Animated.Value(collapsedHeight));
  const [isExpanded, setIsExpanded] = useState(false);
  const currentHeightRef = useRef(collapsedHeight);

  // Update ref when animated value changes
  useEffect(() => {
    const listener = sheetHeight.addListener(({ value }) => {
      currentHeightRef.current = value;
    });
    return () => {
      sheetHeight.removeListener(listener);
    };
  }, [sheetHeight]);

  // Listen for app state changes to detect when returning from Google Maps
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextAppState) => {
      // When app comes back to foreground and navigation was opened
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        navigationOpenedRef.current &&
        rideData &&
        rideData.status === "in-progress"
      ) {
        console.log("🔄 App returned to foreground, refreshing ride data...");
        
        // Refresh ride data silently without showing alert
        try {
          if (rideData.id && user?.id) {
            const updatedRide = await getRideById(rideData.id, user.id);
            setRideData(updatedRide);
            
            // Reset navigation flag
            navigationOpenedRef.current = false;
          }
        } catch (error) {
          console.error("Error refreshing ride data:", error);
        }
      }
      
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [rideData, user?.id]);

  // Get ride ID from navigation params - use useMemo to prevent recreation
  const rideIdFromParams = useMemo(() => {
    return params.rideId ? parseInt(params.rideId as string) : null;
  }, [params.rideId]);

  // Memoize rideFromParams to prevent recreation on every render
  const rideFromParams: Ride | null = useMemo(() => {
    if (!params.ride) return null;
    try {
      return JSON.parse(params.ride as string) as Ride;
    } catch (error) {
      console.error("❌ Error parsing ride data from params:", error);
      return null;
    }
  }, [params.ride]);

  // Mock current ride data
  const [currentRide] = useState<CurrentRide>({
    id: 1,
    fromAddress: '123 Main Street, San Francisco, CA',
    toAddress: '456 Market Street, San Francisco, CA',
    fromLatitude: 37.7749,
    fromLongitude: -122.4194,
    toLatitude: 37.7896,
    toLongitude: -122.4019,
    passengerName: 'John Doe',
    estimatedDuration: '15 min',
    distance: 2.5,
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
  useEffect(() => {
    if (!rideData) return;

    const fetchRoute = async () => {
      // Build waypoints (pickups in order)
      const waypoints: { latitude: number; longitude: number }[] = [];

      rideData.passengers?.forEach((passenger) => {
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
          console.warn(
            "Google Maps API key not configured, using straight line"
          );
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

  // Get current location and watch for updates during active ride
  useEffect(() => {
    (async () => {
      if (Location && Platform.OS !== 'web') {
        try {
          // Check if location services are enabled
          const servicesEnabled = await Location.hasServicesEnabledAsync();
          if (!servicesEnabled) {
            setLocationError("Location services are disabled. Please enable location services in your device settings.");
            return;
          }

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
          console.warn("Directions API error:", data.status);
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
        console.error("❌ Error fetching route:", error);
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
    };

    fetchRoute();
  }, [rideData]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentDestination,
    rideData?.id,
    rideData?.status,
    location?.latitude,
    location?.longitude,
  ]);

  // Fit map to show route when ready
  useEffect(() => {
    if (mapRef.current && currentRide) {
      const coordinates = [
        { latitude: currentRide.fromLatitude, longitude: currentRide.fromLongitude },
        { latitude: currentRide.toLatitude, longitude: currentRide.toLongitude },
      ];
      
      if (location) {
        coordinates.push(location);
      }
    });

    if (coordinates.length > 0) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [currentRide, location]);

  const mapRegion: Region = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : {
        latitude: currentRide.fromLatitude,
        longitude: currentRide.fromLongitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

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
            console.error("Start ride error:", error);
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

    Alert.alert(
      "Complete Ride",
      "Mark this ride as completed? We'll verify you're at the destination.",
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
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (error: any) {
              console.error("Complete ride error:", error);
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
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch (error: any) {
              console.error("Cancel ride error:", error);
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
      const driverId =
        typeof user.id === "string" ? parseInt(user.id) : user.id;
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
    const pendingPickups = rideData.passengers.filter(
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
      console.error("❌ Google Maps not installed:", error);

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
    rideData.passengers.forEach((p) => {
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

  const formatDistance = (km: number): string => {
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)}km`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />
      
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          style={styles.map}
          initialRegion={mapRegion}
          showsUserLocation={true}
          showsMyLocationButton={true}
          followsUserLocation={true}
          loadingEnabled={true}>
          
          {/* Route line */}
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#4285F4"
            strokeWidth={4}
          />

          {/* Pickup marker */}
          <Marker
            coordinate={{
              latitude: currentRide.fromLatitude,
              longitude: currentRide.fromLongitude,
            }}
            title="Pickup"
            description={currentRide.fromAddress}
            pinColor="#4285F4"
          />

          {/* Destination marker */}
          <Marker
            coordinate={{
              latitude: currentRide.toLatitude,
              longitude: currentRide.toLongitude,
            }}
            title="Destination"
            description={currentRide.toAddress}
            pinColor="#FF3B30"
          />
        </MapView>

        {/* Location Error Banner */}
        {locationError && (
          <View style={styles.locationErrorBanner}>
            <View style={styles.locationErrorContent}>
              <IconSymbol size={20} name="exclamationmark.triangle.fill" color="#FF3B30" />
              <View style={styles.locationErrorTextContainer}>
                <Text style={styles.locationErrorTitle}>Location Error</Text>
                <Text style={styles.locationErrorMessage} numberOfLines={2}>
                  {locationError}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.locationErrorRetryButton}
                onPress={async () => {
                  setLocationError(null);
                  try {
                    const servicesEnabled = await Location.hasServicesEnabledAsync();
                    if (!servicesEnabled) {
                      setLocationError("Location services are disabled. Please enable location services in your device settings.");
                      return;
                    }

                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== "granted") {
                      setLocationError("Location permission denied. Please enable location access in app settings.");
                      return;
                    }

                    const retryLocationPromise = Location.getCurrentPositionAsync({
                      accuracy: Location.Accuracy.High,
                      maximumAge: 10000,
                    });
                    
                    const retryTimeoutPromise = new Promise<never>((_, reject) => 
                      setTimeout(() => reject(new Error("Location request timeout")), 15000)
                    );
                    
                    const retryLocation = await Promise.race([
                      retryLocationPromise,
                      retryTimeoutPromise,
                    ]) as Location.LocationObject;
                    const retryCoords = {
                      latitude: retryLocation.coords.latitude,
                      longitude: retryLocation.coords.longitude,
                    };
                    if (isFinite(retryCoords.latitude) && isFinite(retryCoords.longitude)) {
                      setLocation(retryCoords);
                      setLocationError(null);
                      lastRouteUpdateRef.current = retryCoords;
                    }
                  } catch (retryError: any) {
                    console.error("Retry failed:", retryError);
                    let errorMessage = "Failed to obtain current location";
                    if (retryError?.message?.includes("timeout")) {
                      errorMessage = "Location request timed out. Please check your GPS signal.";
                    } else if (retryError?.message?.includes("permission")) {
                      errorMessage = "Location permission denied. Please enable in settings.";
                    }
                    setLocationError(errorMessage);
                  }
                }}
                activeOpacity={0.7}>
                <Text style={styles.locationErrorRetryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Header overlay */}
        <View style={styles.headerOverlay}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}>
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

        {/* Bottom ride info card */}
        <View style={styles.rideInfoCard}>
          <View style={styles.rideInfoHeader}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>In Progress</Text>
            </View>
            {currentRide.estimatedDuration && (
              <Text style={styles.etaText}>ETA: {currentRide.estimatedDuration}</Text>
            )}
          </View>

          {/* Scrollable Content */}
          <Animated.ScrollView
            style={styles.scrollableContent}
            showsVerticalScrollIndicator={isExpanded}
            bounces={isExpanded}
            scrollEnabled={isExpanded}
            contentContainerStyle={
              !isExpanded
                ? styles.collapsedContentContainer
                : styles.expandedContentContainer
            }
            nestedScrollEnabled={true}
          >
                {/* Collapsed State - Clean, compact layout */}
            {!isExpanded && (
              <>
                {/* Compact Route Info */}
                <View style={styles.collapsedRouteContainer}>
                  {/* Pickup */}
                  <View style={styles.collapsedRouteRow}>
                    <View style={styles.collapsedRouteMarker} />
                    <View style={styles.collapsedRouteContent}>
                      <Text style={styles.collapsedRouteAddress} numberOfLines={1}>
                        {rideData.fromAddress}
                      </Text>
                    </View>
                  </View>

                  {/* Destination */}
                  <View style={styles.collapsedRouteRow}>
                    <View
                      style={[
                        styles.collapsedRouteMarker,
                        styles.collapsedRouteMarkerDest,
                      ]}
                    />
                    <View style={styles.collapsedRouteContent}>
                      <Text style={styles.collapsedRouteAddress} numberOfLines={1}>
                        {rideData.toAddress}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Passenger Status and Progress - Compact */}
                {rideData.passengers && rideData.passengers.length > 0 && (
                  <View style={styles.passengerStatusCompact}>
                    <IconSymbol
                      size={14}
                      name="person.2.fill"
                      color="#999999"
                    />
                    <Text style={styles.passengerStatusText}>
                      {rideData.passengers.filter(p => p.pickupStatus === "picked_up").length}/{rideData.passengers.length} picked up
                    </Text>
                  </View>
                )}
                {/* Route Progress */}
                {rideData.status === "in-progress" && routeProgress > 0 && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${routeProgress}%` }]} />
                    </View>
                    <Text style={styles.progressText}>
                      {routeProgress.toFixed(0)}% complete
                      {distanceCovered > 0 && ` • ${distanceCovered.toFixed(1)} mi covered`}
                    </Text>
                  </View>
                )}

                {/* Action Button - Full Width */}
                <View style={styles.actionButtons}>
                  {rideData.status === "in-progress" ? (
                    <>
                      {isNearDestination && areAllPassengersPickedUp() ? (
                        // Show Complete Ride only when at destination and all picked up
                        <TouchableOpacity
                          style={[styles.actionButton, styles.actionButtonSuccess, styles.actionButtonFull]}
                          activeOpacity={0.7}
                          onPress={handleCompleteRide}
                        >
                          <IconSymbol size={18} name="checkmark.circle.fill" color="#FFFFFF" />
                          <Text style={styles.actionButtonTextPrimary}>
                            Complete Ride
                          </Text>
                        </TouchableOpacity>
                      ) : hasArrivedAtPickup && nearPickupBookingId && currentDestination?.type === "pickup" ? (
                        // Show "Arrived at Pickup" when very close (< 50m)
                        <TouchableOpacity
                          style={[styles.actionButton, styles.actionButtonSuccess, styles.actionButtonFull]}
                          activeOpacity={0.7}
                          onPress={() => {
                            handleMarkPickedUp(nearPickupBookingId, nearPickupPassengerName);
                          }}
                        >
                          <IconSymbol size={18} name="checkmark.circle.fill" color="#FFFFFF" />
                          <Text style={styles.actionButtonTextPrimary}>
                            Arrived at Pickup
                          </Text>
                        </TouchableOpacity>
                      ) : isNearPickup && nearPickupBookingId && currentDestination?.type === "pickup" ? (
                        // Show Ready to Pickup when near pickup location (200m)
                        <TouchableOpacity
                          style={[styles.actionButton, styles.actionButtonWarning, styles.actionButtonFull]}
                          activeOpacity={0.7}
                          onPress={() => {
                            handleMarkPickedUp(nearPickupBookingId, nearPickupPassengerName);
                          }}
                        >
                          <IconSymbol size={18} name="person.crop.circle.fill" color="#FFFFFF" />
                          <Text style={styles.actionButtonTextPrimary}>
                            Ready to Pickup
                          </Text>
                        </TouchableOpacity>
                      ) : currentDestination ? (
                        // Show Navigate button - compact text with distance/ETA
                        <View>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.actionButtonPrimary, styles.actionButtonFull]}
                            activeOpacity={0.7}
                            onPress={openNavigationToCurrentDestination}
                          >
                            <IconSymbol size={18} name="location.fill" color="#FFFFFF" />
                            <Text style={styles.actionButtonTextPrimary} numberOfLines={1}>
                              {currentDestination.type === "pickup"
                                ? `Navigate to ${currentDestination.passengerName || "Passenger"}`
                                : "Navigate to Destination"}
                            </Text>
                          </TouchableOpacity>
                          {/* Distance and ETA Display */}
                          {(distanceToNextStop !== null || etaToNextStop !== null) && (
                            <View style={styles.distanceEtaContainer}>
                              {distanceToNextStop !== null && (
                                <Text style={styles.distanceEtaText}>
                                  {distanceToNextStop.toFixed(1)} km away
                                </Text>
                              )}
                              {etaToNextStop !== null && (
                                <Text style={styles.distanceEtaText}>
                                  • ETA: {Math.round(etaToNextStop)} min
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                      ) : (
                        // Fallback: Update navigation
                        <TouchableOpacity
                          style={[styles.actionButton, styles.actionButtonPrimary, styles.actionButtonFull]}
                          activeOpacity={0.7}
                          onPress={() => {
                            updateNavigationToNextDestination();
                            if (currentDestination) {
                              openNavigationToCurrentDestination();
                            }
                          }}
                        >
                          <IconSymbol size={18} name="location.fill" color="#FFFFFF" />
                          <Text style={styles.actionButtonTextPrimary}>
                            Update Navigation
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionButtonPrimary, styles.actionButtonFull]}
                      activeOpacity={0.7}
                      onPress={handleStartRide}
                    >
                      <Text style={styles.actionButtonTextPrimary}>
                        Start Ride
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Cancel Ride and Emergency Buttons */}
                {rideData.status !== "cancelled" &&
                  rideData.status !== "completed" && (
                    <View style={styles.bottomActionButtons}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={handleCancelRide}
                        activeOpacity={0.7}
                      >
                        <IconSymbol
                          size={18}
                          name="xmark.circle.fill"
                          color="#FF3B30"
                        />
                        <Text style={styles.cancelButtonText}>Cancel Ride</Text>
                      </TouchableOpacity>
                      {rideData.status === "in-progress" && (
                        <TouchableOpacity
                          style={styles.emergencyButton}
                          onPress={() => {
                            Alert.alert(
                              "Emergency / Help",
                              "Choose an option:",
                              [
                                {
                                  text: "Call 911",
                                  onPress: () => {
                                    Linking.openURL("tel:911");
                                  },
                                },
                                {
                                  text: "Contact Support",
                                  onPress: () => {
                                    Linking.openURL("tel:+1234567890"); // Replace with actual support number
                                  },
                                },
                                {
                                  text: "Cancel",
                                  style: "cancel",
                                },
                              ]
                            );
                          }}
                          activeOpacity={0.7}
                        >
                          <IconSymbol
                            size={20}
                            name="exclamationmark.triangle.fill"
                            color="#FFFFFF"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                
                {/* Offline Mode Banner */}
                {!isOnline && (
                  <View style={styles.offlineBanner}>
                    <IconSymbol size={16} name="wifi.slash" color="#FFFFFF" />
                    <Text style={styles.offlineText}>
                      No internet connection. Location updates paused.
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Expanded State - Show full route info and details */}
            {isExpanded && (
              <>
                <View style={styles.rideInfoHeader}>
                  <View style={styles.statusBadge}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>
                      {rideData.status === "in-progress"
                        ? "In Progress"
                        : rideData.status === "completed"
                        ? "Completed"
                        : rideData.status === "cancelled"
                        ? "Cancelled"
                        : "Scheduled"}
                    </Text>
                  </View>
                  {totalRouteDistance !== null ? (
                    <Text style={styles.etaText}>
                      {totalRouteDistance.toFixed(1)} mi
                    </Text>
                  ) : rideData.distance ? (
                    <Text style={styles.etaText}>
                      {rideData.distance.toFixed(1)} mi
                    </Text>
                  ) : null}
                </View>

                {/* Route Info - Compact and professional */}
                <View style={styles.routeInfo}>
                  <View style={styles.routePoint}>
                    <View style={styles.routeMarker} />
                    <View style={styles.routeContent}>
                      <Text style={styles.routeLabel}>PICKUP</Text>
                      <Text style={styles.routeAddress} numberOfLines={2}>
                        {rideData.fromAddress}
                      </Text>
                    </View>
                  </View>

                  {/* Passenger Pickup Addresses */}
                  {rideData.passengers &&
                    rideData.passengers.length > 0 &&
                    rideData.passengers.map((passenger, index) => (
                      <React.Fragment
                        key={`passenger-route-${passenger.id || index}`}
                      >
                        <View style={styles.routeLine} />
                        <View style={styles.routePoint}>
                          <View style={styles.passengerRouteMarker} />
                          <View style={styles.routeContent}>
                            <Text style={styles.routeLabel}>
                              PICKUP {index + 1}
                              {passenger.riderName
                                ? ` • ${passenger.riderName}`
                                : ""}
                            </Text>
                            <Text style={styles.routeAddress} numberOfLines={2}>
                              {passenger.pickupAddress}
                            </Text>
                          </View>
                        </View>
                      </React.Fragment>
                    ))}

                  <View style={styles.routeLine} />

                  <View style={styles.routePoint}>
                    <View
                      style={[styles.routeMarker, styles.routeMarkerDest]}
                    />
                    <View style={styles.routeContent}>
                      <Text style={styles.routeLabel}>DESTINATION</Text>
                      <Text style={styles.routeAddress} numberOfLines={2}>
                        {rideData.toAddress}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Passengers Section - Compact */}
                {rideData.passengers && rideData.passengers.length > 0 && (
                  <View style={styles.passengersSection}>
                    <Text style={styles.passengersSectionTitle}>
                      Passengers ({rideData.passengers.length})
                    </Text>
                    {rideData.passengers.map((passenger, index) => {
                      const isPickedUp = passenger.pickupStatus === "picked_up";
                      const passengerName = passenger.riderName || `Passenger ${index + 1}`;
                      
                      return (
                        <View
                          key={`passenger-info-${passenger.id || index}`}
                          style={styles.passengerItem}
                        >
                          <View style={styles.passengerInfo}>
                            <View style={styles.passengerNameRow}>
                              <Text style={styles.passengerName}>
                                {passengerName}
                              </Text>
                              {isPickedUp ? (
                                <View style={styles.pickedUpBadge}>
                                  <IconSymbol size={12} name="checkmark.circle.fill" color="#34C759" />
                                  <Text style={styles.pickedUpText}>Picked Up</Text>
                                </View>
                              ) : (
                                <View style={styles.pendingBadge}>
                                  <Text style={styles.pendingText}>⏳ Pending</Text>
                                </View>
                              )}
                            </View>
                            {isPickedUp && passenger.pickedUpAt && (
                              <Text style={styles.pickedUpTime}>
                                Picked up at {formatTime(passenger.pickedUpAt)}
                              </Text>
                            )}
                            {/* ETA for pending passengers */}
                            {!isPickedUp && passenger.pickupLatitude && passenger.pickupLongitude && location && (
                              <View style={styles.passengerEtaContainer}>
                                {(() => {
                                  const distance = calculateDistanceKm(
                                    location.latitude,
                                    location.longitude,
                                    passenger.pickupLatitude!,
                                    passenger.pickupLongitude!
                                  );
                                  const eta = Math.round((distance / 48) * 60); // 48 km/h average
                                  return (
                                    <Text style={styles.passengerEtaText}>
                                      ETA: {eta} min • {distance.toFixed(1)} km away
                                    </Text>
                                  );
                                })()}
                              </View>
                            )}
                          </View>
                          <View style={styles.passengerActions}>
                            {isPickedUp && (
                              <View style={styles.pickedUpButton}>
                                <IconSymbol
                                  size={16}
                                  name="checkmark.circle.fill"
                                  color="#34C759"
                                />
                                <Text style={styles.pickedUpButtonText}>Picked Up</Text>
                              </View>
                            )}
                            {passenger.riderPhone && (
                              <TouchableOpacity
                                style={styles.callButton}
                                activeOpacity={0.7}
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
                              >
                                <IconSymbol
                                  size={18}
                                  name="phone.fill"
                                  color="#4285F4"
                                />
                              </TouchableOpacity>
                            )}
                            {passenger.riderPhone && (
                              <TouchableOpacity
                                style={styles.messageButton}
                                activeOpacity={0.7}
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
                              >
                                <IconSymbol
                                  size={18}
                                  name="message.fill"
                                  color="#4285F4"
                                />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Action Buttons - In expanded view */}
                <View style={styles.actionButtons}>
                  {rideData.status === "in-progress" ? (
                    <>
                      {isNearDestination && areAllPassengersPickedUp() ? (
                        // Show Complete Ride only when at destination and all picked up
                        <TouchableOpacity
                          style={[styles.actionButton, styles.actionButtonSuccess, styles.actionButtonFull]}
                          activeOpacity={0.7}
                          onPress={handleCompleteRide}
                        >
                          <IconSymbol size={18} name="checkmark.circle.fill" color="#FFFFFF" />
                          <Text style={styles.actionButtonTextPrimary}>
                            Complete Ride
                          </Text>
                        </TouchableOpacity>
                      ) : hasArrivedAtPickup && nearPickupBookingId && currentDestination?.type === "pickup" ? (
                        // Show "Arrived at Pickup" when very close (< 50m)
                        <TouchableOpacity
                          style={[styles.actionButton, styles.actionButtonSuccess, styles.actionButtonFull]}
                          activeOpacity={0.7}
                          onPress={() => {
                            handleMarkPickedUp(nearPickupBookingId, nearPickupPassengerName);
                          }}
                        >
                          <IconSymbol size={18} name="checkmark.circle.fill" color="#FFFFFF" />
                          <Text style={styles.actionButtonTextPrimary}>
                            Arrived at Pickup
                          </Text>
                        </TouchableOpacity>
                      ) : isNearPickup && nearPickupBookingId && currentDestination?.type === "pickup" ? (
                        // Show Ready to Pickup when near pickup location (200m)
                        <TouchableOpacity
                          style={[styles.actionButton, styles.actionButtonWarning, styles.actionButtonFull]}
                          activeOpacity={0.7}
                          onPress={() => {
                            handleMarkPickedUp(nearPickupBookingId, nearPickupPassengerName);
                          }}
                        >
                          <IconSymbol size={18} name="person.crop.circle.fill" color="#FFFFFF" />
                          <Text style={styles.actionButtonTextPrimary}>
                            Ready to Pickup
                          </Text>
                        </TouchableOpacity>
                      ) : currentDestination ? (
                        // Show Navigate button with destination info and distance/ETA
                        <View>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.actionButtonPrimary, styles.actionButtonFull]}
                            activeOpacity={0.7}
                            onPress={openNavigationToCurrentDestination}
                          >
                            <IconSymbol size={18} name="location.fill" color="#FFFFFF" />
                            <Text style={styles.actionButtonTextPrimary} numberOfLines={1}>
                              {currentDestination.type === "pickup"
                                ? `Navigate to ${currentDestination.passengerName || "Passenger"}`
                                : "Navigate to Destination"}
                            </Text>
                          </TouchableOpacity>
                          {/* Distance and ETA Display */}
                          {(distanceToNextStop !== null || etaToNextStop !== null) && (
                            <View style={styles.distanceEtaContainer}>
                              {distanceToNextStop !== null && (
                                <Text style={styles.distanceEtaText}>
                                  {distanceToNextStop.toFixed(1)} km away
                                </Text>
                              )}
                              {etaToNextStop !== null && (
                                <Text style={styles.distanceEtaText}>
                                  • ETA: {Math.round(etaToNextStop)} min
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                      ) : (
                        // Fallback: Update navigation
                        <TouchableOpacity
                          style={[styles.actionButton, styles.actionButtonPrimary]}
                          activeOpacity={0.7}
                          onPress={() => {
                            updateNavigationToNextDestination();
                            if (currentDestination) {
                              openNavigationToCurrentDestination();
                            }
                          }}
                        >
                          <IconSymbol size={18} name="location.fill" color="#FFFFFF" />
                          <Text style={styles.actionButtonTextPrimary}>
                            Update Navigation
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionButtonPrimary]}
                      activeOpacity={0.7}
                      onPress={handleStartRide}
                    >
                      <Text style={styles.actionButtonTextPrimary}>
                        Start Ride
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Cancel Ride Button - In expanded view */}
                {rideData.status !== "cancelled" &&
                  rideData.status !== "completed" && (
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={handleCancelRide}
                      activeOpacity={0.7}
                    >
                      <IconSymbol
                        size={18}
                        name="xmark.circle.fill"
                        color="#FF3B30"
                      />
                      <Text style={styles.cancelButtonText}>Cancel Ride</Text>
                    </TouchableOpacity>
                  )}
              </>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} activeOpacity={0.7}>
              <IconSymbol size={20} name="paperplane.fill" color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Contact</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.actionButtonPrimary]} 
              activeOpacity={0.7}>
              <Text style={styles.actionButtonTextPrimary}>Complete Ride</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.mapContainer}>
        <RideMap
          mapRef={mapRef}
          region={calculateRegion()}
          driverLocation={location}
          routeCoordinates={routeCoordinates}
          pickupMarkers={rideData.passengers}
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
          fromAddress={rideData.fromAddress}
          fromCity={rideData.fromCity}
          toAddress={rideData.toAddress}
          toCity={rideData.toCity}
          departureDate={rideData.departureDate}
          departureTime={rideData.departureTime}
          totalSeats={rideData.totalSeats}
          availableSeats={rideData.availableSeats}
          distance={rideData.distance}
          pricePerSeat={rideData.pricePerSeat}
          status={rideData.status}
        />

        {rideData.passengers.length > 0 && (
          <PassengerList
            passengers={rideData.passengers}
            driverLocation={location}
            onArrivedAtPickup={handleArrivedAtPickup}
            calculateDistance={calculateDistanceMiles}
          />
        )}

        <RideActions
          rideStatus={rideData.status}
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
    backgroundColor: '#000000',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  locationErrorBanner: {
    position: 'absolute',
    top: 80,
    left: 20,
    right: 20,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FF3B30',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  locationErrorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationErrorTextContainer: {
    flex: 1,
  },
  locationErrorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  locationErrorMessage: {
    fontSize: 12,
    fontWeight: '400',
    color: '#CCCCCC',
    lineHeight: 16,
  },
  locationErrorRetryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#4285F4',
    borderRadius: 8,
  },
  locationErrorRetryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  rideInfoCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
    overflow: "hidden",
  },
  dragHandle: {
    alignItems: "center",
    paddingVertical: 8,
    paddingBottom: 6,
  },
  dragHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#666666",
    borderRadius: 2,
  },
  scrollableContent: {
    flex: 1,
  },
  collapsedContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  expandedContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 80,
    flexGrow: 1,
  },
  rideInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4285F4',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  etaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4285F4',
  },
  routeInfo: {
    marginBottom: 16,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeMarker: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4285F4',
    marginTop: 6,
    marginRight: 12,
  },
  routeMarkerDest: {
    backgroundColor: '#FF3B30',
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: '#2A2A2A',
    marginLeft: 4,
    marginVertical: 4,
  },
  routeContent: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    opacity: 0.5,
    marginBottom: 4,
    letterSpacing: 1,
  },
  routeAddress: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1A1A1A',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 8,
    textAlign: "center",
  },
  currentDestinationBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4285F4",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 14,
  },
  currentDestinationText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: 6,
    flex: 1,
  },
  collapsedRouteContainer: {
    marginBottom: 20,
  },
  collapsedRouteRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  collapsedRouteMarker: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4285F4",
    marginRight: 10,
  },
  collapsedRouteMarkerDest: {
    backgroundColor: "#EA4335",
  },
  collapsedRouteContent: {
    flex: 1,
  },
  collapsedRouteAddress: {
    fontSize: 15,
    fontWeight: "500",
    color: "#FFFFFF",
    lineHeight: 20,
  },
  passengerStatusCompact: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  passengerStatusText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#999999",
    marginLeft: 6,
  },
  passengerCountContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  passengerCountText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  actionButtonFull: {
    flex: 1,
    minWidth: "100%",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButtonPrimary: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  actionButtonSuccess: {
    backgroundColor: "#34C759",
    borderColor: "#34C759",
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

