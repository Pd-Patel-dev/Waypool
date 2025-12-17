import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
  Alert,
  Linking,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { IconSymbol } from "@/components/ui/icon-symbol";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  Region,
} from "react-native-maps";
import { type Ride, getRideById, cancelRide, startRide, completeRide, markPassengerPickedUp, updateDriverLocation, type ApiError } from "@/services/api";
import { useUser } from "@/context/UserContext";
import { TextInput, Modal } from "react-native";
import { calculateDistance as calculateDistanceMiles } from "@/utils/distance";
import NetInfo from '@react-native-community/netinfo';

// Conditionally import Location only on native platforms
let Location: any = null;
if (Platform.OS !== "web") {
  try {
    Location = require("expo-location");
  } catch (e) {
    console.warn("expo-location not available:", e);
  }
}

interface LocationCoords {
  latitude: number;
  longitude: number;
}

export default function CurrentRideScreen(): React.JSX.Element {
  const params = useLocalSearchParams();
  const { user } = useUser();
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

  console.log("📍 CurrentRideScreen params:", {
    rideIdFromParams,
    hasRideFromParams: !!rideFromParams,
    rideFromParamsId: rideFromParams?.id,
    hasFetched: hasFetchedRef.current,
  });

  // Fetch ride details from API - only once
  useEffect(() => {
    // Prevent multiple calls
    if (hasFetchedRef.current) {
      return;
    }

    const fetchRideDetails = async () => {
      // Mark as fetched immediately to prevent duplicate calls
      hasFetchedRef.current = true;

      try {
        setIsLoadingRide(true);

        // Always try to fetch from API if ride ID is provided
        if (rideIdFromParams && !isNaN(rideIdFromParams)) {
          console.log(
            "🔄 Fetching ride details from API for ride ID:",
            rideIdFromParams,
            "driver ID:",
            user?.id
          );
          try {
            const ride = await getRideById(rideIdFromParams, user?.id);
            console.log("✅ Successfully fetched ride from database:", ride);
            setRideData(ride);
            return; // Successfully fetched, exit early
          } catch (apiError) {
            console.error("❌ Error fetching ride from API:", apiError);
            // Fall through to use ride from params as fallback
          }
        }

        // Fallback: use ride data from params if available
        if (rideFromParams) {
          console.log("⚠️ Using ride data from navigation params (fallback)");
          setRideData(rideFromParams);
        } else {
          console.error("❌ No ride ID or ride data available");
          // Show error state or navigate back
          router.back();
        }
      } catch (error) {
        console.error("❌ Error in fetchRideDetails:", error);
        // Use ride from params as last resort fallback
        if (rideFromParams) {
          setRideData(rideFromParams);
        } else {
          router.back();
        }
      } finally {
        setIsLoadingRide(false);
      }
    };

    // Only fetch if we have a ride ID or ride data
    if (rideIdFromParams || rideFromParams) {
      fetchRideDetails();
    } else {
      console.error("❌ No ride ID or ride data provided");
      setIsLoadingRide(false);
      router.back();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideIdFromParams, params.ride, user?.id]); // Use params.ride string instead of parsed object

  // Calculate distance between two points (Haversine formula in miles)
  const calculateDistanceKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  };

  // Find the closest point on a polyline to a given location
  const findClosestPointOnRoute = (
    currentLocation: LocationCoords,
    routePoints: LocationCoords[]
  ): { point: LocationCoords; index: number; distance: number } => {
    if (routePoints.length === 0) {
      return { point: currentLocation, index: 0, distance: 0 };
    }

    let minDistance = Infinity;
    let closestPoint = routePoints[0];
    let closestIndex = 0;

    // Check each segment of the route
    for (let i = 0; i < routePoints.length - 1; i++) {
      const p1 = routePoints[i];
      const p2 = routePoints[i + 1];

      // Calculate distance from current location to this segment
      const dist = distanceToSegment(currentLocation, p1, p2);
      
      if (dist < minDistance) {
        minDistance = dist;
        // Find the closest point on this segment
        const closestOnSegment = closestPointOnSegment(currentLocation, p1, p2);
        closestPoint = closestOnSegment;
        closestIndex = i;
      }
    }

    return { point: closestPoint, index: closestIndex, distance: minDistance };
  };

  // Calculate distance from a point to a line segment
  const distanceToSegment = (
    point: LocationCoords,
    segStart: LocationCoords,
    segEnd: LocationCoords
  ): number => {
    const A = point.latitude - segStart.latitude;
    const B = point.longitude - segStart.longitude;
    const C = segEnd.latitude - segStart.latitude;
    const D = segEnd.longitude - segStart.longitude;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx: number, yy: number;

    if (param < 0) {
      xx = segStart.latitude;
      yy = segStart.longitude;
    } else if (param > 1) {
      xx = segEnd.latitude;
      yy = segEnd.longitude;
    } else {
      xx = segStart.latitude + param * C;
      yy = segStart.longitude + param * D;
    }

    const dx = point.latitude - xx;
    const dy = point.longitude - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Find the closest point on a line segment to a given point
  const closestPointOnSegment = (
    point: LocationCoords,
    segStart: LocationCoords,
    segEnd: LocationCoords
  ): LocationCoords => {
    const A = point.latitude - segStart.latitude;
    const B = point.longitude - segStart.longitude;
    const C = segEnd.latitude - segStart.latitude;
    const D = segEnd.longitude - segStart.longitude;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    if (param < 0) {
      return segStart;
    } else if (param > 1) {
      return segEnd;
    } else {
      return {
        latitude: segStart.latitude + param * C,
        longitude: segStart.longitude + param * D,
      };
    }
  };

  // Calculate distance covered along the route
  const calculateDistanceCovered = (
    currentLocation: LocationCoords | null,
    routePoints: LocationCoords[],
    totalDistance: number | null
  ): { distanceCovered: number; progress: number } => {
    if (!currentLocation || routePoints.length === 0 || !totalDistance || totalDistance === 0) {
      return { distanceCovered: 0, progress: 0 };
    }

    // Validate coordinates
    if (!isFinite(currentLocation.latitude) || !isFinite(currentLocation.longitude)) {
      return { distanceCovered: 0, progress: 0 };
    }

    // Find closest point on route to current location
    const { point: closestPoint, index: closestIndex } = findClosestPointOnRoute(
      currentLocation,
      routePoints
    );

    // Calculate cumulative distance from start to closest point
    let cumulativeDistance = 0;
    for (let i = 0; i < closestIndex; i++) {
      cumulativeDistance += calculateDistanceKm(
        routePoints[i].latitude,
        routePoints[i].longitude,
        routePoints[i + 1].latitude,
        routePoints[i + 1].longitude
      );
    }

    // Add distance from last point before closest to the closest point
    if (closestIndex < routePoints.length - 1) {
      cumulativeDistance += calculateDistanceKm(
        routePoints[closestIndex].latitude,
        routePoints[closestIndex].longitude,
        closestPoint.latitude,
        closestPoint.longitude
      );
    }

    // Convert to miles
    const distanceCoveredMiles = cumulativeDistance * 0.621371;

    // Calculate progress percentage (cap at 100%)
    const progress = Math.min(100, Math.max(0, (distanceCoveredMiles / totalDistance) * 100));

    return { distanceCovered: distanceCoveredMiles, progress };
  };

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

  // Fetch route from Google Directions API with waypoints (passenger pickups)
  const fetchRoute = async (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    waypoints?: { latitude: number; longitude: number }[]
  ) => {
    if (
      !rideData ||
      !rideData.fromLatitude ||
      !rideData.fromLongitude ||
      !rideData.toLatitude ||
      !rideData.toLongitude
    ) {
      // Build fallback route with all points
      const fallbackPoints = [origin];
      if (waypoints) {
        fallbackPoints.push(...waypoints);
      }
      fallbackPoints.push(destination);
      setRouteCoordinates(fallbackPoints);
      return;
    }

    setIsLoadingRoute(true);
    setTotalRouteDistance(null); // Reset distance when fetching new route
    try {
      const GOOGLE_API_KEY =
        process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || "";
      if (!GOOGLE_API_KEY) {
        throw new Error("Google Maps API key is not configured");
      }

      // Validate coordinates are valid numbers
      if (
        !isFinite(origin.latitude) ||
        !isFinite(origin.longitude) ||
        !isFinite(destination.latitude) ||
        !isFinite(destination.longitude)
      ) {
        console.error("Invalid coordinates for route:", { origin, destination });
        return;
      }

      // Build URL with waypoints if available
      let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}`;

      // Add waypoints if there are passenger pickups
      if (waypoints && waypoints.length > 0) {
        // Filter out invalid waypoints
        const validWaypoints = waypoints.filter(
          (wp) => isFinite(wp.latitude) && isFinite(wp.longitude)
        );
        if (validWaypoints.length > 0) {
          const waypointsStr = validWaypoints
            .map((wp) => `${wp.latitude},${wp.longitude}`)
            .join("|");
          url += `&waypoints=${encodeURIComponent(waypointsStr)}`;
        }
      }

      url += `&key=${GOOGLE_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "OK" && data.routes.length > 0) {
        const route = data.routes[0];
        // Combine all legs of the route (origin -> waypoint1 -> waypoint2 -> ... -> destination)
        let allPoints: { latitude: number; longitude: number }[] = [];

        // Calculate total distance from all legs
        let totalDistanceMeters = 0;
        route.legs.forEach((leg: any) => {
          if (leg.distance && leg.distance.value) {
            totalDistanceMeters += leg.distance.value;
          }
          if (leg.steps) {
            leg.steps.forEach((step: any) => {
              if (step.polyline && step.polyline.points) {
                const stepPoints = decodePolyline(step.polyline.points);
                allPoints = allPoints.concat(stepPoints);
              }
            });
          }
        });

        // Convert distance to miles
        const totalDistanceMiles = totalDistanceMeters / 1609.34;
        setTotalRouteDistance(totalDistanceMiles);

        // If we couldn't get detailed steps, use overview polyline
        if (
          allPoints.length === 0 &&
          route.overview_polyline &&
          route.overview_polyline.points
        ) {
          allPoints = decodePolyline(route.overview_polyline.points);
        }

        setRouteCoordinates(
          allPoints.length > 0 ? allPoints : [origin, destination]
        );
      } else {
        // Fallback: build route with all points
        const fallbackPoints = [origin];
        if (waypoints) {
          fallbackPoints.push(...waypoints);
        }
        fallbackPoints.push(destination);
        setRouteCoordinates(fallbackPoints);
      }
    } catch (error) {
      console.error("Error fetching route:", error);
      // Fallback: build route with all points
      const fallbackPoints = [origin];
      if (waypoints) {
        fallbackPoints.push(...waypoints);
      }
      fallbackPoints.push(destination);
      setRouteCoordinates(fallbackPoints);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  // Get current location and watch for updates during active ride
  useEffect(() => {
    (async () => {
      if (Location && Platform.OS !== "web") {
        try {
          // Check if location services are enabled
          const servicesEnabled = await Location.hasServicesEnabledAsync();
          if (!servicesEnabled) {
            setLocationError("Location services are disabled. Please enable location services in your device settings.");
            return;
          }

          // Request permissions
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            setLocationError("Location permission denied. Please enable location access in app settings.");
            return;
          }

          // Get current location with timeout and better error handling
          try {
            const locationPromise = Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
              maximumAge: 10000, // Accept cached location up to 10 seconds old
            });
            
            const timeoutPromise = new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error("Location request timeout")), 15000)
            );
            
            const currentLocation = await Promise.race([
              locationPromise,
              timeoutPromise,
            ]) as Location.LocationObject;

            const newLocation = {
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
            };

            // Validate coordinates
            if (!isFinite(newLocation.latitude) || !isFinite(newLocation.longitude)) {
              throw new Error("Invalid location coordinates received");
            }

            setLocation(newLocation);
            setLocationError(null); // Clear any previous errors
            lastRouteUpdateRef.current = newLocation;

            // Calculate initial route progress
            if (rideData?.status === "in-progress" && routeCoordinates.length > 0 && totalRouteDistance) {
              const { distanceCovered: covered, progress } = calculateDistanceCovered(
                newLocation,
                routeCoordinates,
                totalRouteDistance
              );
              setDistanceCovered(covered);
              setRouteProgress(progress);
            }

          // Send initial location to backend if ride is in-progress
          if (rideData?.status === "in-progress" && user?.id && isFinite(newLocation.latitude) && isFinite(newLocation.longitude)) {
            try {
              console.log("📍 Sending initial driver location:", {
                driverId: user.id,
                latitude: newLocation.latitude,
                longitude: newLocation.longitude,
              });
              await updateDriverLocation(user.id, newLocation.latitude, newLocation.longitude);
              console.log("✅ Initial driver location sent successfully");
            } catch (error) {
              console.error("❌ Error sending initial driver location:", error);
            }
          }

          // Watch position for real-time updates (only during active ride)
          if (rideData?.status === "in-progress") {
            // Stop previous watch if exists
            if (locationWatchSubscriptionRef.current) {
              locationWatchSubscriptionRef.current.remove();
            }

            locationWatchSubscriptionRef.current = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.High,
                timeInterval: 10000, // Update every 10 seconds (optimized from 5)
                distanceInterval: 50, // Update every 50 meters (optimized from 30) - only when location changes significantly
              },
              async (updatedLocation: any) => {
                const updated = {
                  latitude: updatedLocation.coords.latitude,
                  longitude: updatedLocation.coords.longitude,
                };
                // Only update if location has changed significantly (optimization)
                if (lastLocationRef.current) {
                  const distanceChange = calculateDistanceKm(
                    lastLocationRef.current.latitude,
                    lastLocationRef.current.longitude,
                    updated.latitude,
                    updated.longitude
                  );
                  // Only update if moved more than 30 meters
                  if (distanceChange < 0.03) {
                    return; // Skip update if location hasn't changed significantly
                  }
                }
                
                lastLocationRef.current = updated;
                setLocation(updated);

                // Send location to backend for passenger tracking (only if online)
                if (isOnline && user?.id && isFinite(updated.latitude) && isFinite(updated.longitude)) {
                  try {
                    console.log("📍 Sending driver location update:", {
                      driverId: user.id,
                      latitude: updated.latitude,
                      longitude: updated.longitude,
                      rideStatus: rideData?.status,
                    });
                    await updateDriverLocation(user.id, updated.latitude, updated.longitude);
                    console.log("✅ Driver location updated successfully");
                  } catch (error) {
                    console.error("❌ Error updating driver location:", error);
                    // Check if it's a network error
                    if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('network'))) {
                      setIsOnline(false);
                    }
                  }
                } else {
                  console.warn("⚠️ Cannot send location: invalid data or offline", {
                    hasUserId: !!user?.id,
                    isOnline,
                    latitude: updated.latitude,
                    longitude: updated.longitude,
                  });
                }

                // Refresh route if location changed significantly (more than 100m)
                if (lastRouteUpdateRef.current) {
                  const distanceKm = calculateDistanceKm(
                    lastRouteUpdateRef.current.latitude,
                    lastRouteUpdateRef.current.longitude,
                    updated.latitude,
                    updated.longitude
                  );
                  
                  // Update route if moved more than 100 meters (0.1 km)
                  if (distanceKm > 0.1 && rideData?.status === "in-progress") {
                    lastRouteUpdateRef.current = updated;
                    // Trigger route refresh by updating a dependency
                    // The route useEffect will handle the refresh
                  }
                }

                // Check if driver is near destination (within 200 meters)
                if (rideData?.status === "in-progress" && rideData.toLatitude && rideData.toLongitude) {
                  const distanceToDestination = calculateDistanceKm(
                    updated.latitude,
                    updated.longitude,
                    rideData.toLatitude,
                    rideData.toLongitude
                  );
                  
                  // Consider "near" if within 200 meters (0.2 km)
                  setIsNearDestination(distanceToDestination <= 0.2);
                }

                // Check if driver is near current pickup location (within 200 meters)
                if (rideData?.status === "in-progress" && currentDestination?.type === "pickup") {
                  const distanceToPickup = calculateDistanceKm(
                    updated.latitude,
                    updated.longitude,
                    currentDestination.coordinates.latitude,
                    currentDestination.coordinates.longitude
                  );
                  
                  // Consider "near" if within 200 meters (0.2 km)
                  if (distanceToPickup <= 0.2 && currentDestination.passengerId) {
                    setIsNearPickup(true);
                    setNearPickupBookingId(currentDestination.passengerId);
                    setNearPickupPassengerName(currentDestination.passengerName || "Passenger");
                  } else {
                    setIsNearPickup(false);
                    setNearPickupBookingId(null);
                    setNearPickupPassengerName("");
                  }
                } else {
                  setIsNearPickup(false);
                  setNearPickupBookingId(null);
                  setNearPickupPassengerName("");
                }
              }
            );
          }
          } catch (locationError: any) {
            console.error("Error getting current location:", locationError);
            
            // Provide specific error messages
            let errorMessage = "Failed to obtain current location";
            if (locationError?.message?.includes("timeout")) {
              errorMessage = "Location request timed out. Please check your GPS signal and try again.";
            } else if (locationError?.message?.includes("permission")) {
              errorMessage = "Location permission denied. Please enable location access in app settings.";
            } else if (locationError?.code === 1) {
              errorMessage = "Location permission denied. Please enable location access in app settings.";
            } else if (locationError?.code === 2) {
              errorMessage = "Location unavailable. Please check your GPS signal and try again.";
            } else if (locationError?.code === 3) {
              errorMessage = "Location request timed out. Please check your GPS signal and try again.";
            }
            
            setLocationError(errorMessage);
            
            // Show alert to user with actionable message
            Alert.alert(
              "Location Error",
              errorMessage,
              [
                {
                  text: "Open Settings",
                  onPress: () => {
                    if (Platform.OS === 'ios') {
                      Linking.openURL('app-settings:');
                    } else {
                      Linking.openSettings();
                    }
                  },
                },
                {
                  text: "Retry",
                  onPress: async () => {
                    // Retry getting location
                    try {
                      const retryLocation = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.High,
                        maximumAge: 10000,
                        timeout: 15000,
                      });
                      const retryCoords = {
                        latitude: retryLocation.coords.latitude,
                        longitude: retryLocation.coords.longitude,
                      };
                      if (isFinite(retryCoords.latitude) && isFinite(retryCoords.longitude)) {
                        setLocation(retryCoords);
                        setLocationError(null);
                        lastRouteUpdateRef.current = retryCoords;
                      }
                    } catch (retryError) {
                      console.error("Retry failed:", retryError);
                    }
                  },
                },
                {
                  text: "OK",
                  style: "cancel",
                },
              ]
            );
            
            // Try to use last known location as fallback
            try {
              const lastKnownLocation = await Location.getLastKnownPositionAsync({
                maximumAge: 60000, // Accept location up to 1 minute old
              });
              if (lastKnownLocation) {
                const fallbackLocation = {
                  latitude: lastKnownLocation.coords.latitude,
                  longitude: lastKnownLocation.coords.longitude,
                };
                if (isFinite(fallbackLocation.latitude) && isFinite(fallbackLocation.longitude)) {
                  setLocation(fallbackLocation);
                  setLocationError("Using last known location. Please enable GPS for accurate tracking.");
                  lastRouteUpdateRef.current = fallbackLocation;
                }
              }
            } catch (fallbackError) {
              console.error("Error getting last known location:", fallbackError);
            }
          }
        } catch (error: any) {
          console.error("Error in location setup:", error);
          let errorMessage = "Failed to set up location tracking";
          if (error?.message?.includes("permission")) {
            errorMessage = "Location permission denied. Please enable location access in app settings.";
          } else if (error?.message?.includes("services")) {
            errorMessage = "Location services are disabled. Please enable location services in your device settings.";
          }
          setLocationError(errorMessage);
        }
      }
    })();

    // Cleanup: stop watching when component unmounts or ride ends
    return () => {
      if (locationWatchSubscriptionRef.current) {
        locationWatchSubscriptionRef.current.remove();
        locationWatchSubscriptionRef.current = null;
      }
    };
  }, [rideData?.status]);

  // Recalculate progress when route or location changes
  useEffect(() => {
    if (
      rideData?.status === "in-progress" &&
      location &&
      routeCoordinates.length > 0 &&
      totalRouteDistance &&
      totalRouteDistance > 0
    ) {
      const { distanceCovered: covered, progress } = calculateDistanceCovered(
        location,
        routeCoordinates,
        totalRouteDistance
      );
      setDistanceCovered(covered);
      setRouteProgress(progress);
    } else {
      // Reset progress if ride is not in progress or route data is missing
      setDistanceCovered(0);
      setRouteProgress(0);
    }
  }, [location, routeCoordinates, totalRouteDistance, rideData?.status]);

  // Update current destination when ride data or pickup status changes
  useEffect(() => {
    if (!rideData) return;

    if (rideData.status === "in-progress") {
      const nextPickup = getNextPickupLocation();
      const allPickedUp = areAllPassengersPickedUp();

      // Determine destination: next pickup if available, otherwise final destination
      if (nextPickup && !allPickedUp) {
        // Navigate to next pickup
        setCurrentDestination({
          type: "pickup",
          passengerId: nextPickup.passenger.id,
          passengerName: nextPickup.passenger.riderName || "Passenger",
          coordinates: nextPickup.coordinates,
        });
      } else if (allPickedUp && rideData.toLatitude && rideData.toLongitude) {
        // All picked up, navigate to final destination
        setCurrentDestination({
          type: "destination",
          coordinates: {
            latitude: rideData.toLatitude,
            longitude: rideData.toLongitude,
          },
        });
      } else {
        setCurrentDestination(null);
      }
    } else {
      // Reset destination state when ride is not active
      setCurrentDestination(null);
      setIsNearDestination(false);
    }
  }, [rideData?.status, rideData?.passengers, rideData?.toLatitude, rideData?.toLongitude]);

  // Check proximity to destination and pickup when location or destination changes
  useEffect(() => {
    if (
      rideData?.status === "in-progress" &&
      location &&
      location.latitude &&
      location.longitude
    ) {
      // Check distance to final destination
      if (rideData.toLatitude && rideData.toLongitude) {
        const distanceToDestination = calculateDistanceKm(
          location.latitude,
          location.longitude,
          rideData.toLatitude,
          rideData.toLongitude
        );
        
        // Consider "near" if within 200 meters (0.2 km)
        setIsNearDestination(distanceToDestination <= 0.2);
      }

      // Check distance to current pickup location
      if (currentDestination?.type === "pickup") {
        const distanceToPickup = calculateDistanceKm(
          location.latitude,
          location.longitude,
          currentDestination.coordinates.latitude,
          currentDestination.coordinates.longitude
        );
        
        // Update distance to next stop
        setDistanceToNextStop(distanceToPickup);
        
        // Calculate ETA (assuming average speed of 30 mph = 48 km/h)
        const averageSpeedKmh = 48;
        const etaMinutes = (distanceToPickup / averageSpeedKmh) * 60;
        setEtaToNextStop(etaMinutes);
        
        // Consider "arrived" if within 50 meters (0.05 km) - very close
        if (distanceToPickup <= 0.05 && currentDestination.passengerId) {
          setHasArrivedAtPickup(true);
          setIsNearPickup(true);
          setNearPickupBookingId(currentDestination.passengerId);
          setNearPickupPassengerName(currentDestination.passengerName || "Passenger");
        } else if (distanceToPickup <= 0.2 && currentDestination.passengerId) {
          // Consider "near" if within 200 meters (0.2 km)
          setHasArrivedAtPickup(false);
          setIsNearPickup(true);
          setNearPickupBookingId(currentDestination.passengerId);
          setNearPickupPassengerName(currentDestination.passengerName || "Passenger");
        } else {
          setHasArrivedAtPickup(false);
          setIsNearPickup(false);
          setNearPickupBookingId(null);
          setNearPickupPassengerName("");
        }
      } else if (currentDestination?.type === "destination") {
        // Calculate distance and ETA to final destination
        const distanceToDest = calculateDistanceKm(
          location.latitude,
          location.longitude,
          currentDestination.coordinates.latitude,
          currentDestination.coordinates.longitude
        );
        setDistanceToNextStop(distanceToDest);
        const averageSpeedKmh = 48;
        const etaMinutes = (distanceToDest / averageSpeedKmh) * 60;
        setEtaToNextStop(etaMinutes);
        setIsNearPickup(false);
        setHasArrivedAtPickup(false);
      } else {
        setIsNearPickup(false);
        setHasArrivedAtPickup(false);
        setNearPickupBookingId(null);
        setNearPickupPassengerName("");
        setDistanceToNextStop(null);
        setEtaToNextStop(null);
      }
    } else {
      setIsNearDestination(false);
      setIsNearPickup(false);
      setNearPickupBookingId(null);
      setNearPickupPassengerName("");
    }
  }, [location?.latitude, location?.longitude, rideData?.status, rideData?.toLatitude, rideData?.toLongitude, currentDestination]);

  // Fetch route when current destination changes
  useEffect(() => {
    if (
      rideData &&
      rideData.status === "in-progress" &&
      currentDestination
    ) {
      // Determine origin: use current location if available, otherwise use ride origin
      let origin: { latitude: number; longitude: number };
      if (location && location.latitude && location.longitude) {
        origin = location;
      } else if (rideData.fromLatitude && rideData.fromLongitude) {
        origin = {
          latitude: rideData.fromLatitude,
          longitude: rideData.fromLongitude,
        };
      } else {
        return; // Can't fetch route without origin
      }

      // Fetch route to current destination
      fetchRoute(origin, currentDestination.coordinates);
    } else if (
      rideData &&
      rideData.fromLatitude &&
      rideData.fromLongitude &&
      rideData.toLatitude &&
      rideData.toLongitude &&
      rideData.status !== "in-progress"
    ) {
      // Ride not started yet - show full route with all pickups as waypoints
      const waypoints: { latitude: number; longitude: number }[] = [];
      if (rideData.passengers && rideData.passengers.length > 0) {
        rideData.passengers.forEach((passenger) => {
          if (passenger.pickupLatitude && passenger.pickupLongitude) {
            waypoints.push({
              latitude: passenger.pickupLatitude,
              longitude: passenger.pickupLongitude,
            });
          }
        });
      }

      fetchRoute(
        { latitude: rideData.fromLatitude, longitude: rideData.fromLongitude },
        { latitude: rideData.toLatitude, longitude: rideData.toLongitude },
        waypoints.length > 0 ? waypoints : undefined
      );
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
    if (
      mapRef.current &&
      rideData &&
      rideData.fromLatitude &&
      rideData.fromLongitude &&
      rideData.toLatitude &&
      rideData.toLongitude
    ) {
      const coordinates = [
        { latitude: rideData.fromLatitude, longitude: rideData.fromLongitude },
      ];

      // Add passenger pickup locations
      if (rideData.passengers) {
        rideData.passengers.forEach((passenger) => {
          if (passenger.pickupLatitude && passenger.pickupLongitude) {
            coordinates.push({
              latitude: passenger.pickupLatitude,
              longitude: passenger.pickupLongitude,
            });
          }
        });
      }

      // Add destination
      coordinates.push({
        latitude: rideData.toLatitude,
        longitude: rideData.toLongitude,
      });

      if (location) {
        coordinates.push(location);
      }

      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
          animated: true,
        });
      }, 500);
    }
  }, [rideData, location, routeCoordinates]);

  const mapRegion: Region = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : rideData && rideData.fromLatitude && rideData.fromLongitude
    ? {
        latitude: rideData.fromLatitude,
        longitude: rideData.fromLongitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : {
        latitude: 37.7749,
        longitude: -122.4194,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Helper function to get the next pending pickup location (optimized: closest first)
  const getNextPickupLocation = (): {
    passenger: any;
    coordinates: { latitude: number; longitude: number };
  } | null => {
    if (!rideData?.passengers) return null;
    
    // Get all pending passengers with valid coordinates
    const pendingPassengers = rideData.passengers.filter(
      (p) => p.pickupStatus !== "picked_up" && p.pickupLatitude && p.pickupLongitude
    );
    
    if (pendingPassengers.length === 0) return null;
    
      // If we have current location, sort by distance (closest first)
      // Otherwise, return first pending passenger
      if (location && location.latitude && location.longitude) {
        const passengersWithDistance = pendingPassengers.map((p) => ({
          passenger: p,
          distance: calculateDistanceMiles(
            location.latitude,
            location.longitude,
            p.pickupLatitude!,
            p.pickupLongitude!
          ),
        }));
      
      passengersWithDistance.sort((a, b) => a.distance - b.distance);
      const closest = passengersWithDistance[0];
      
      return {
        passenger: closest.passenger,
        coordinates: {
          latitude: closest.passenger.pickupLatitude!,
          longitude: closest.passenger.pickupLongitude!,
        },
      };
    }
    
    // Fallback: return first pending passenger
    const firstPending = pendingPassengers[0];
    return {
      passenger: firstPending,
      coordinates: {
        latitude: firstPending.pickupLatitude!,
        longitude: firstPending.pickupLongitude!,
      },
    };
  };

  // Helper function to check if all passengers are picked up
  const areAllPassengersPickedUp = (): boolean => {
    if (!rideData?.passengers || rideData.passengers.length === 0) return true;
    return rideData.passengers.every((p) => p.pickupStatus === "picked_up");
  };

  // Function to update navigation destination (called after pickup)
  const updateNavigationToNextDestination = () => {
    if (!rideData) return;

    const nextPickup = getNextPickupLocation();
    const allPickedUp = areAllPassengersPickedUp();

    // Determine destination: next pickup if available, otherwise final destination
    if (nextPickup && !allPickedUp) {
      // Navigate to next pickup
      setCurrentDestination({
        type: "pickup",
        passengerId: nextPickup.passenger.id,
        passengerName: nextPickup.passenger.riderName || "Passenger",
        coordinates: nextPickup.coordinates,
      });
    } else if (rideData.toLatitude && rideData.toLongitude) {
      // All picked up, navigate to final destination
      setCurrentDestination({
        type: "destination",
        coordinates: {
          latitude: rideData.toLatitude,
          longitude: rideData.toLongitude,
        },
      });
    } else {
      setCurrentDestination(null);
    }
  };

  // Function to open navigation to current destination
  const openNavigationToCurrentDestination = () => {
    if (!rideData || !currentDestination) return;

    // Get current location (use ride origin if available, otherwise use first pickup)
    let currentOrigin: { latitude: number; longitude: number };
    if (location && location.latitude && location.longitude) {
      currentOrigin = location;
    } else if (rideData.fromLatitude && rideData.fromLongitude) {
      currentOrigin = {
        latitude: rideData.fromLatitude,
        longitude: rideData.fromLongitude,
      };
    } else {
      Alert.alert("Error", "Unable to determine current location for navigation.");
      return;
    }

    // Validate coordinates are valid numbers
    if (
      !isFinite(currentOrigin.latitude) ||
      !isFinite(currentOrigin.longitude) ||
      !isFinite(currentDestination.coordinates.latitude) ||
      !isFinite(currentDestination.coordinates.longitude)
    ) {
      Alert.alert("Error", "Invalid location coordinates. Please try again.");
      return;
    }

    const originStr = `${currentOrigin.latitude},${currentOrigin.longitude}`;
    const destStr = `${currentDestination.coordinates.latitude},${currentDestination.coordinates.longitude}`;

    // Mark that navigation was opened
    navigationOpenedRef.current = true;

    if (Platform.OS === "ios") {
      const googleUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}&dir_action=navigate`;
      Linking.canOpenURL(googleUrl)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(googleUrl);
          } else {
            const appleUrl = `http://maps.apple.com/?saddr=${originStr}&daddr=${destStr}`;
            return Linking.openURL(appleUrl);
          }
        })
        .catch((err) => {
          console.error("Error opening navigation:", err);
          Alert.alert("Error", "Unable to open navigation. Please try again.");
        });
    } else {
      // Android
      const googleUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}&dir_action=navigate`;
      Linking.canOpenURL(googleUrl)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(googleUrl);
          } else {
            const fallbackUrl = `google.navigation:q=${currentDestination.coordinates.latitude},${currentDestination.coordinates.longitude}`;
            return Linking.openURL(fallbackUrl).catch(() => {
              Alert.alert(
                "Navigation Unavailable",
                "Please install Google Maps to start navigation."
              );
            });
          }
        })
        .catch((err) => {
          console.error("Error opening Google Maps:", err);
          Alert.alert("Error", "Unable to open Google Maps. Please try again.");
        });
    }
  };

  // Legacy function for backward compatibility
  const openNavigationToNextDestination = () => {
    updateNavigationToNextDestination();
  };

  const openGoogleMaps = (waypoints: string[]) => {
    if (!rideData) return;

    // Validate coordinates are valid numbers
    if (
      !isFinite(rideData.fromLatitude) ||
      !isFinite(rideData.fromLongitude) ||
      !isFinite(rideData.toLatitude) ||
      !isFinite(rideData.toLongitude)
    ) {
      Alert.alert("Error", "Invalid location coordinates. Please try again.");
      return;
    }

    const origin = `${rideData.fromLatitude},${rideData.fromLongitude}`;
    const destination = `${rideData.toLatitude},${rideData.toLongitude}`;

    let url = "";
    if (waypoints.length > 0) {
      const waypointsStr = waypoints.join("|");
      url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(
        waypointsStr
      )}&dir_action=navigate`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&dir_action=navigate`;
    }

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          // Fallback for Android
          const fallbackUrl =
            waypoints.length > 0
              ? `google.navigation:q=${rideData.toLatitude},${
                  rideData.toLongitude
                }&waypoints=${waypoints.join("|")}`
              : `google.navigation:q=${rideData.toLatitude},${rideData.toLongitude}`;

          return Linking.openURL(fallbackUrl).catch(() => {
            Alert.alert(
              "Navigation Unavailable",
              "Please install Google Maps to start navigation."
            );
          });
        }
      })
      .catch((err) => {
        console.error("Error opening Google Maps:", err);
        Alert.alert("Error", "Unable to open Google Maps. Please try again.");
      });
  };

  const openAppleMaps = (waypoints: string[]) => {
    if (!rideData) return;

    // Validate coordinates are valid numbers
    if (
      !isFinite(rideData.fromLatitude) ||
      !isFinite(rideData.fromLongitude) ||
      !isFinite(rideData.toLatitude) ||
      !isFinite(rideData.toLongitude)
    ) {
      Alert.alert("Error", "Invalid location coordinates. Please try again.");
      return;
    }

    // Apple Maps URL format: http://maps.apple.com/?saddr=lat,lng&daddr=lat,lng
    // For multiple waypoints, we need to chain them
    const origin = `${rideData.fromLatitude},${rideData.fromLongitude}`;
    const destination = `${rideData.toLatitude},${rideData.toLongitude}`;

    // Apple Maps doesn't support waypoints in URL, so we'll navigate to the first waypoint or destination
    // For multiple stops, user will need to navigate step by step
    let url = "";
    if (waypoints.length > 0) {
      // Navigate to first waypoint
      url = `http://maps.apple.com/?saddr=${origin}&daddr=${waypoints[0]}`;
    } else {
      url = `http://maps.apple.com/?saddr=${origin}&daddr=${destination}`;
    }

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          Alert.alert(
            "Navigation Unavailable",
            "Please install Apple Maps to start navigation."
          );
        }
      })
      .catch((err) => {
        console.error("Error opening Apple Maps:", err);
        Alert.alert("Error", "Unable to open Apple Maps. Please try again.");
      });
  };

  const handleStartRide = async () => {
    if (!rideData || !user?.id) {
      Alert.alert("Error", "Ride data or user information not available");
      return;
    }

    // Don't allow starting if already started, completed, or cancelled
    if (rideData.status === "in-progress") {
      Alert.alert("Already Started", "This ride is already in progress.");
      return;
    }

    if (rideData.status === "completed") {
      Alert.alert("Already Completed", "This ride has already been completed.");
      return;
    }

    if (rideData.status === "cancelled") {
      Alert.alert("Cannot Start", "This ride has been cancelled.");
      return;
    }

    // Check if there are any booked passengers
    if (!rideData.passengers || rideData.passengers.length === 0) {
      Alert.alert(
        "No Passengers",
        "No one has booked a seat for this ride. Would you like to cancel the ride?",
        [
          {
            text: "Keep Ride",
            style: "cancel",
          },
          {
            text: "Cancel Ride",
            style: "destructive",
            onPress: handleCancelRide,
          },
        ]
      );
      return;
    }

    try {
      // Update ride status to in-progress and send notifications to passengers
      await startRide(rideData.id, user.id);
      
      // Refresh ride data to get updated status
      const updatedRide = await getRideById(rideData.id, user.id);
      setRideData(updatedRide);

      // Update navigation destination state
      const nextPickup = updatedRide.passengers?.find(
        (p) => p.pickupStatus !== "picked_up" && p.pickupLatitude && p.pickupLongitude
      );

      if (nextPickup && nextPickup.pickupLatitude && nextPickup.pickupLongitude) {
        setCurrentDestination({
          type: "pickup",
          passengerId: nextPickup.id,
          passengerName: nextPickup.riderName || "Passenger",
          coordinates: {
            latitude: nextPickup.pickupLatitude,
            longitude: nextPickup.pickupLongitude,
          },
        });
      }

      Alert.alert(
        "Ride Started",
        nextPickup
          ? `The ride has been started. All passengers have been notified.\n\nNavigating to: ${nextPickup.riderName || "First Passenger"}`
          : "The ride has been started. All passengers have been notified.",
        [
          {
            text: "Start Navigation",
            onPress: () => {
              if (currentDestination) {
                openNavigationToCurrentDestination();
              }
            },
          },
          {
            text: "Later",
            style: "cancel",
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "Failed to start ride. Please try again."
      );
    }
  };

  const handleMarkPickedUp = (bookingId: number, passengerName: string) => {
    if (!user?.id) {
      Alert.alert("Error", "User information not available");
      return;
    }

    if (rideData?.status !== "in-progress") {
      Alert.alert("Cannot Mark Pickup", "Please start the ride first.");
      return;
    }

    setSelectedBookingId(bookingId);
    setSelectedPassengerName(passengerName);
    setPinInput("");
    setPinError(null);
    setPinModalVisible(true);
  };

  const handleVerifyPin = async () => {
    if (!selectedBookingId || !user?.id) {
      return;
    }

    if (!pinInput || pinInput.length !== 4) {
      setPinError("Please enter a 4-digit PIN");
      return;
    }

    setIsVerifyingPin(true);
    setPinError(null);

    try {
      const result = await markPassengerPickedUp(selectedBookingId, user.id, pinInput);
      
      if (result.success) {
        // Refresh ride data to get updated pickup status
        if (rideData?.id) {
          const updatedRide = await getRideById(rideData.id, user.id);
          setRideData(updatedRide);
          
          setPinModalVisible(false);
          setPinInput("");
          setPinError(null);
          
          // Update navigation to next destination (UI will automatically update)
          updateNavigationToNextDestination();
          
          // No alerts - the UI button will automatically show the next destination
          // Button will display "Navigate to [Next Passenger]" or "Navigate to Destination"
        } else {
          setPinModalVisible(false);
          setPinInput("");
          setPinError(null);
        }
      }
    } catch (error: any) {
      const apiError = error as ApiError & { attemptsRemaining?: number; status?: number };
      if (apiError.status === 401) {
        setPinError(apiError.message || "Invalid PIN");
        if (apiError.attemptsRemaining !== undefined) {
          setPinError(`${apiError.message || "Invalid PIN"} (${apiError.attemptsRemaining} attempts remaining)`);
        }
      } else if (apiError.status === 429 || apiError.status === 403) {
        setPinError(apiError.message || "Too many failed attempts. Please try again later.");
      } else {
        setPinError(apiError.message || "Failed to verify PIN. Please try again.");
      }
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleCompleteRide = () => {
    if (!rideData || !user?.id) {
      Alert.alert("Error", "Ride data or user information not available");
      return;
    }

    // Don't allow completing if already completed or cancelled
    if (rideData.status === "completed") {
      Alert.alert("Already Completed", "This ride has already been completed.");
      return;
    }

    if (rideData.status === "cancelled") {
      Alert.alert("Cannot Complete", "This ride has been cancelled.");
      return;
    }

    if (rideData.status !== "in-progress") {
      Alert.alert("Cannot Complete", "Please start the ride first.");
      return;
    }

    // Check if all passengers are picked up
    const allPickedUp = rideData.passengers?.every(
      (p) => p.pickupStatus === "picked_up"
    ) ?? true;

    if (!allPickedUp && rideData.passengers && rideData.passengers.length > 0) {
      Alert.alert(
        "Cannot Complete",
        "Please mark all passengers as picked up before completing the ride."
      );
      return;
    }

    Alert.alert(
      "Complete Ride",
      "Are you sure you have dropped off all passengers and completed the ride?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Yes, Complete",
          style: "default",
          onPress: async () => {
            try {
              const result = await completeRide(rideData.id, user.id);
              
              // Navigate to completion screen with earnings
              router.replace({
                pathname: "/ride-completion",
                params: {
                  totalEarnings: result.totalEarnings?.toString() || "0",
                  rideId: rideData.id.toString(),
                },
              });
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.message || "Failed to complete ride. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const handleCancelRide = () => {
    if (!rideData || !user?.id) {
      Alert.alert("Error", "Unable to cancel ride. Please try again.");
      return;
    }

    // Don't allow cancellation if already cancelled or completed
    if (rideData.status === "cancelled") {
      Alert.alert("Already Cancelled", "This ride has already been cancelled.");
      return;
    }

    if (rideData.status === "completed") {
      Alert.alert("Cannot Cancel", "This ride has already been completed.");
      return;
    }

    Alert.alert(
      "Cancel Ride",
      "Are you sure you want to cancel this ride? All confirmed bookings will be cancelled and passengers will be notified.",
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
              await cancelRide(rideData.id, user.id);
              Alert.alert(
                "Ride Cancelled",
                "The ride has been cancelled successfully.",
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
                error.message || "Failed to cancel ride. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical swipes
        return (
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) &&
          Math.abs(gestureState.dy) > 10
        );
      },
      onPanResponderGrant: () => {
        sheetHeight.setOffset(currentHeightRef.current);
        sheetHeight.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const newHeight = currentHeightRef.current - gestureState.dy; // Negative because we're dragging up
        // Constrain the height between collapsed and expanded
        const constrainedHeight = Math.max(
          collapsedHeight,
          Math.min(expandedHeight, newHeight)
        );
        sheetHeight.setValue(constrainedHeight - currentHeightRef.current);
      },
      onPanResponderRelease: (_, gestureState) => {
        sheetHeight.flattenOffset();
        const newHeight = currentHeightRef.current - gestureState.dy;
        const constrainedHeight = Math.max(
          collapsedHeight,
          Math.min(expandedHeight, newHeight)
        );
        currentHeightRef.current = constrainedHeight;
        const velocity = gestureState.vy;

        // Determine if we should expand or collapse based on position and velocity
        const shouldExpand =
          constrainedHeight > (collapsedHeight + expandedHeight) / 2 ||
          (velocity < -0.5 && !isExpanded);

        if (shouldExpand) {
          Animated.spring(sheetHeight, {
            toValue: expandedHeight,
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start(() => {
            currentHeightRef.current = expandedHeight;
          });
          setIsExpanded(true);
        } else {
          Animated.spring(sheetHeight, {
            toValue: collapsedHeight,
            useNativeDriver: false,
            tension: 50,
            friction: 7,
          }).start(() => {
            currentHeightRef.current = collapsedHeight;
          });
          setIsExpanded(false);
        }
      },
    })
  ).current;

  // Show loading state while fetching ride data
  if (isLoadingRide || !rideData) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Loading ride details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar style="light" />

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          style={styles.map}
          initialRegion={mapRegion}
          showsUserLocation={true}
          showsMyLocationButton={true}
          followsUserLocation={true}
          loadingEnabled={true}
        >
          {/* Route line */}
          {routeCoordinates.length > 0 ? (
            <>
              {/* Shadow/outline */}
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="rgba(66, 133, 244, 0.3)"
                strokeWidth={8}
                lineCap="round"
                lineJoin="round"
              />
              {/* Main route */}
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="#4285F4"
                strokeWidth={5}
                lineCap="round"
                lineJoin="round"
              />
            </>
          ) : rideData &&
            rideData.fromLatitude &&
            rideData.fromLongitude &&
            rideData.toLatitude &&
            rideData.toLongitude ? (
            <Polyline
              coordinates={[
                {
                  latitude: rideData.fromLatitude,
                  longitude: rideData.fromLongitude,
                },
                {
                  latitude: rideData.toLatitude,
                  longitude: rideData.toLongitude,
                },
              ]}
              strokeColor="#4285F4"
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
              lineDashPattern={[10, 5]}
            />
          ) : null}

          {/* Pickup marker - Small Car Icon */}
          {rideData && rideData.fromLatitude && rideData.fromLongitude && (
            <Marker
              coordinate={{
                latitude: rideData.fromLatitude,
                longitude: rideData.fromLongitude,
              }}
              title="Pickup"
              description={rideData.fromAddress}
            >
              <View style={styles.markerContainer}>
                <View style={styles.carMarker}>
                  <IconSymbol size={16} name="car" color="#FFFFFF" />
                </View>
              </View>
            </Marker>
          )}

          {/* Passenger pickup markers */}
          {rideData &&
            rideData.passengers &&
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
                  title={`Passenger ${index + 1} Pickup${
                    passenger.riderName ? ` - ${passenger.riderName}` : ""
                  }`}
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

          {/* Destination marker - Small Flag Icon */}
          {rideData && rideData.toLatitude && rideData.toLongitude && (
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
                <View style={styles.markerPin} />
              </View>
            </Marker>
          )}
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
            activeOpacity={0.7}
          >
            <IconSymbol size={24} name="chevron.left" color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Current Ride</Text>
          <View style={styles.backButton} />
        </View>

        {/* Bottom ride info card - Swipeable */}
        <Animated.View
          style={[
            styles.rideInfoCard,
            {
              height: sheetHeight,
              maxHeight: expandedHeight,
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandle}>
            <View style={styles.dragHandleBar} />
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
          </Animated.ScrollView>
        </Animated.View>
      </View>

      {/* PIN Modal */}
      <Modal
        visible={pinModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (!isVerifyingPin) {
            setPinModalVisible(false);
            setPinInput("");
            setPinError(null);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Passenger PIN</Text>
            <Text style={styles.modalSubtitle}>
              Please ask {selectedPassengerName} for their 4-digit pickup PIN
            </Text>
            
            <TextInput
              style={styles.pinInput}
              value={pinInput}
              onChangeText={(text) => {
                // Only allow digits and limit to 4 characters
                const numericText = text.replace(/[^0-9]/g, '').slice(0, 4);
                setPinInput(numericText);
                setPinError(null);
              }}
              placeholder="0000"
              keyboardType="number-pad"
              maxLength={4}
              autoFocus={true}
              editable={!isVerifyingPin}
            />
            
            {pinError && (
              <Text style={styles.pinError}>{pinError}</Text>
            )}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  if (!isVerifyingPin) {
                    setPinModalVisible(false);
                    setPinInput("");
                    setPinError(null);
                  }
                }}
                disabled={isVerifyingPin}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonConfirm,
                  (pinInput.length !== 4 || isVerifyingPin) && styles.modalButtonDisabled
                ]}
                onPress={handleVerifyPin}
                disabled={pinInput.length !== 4 || isVerifyingPin}
              >
                {isVerifyingPin ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonConfirmText}>Verify & Pickup</Text>
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
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
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
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  rideInfoCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#0A0A0A",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000000",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4285F4",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  etaText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4285F4",
  },
  routeInfo: {
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  routeMarker: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4285F4",
    marginTop: 6,
    marginRight: 10,
  },
  routeMarkerDest: {
    backgroundColor: "#FF3B30",
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: "#2A2A2A",
    marginLeft: 3,
    marginVertical: 2,
  },
  routeContent: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
    opacity: 0.5,
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  routeAddress: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
    lineHeight: 18,
  },
  statsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#1A1A1A",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    minWidth: "45%",
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
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1A1A1A",
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  actionButtonFull: {
    flex: 1,
    minWidth: "100%",
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  actionButtonPrimary: {
    backgroundColor: "#4285F4",
    borderColor: "#4285F4",
  },
  actionButtonSuccess: {
    backgroundColor: "#34C759",
    borderColor: "#34C759",
  },
  actionButtonWarning: {
    backgroundColor: "#FF9500",
    borderColor: "#FF9500",
  },
  actionButtonTextPrimary: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  carMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#4285F4",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  destinationMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EA4335",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  markerPin: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#EA4335",
    marginTop: -2,
  },
  passengerMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FFA500",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },
  passengerRouteMarker: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFA500",
    marginTop: 6,
    marginRight: 12,
  },
  passengersSection: {
    marginBottom: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#1A1A1A",
  },
  passengersSectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 12,
    opacity: 0.7,
  },
  passengerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#1A1A1A",
    borderRadius: 10,
  },
  passengerInfo: {
    flex: 1,
    marginRight: 12,
  },
  passengerNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  passengerName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    flex: 1,
  },
  pickedUpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(52, 199, 89, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pickedUpText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#34C759",
  },
  pendingBadge: {
    backgroundColor: "rgba(255, 149, 0, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FF9500",
  },
  pickedUpTime: {
    fontSize: 12,
    color: "#999999",
    marginTop: 2,
  },
  passengerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pickupButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#4285F4",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pickupButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  pickedUpButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(52, 199, 89, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pickedUpButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#34C759",
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
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: "#2A2A2C",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#999999",
    marginBottom: 24,
    textAlign: "center",
  },
  pinInput: {
    backgroundColor: "#0F0F0F",
    borderWidth: 2,
    borderColor: "#2A2A2C",
    borderRadius: 12,
    padding: 16,
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 8,
    marginBottom: 12,
  },
  pinError: {
    fontSize: 13,
    color: "#FF3B30",
    textAlign: "center",
    marginBottom: 16,
    minHeight: 20,
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
  modalButtonCancel: {
    backgroundColor: "#2A2A2C",
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  modalButtonConfirm: {
    backgroundColor: "#4285F4",
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(66, 133, 244, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  messageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(66, 133, 244, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  routeCityState: {
    fontSize: 12,
    fontWeight: "400",
    color: "#FFFFFF",
    opacity: 0.6,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#999999",
    marginTop: 8,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 16,
    marginTop: 16,
    opacity: 0.7,
  },
  cancelButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.3)",
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FF3B30",
  },
  bottomActionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  emergencyButton: {
    justifyContent: "center",
    alignItems: "center",
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FF3B30",
  },
  emergencyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  distanceEtaContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    gap: 8,
  },
  distanceEtaText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#999999",
  },
  progressContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#1A1A1A",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#4285F4",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#999999",
    textAlign: "center",
  },
  passengerEtaContainer: {
    marginTop: 4,
  },
  passengerEtaText: {
    fontSize: 11,
    fontWeight: "400",
    color: "#666666",
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#FF3B30",
    borderRadius: 8,
    marginTop: 12,
  },
  offlineText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
