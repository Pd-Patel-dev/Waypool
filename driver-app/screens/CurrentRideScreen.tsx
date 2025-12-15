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
import { type Ride, getRideById, cancelRide, startRide, completeRide } from "@/services/api";
import { useUser } from "@/context/UserContext";

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
  const hasFetchedRef = useRef(false); // Track if we've already fetched
  const appStateRef = useRef(AppState.currentState);
  const navigationOpenedRef = useRef(false); // Track if navigation was opened

  // Swipeable bottom sheet state
  const screenHeight = Dimensions.get("window").height;
  const collapsedHeight = 260; // Height when collapsed (reduced to fit content)
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
        
        // Refresh ride data
        try {
          if (rideData.id && user?.id) {
            const updatedRide = await getRideById(rideData.id, user.id);
            setRideData(updatedRide);
            
            // Reset navigation flag
            navigationOpenedRef.current = false;
            
            // Show prompt to complete ride if still in-progress
            if (updatedRide.status === "in-progress") {
              Alert.alert(
                "Welcome Back",
                "Have you reached the destination and dropped off all passengers?",
                [
                  {
                    text: "Not Yet",
                    style: "cancel",
                  },
                  {
                    text: "Yes, Complete Ride",
                    style: "default",
                    onPress: handleCompleteRide,
                  },
                ]
              );
            }
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

      // Build URL with waypoints if available
      let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}`;

      // Add waypoints if there are passenger pickups
      if (waypoints && waypoints.length > 0) {
        const waypointsStr = waypoints
          .map((wp) => `${wp.latitude},${wp.longitude}`)
          .join("|");
        url += `&waypoints=${encodeURIComponent(waypointsStr)}`;
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

  // Get current location
  useEffect(() => {
    (async () => {
      if (Location && Platform.OS !== "web") {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            setLocationError("Location permission denied");
            return;
          }

          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          setLocation({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          });

          // Watch position for real-time updates
          Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 5000,
              distanceInterval: 10,
            },
            (newLocation: any) => {
              setLocation({
                latitude: newLocation.coords.latitude,
                longitude: newLocation.coords.longitude,
              });
            }
          );
        } catch (error) {
          console.error("Error getting location:", error);
          setLocationError("Failed to get location");
        }
      }
    })();
  }, []);

  // Fetch route when ride data is available (including passenger pickups)
  useEffect(() => {
    if (
      rideData &&
      rideData.fromLatitude &&
      rideData.fromLongitude &&
      rideData.toLatitude &&
      rideData.toLongitude
    ) {
      // Collect passenger pickup locations as waypoints
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

      // Fetch route with waypoints
      fetchRoute(
        { latitude: rideData.fromLatitude, longitude: rideData.fromLongitude },
        { latitude: rideData.toLatitude, longitude: rideData.toLongitude },
        waypoints.length > 0 ? waypoints : undefined
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rideData?.id,
    rideData?.fromLatitude,
    rideData?.fromLongitude,
    rideData?.toLatitude,
    rideData?.toLongitude,
    rideData?.passengers,
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

  const openGoogleMaps = (waypoints: string[]) => {
    if (!rideData) return;

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

      Alert.alert(
        "Ride Started",
        "The ride has been started. All passengers have been notified.",
        [
          {
            text: "OK",
            onPress: () => {
              // Build waypoints for navigation
              const waypoints: string[] = [];

              // Add passenger pickup locations as waypoints
              if (updatedRide.passengers && updatedRide.passengers.length > 0) {
                updatedRide.passengers.forEach((passenger) => {
                  if (passenger.pickupLatitude && passenger.pickupLongitude) {
                    waypoints.push(
                      `${passenger.pickupLatitude},${passenger.pickupLongitude}`
                    );
                  }
                });
              }

              // Mark that navigation was opened
              navigationOpenedRef.current = true;

              // Open navigation after starting ride
              if (Platform.OS === "ios") {
                const googleUrl =
                  waypoints.length > 0
                    ? `https://www.google.com/maps/dir/?api=1&origin=${
                        updatedRide.fromLatitude
                      },${updatedRide.fromLongitude}&destination=${updatedRide.toLatitude},${
                        updatedRide.toLongitude
                      }&waypoints=${encodeURIComponent(
                        waypoints.join("|")
                      )}&dir_action=navigate`
                    : `https://www.google.com/maps/dir/?api=1&origin=${updatedRide.fromLatitude},${updatedRide.fromLongitude}&destination=${updatedRide.toLatitude},${updatedRide.toLongitude}&dir_action=navigate`;

                Linking.canOpenURL(googleUrl)
                  .then((supported) => {
                    if (supported) {
                      return Linking.openURL(googleUrl);
                    } else {
                      return openAppleMaps(waypoints);
                    }
                  })
                  .catch(() => {
                    openAppleMaps(waypoints);
                  });
              } else {
                openGoogleMaps(waypoints);
              }
            },
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
            {/* Collapsed State - Simple layout */}
            {!isExpanded && (
              <>
                {/* Passenger Count */}
                {rideData.passengers && rideData.passengers.length > 0 && (
                  <View style={styles.passengerCountContainer}>
                    <IconSymbol
                      size={18}
                      name="person.2.fill"
                      color="#4285F4"
                    />
                    <Text style={styles.passengerCountText}>
                      {rideData.passengers.length} passenger
                      {rideData.passengers.length !== 1 ? "s" : ""} to pickup
                    </Text>
                  </View>
                )}

                {/* Pickup */}
                <View style={styles.collapsedRoutePoint}>
                  <View style={styles.collapsedRouteMarker} />
                  <View style={styles.collapsedRouteContent}>
                    <Text style={styles.collapsedRouteLabel}>PICKUP</Text>
                    <Text
                      style={styles.collapsedRouteAddress}
                      numberOfLines={2}
                    >
                      {rideData.fromAddress}
                    </Text>
                  </View>
                </View>

                {/* Destination */}
                <View style={styles.collapsedRoutePoint}>
                  <View
                    style={[
                      styles.collapsedRouteMarker,
                      styles.collapsedRouteMarkerDest,
                    ]}
                  />
                  <View style={styles.collapsedRouteContent}>
                    <Text style={styles.collapsedRouteLabel}>DESTINATION</Text>
                    <Text
                      style={styles.collapsedRouteAddress}
                      numberOfLines={2}
                    >
                      {rideData.toAddress}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  {rideData.status === "in-progress" ? (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionButtonSuccess]}
                      activeOpacity={0.7}
                      onPress={handleCompleteRide}
                    >
                      <Text style={styles.actionButtonTextPrimary}>
                        Complete Ride
                      </Text>
                    </TouchableOpacity>
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

                {/* Cancel Ride Button */}
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
                    {rideData.passengers.map((passenger, index) => (
                      <View
                        key={`passenger-info-${passenger.id || index}`}
                        style={styles.passengerItem}
                      >
                        <View style={styles.passengerInfo}>
                          <Text style={styles.passengerName}>
                            {passenger.riderName || `Passenger ${index + 1}`}
                          </Text>
                        </View>
                        <View style={styles.passengerActions}>
                          {passenger.riderPhone && (
                            <TouchableOpacity
                              style={styles.callButton}
                              activeOpacity={0.7}
                              onPress={() => {
                                // TODO: Implement call functionality
                                console.log(
                                  "Call passenger:",
                                  passenger.riderName ||
                                    `Passenger ${index + 1}`,
                                  passenger.riderPhone
                                );
                              }}
                            >
                              <IconSymbol
                                size={18}
                                name="phone.fill"
                                color="#4285F4"
                              />
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={styles.messageButton}
                            activeOpacity={0.7}
                            onPress={() => {
                              // TODO: Implement message functionality
                              console.log(
                                "Message passenger:",
                                passenger.riderName || `Passenger ${index + 1}`
                              );
                            }}
                          >
                            <IconSymbol
                              size={18}
                              name="message.fill"
                              color="#4285F4"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Action Buttons - In expanded view */}
                <View style={styles.actionButtons}>
                  {rideData.status === "in-progress" ? (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionButtonSuccess]}
                      activeOpacity={0.7}
                      onPress={handleCompleteRide}
                    >
                      <Text style={styles.actionButtonTextPrimary}>
                        Complete Ride
                      </Text>
                    </TouchableOpacity>
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
  },
  map: {
    flex: 1,
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
    paddingHorizontal: 20,
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
  collapsedRoutePoint: {
    flexDirection: "row",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  collapsedRouteMarker: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4285F4",
    marginRight: 12,
    marginTop: 6,
  },
  collapsedRouteMarkerDest: {
    backgroundColor: "#EA4335",
  },
  collapsedRouteContent: {
    flex: 1,
  },
  collapsedRouteLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#999999",
    letterSpacing: 1,
    marginBottom: 4,
  },
  collapsedRouteAddress: {
    fontSize: 15,
    fontWeight: "500",
    color: "#FFFFFF",
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
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
  passengerName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  passengerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.3)",
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FF3B30",
  },
});
