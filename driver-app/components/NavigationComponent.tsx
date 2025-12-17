import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from "react-native-maps";
import * as Location from "expo-location";

interface NavigationStep {
  distance: string;
  duration: string;
  instruction: string;
  maneuver?: string;
  endLocation: {
    latitude: number;
    longitude: number;
  };
}

interface NavigationComponentProps {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  waypoints?: { latitude: number; longitude: number }[];
  onNavigationComplete?: () => void;
  onCancel?: () => void;
}

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
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
};

// Calculate distance between two coordinates
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Radius of the Earth in kilometers
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

export default function NavigationComponent({
  origin,
  destination,
  waypoints = [],
  onNavigationComplete,
  onCancel,
}: NavigationComponentProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState<NavigationStep[]>([]);
  const [routeCoordinates, setRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [distanceToNextTurn, setDistanceToNextTurn] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [totalDistance, setTotalDistance] = useState<string>("");
  const [totalDuration, setTotalDuration] = useState<string>("");
  const mapRef = useRef<MapView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // Fetch route and directions from Google Directions API
  const fetchDirections = useCallback(async () => {
    setIsLoading(true);
    try {
      const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || "";
      if (!GOOGLE_API_KEY) {
        throw new Error("Google Maps API key is not configured");
      }

      let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}`;

      if (waypoints.length > 0) {
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
        const allSteps: NavigationStep[] = [];
        let allPoints: { latitude: number; longitude: number }[] = [];
        let totalDistanceMeters = 0;
        let totalDurationSeconds = 0;

        // Process all legs (origin -> waypoint1 -> waypoint2 -> ... -> destination)
        route.legs.forEach((leg: any) => {
          if (leg.distance && leg.distance.value) {
            totalDistanceMeters += leg.distance.value;
          }
          if (leg.duration && leg.duration.value) {
            totalDurationSeconds += leg.duration.value;
          }

          // Process steps in this leg
          if (leg.steps) {
            leg.steps.forEach((step: any) => {
              // Extract instruction text (remove HTML tags)
              const instruction = step.html_instructions
                .replace(/<[^>]*>/g, "")
                .replace(/&nbsp;/g, " ")
                .trim();

              allSteps.push({
                distance: step.distance?.text || "",
                duration: step.duration?.text || "",
                instruction,
                maneuver: step.maneuver || undefined,
                endLocation: {
                  latitude: step.end_location.lat,
                  longitude: step.end_location.lng,
                },
              });

              // Decode polyline for this step
              if (step.polyline && step.polyline.points) {
                const stepPoints = decodePolyline(step.polyline.points);
                allPoints = allPoints.concat(stepPoints);
              }
            });
          }
        });

        // If no detailed steps, use overview polyline
        if (allPoints.length === 0 && route.overview_polyline?.points) {
          allPoints = decodePolyline(route.overview_polyline.points);
        }

        setSteps(allSteps);
        setRouteCoordinates(allPoints);

        // Format total distance and duration
        const distanceMiles = totalDistanceMeters / 1609.34;
        setTotalDistance(`${distanceMiles.toFixed(1)} mi`);
        const hours = Math.floor(totalDurationSeconds / 3600);
        const minutes = Math.floor((totalDurationSeconds % 3600) / 60);
        if (hours > 0) {
          setTotalDuration(`${hours}h ${minutes}m`);
        } else {
          setTotalDuration(`${minutes}m`);
        }
      } else {
        throw new Error("Failed to get directions");
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  }, [origin, destination, waypoints]);

  // Start navigation
  const startNavigation = async () => {
    // Request location permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      alert("Location permission is required for navigation");
      return;
    }

    // Fetch directions first
    await fetchDirections();

    // Get current location
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    setCurrentLocation({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });

    // Watch position updates
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000, // Update every 3 seconds
        distanceInterval: 10, // Update every 10 meters
      },
      (newLocation) => {
        const newCoords = {
          latitude: newLocation.coords.latitude,
          longitude: newLocation.coords.longitude,
        };
        setCurrentLocation(newCoords);

        // Update map to follow user
        if (mapRef.current) {
          mapRef.current.animateToRegion(
            {
              ...newCoords,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            1000
          );
        }

        // Check if we've reached the current step
        if (steps.length > 0 && currentStepIndex < steps.length) {
          const currentStep = steps[currentStepIndex];
          const distance = calculateDistance(
            newCoords.latitude,
            newCoords.longitude,
            currentStep.endLocation.latitude,
            currentStep.endLocation.longitude
          );

          setDistanceToNextTurn(distance);

          // If within 50 meters of step end, move to next step
          if (distance < 0.05 && currentStepIndex < steps.length - 1) {
            setCurrentStepIndex(currentStepIndex + 1);
          } else if (
            distance < 0.05 &&
            currentStepIndex === steps.length - 1
          ) {
            // Reached destination
            stopNavigation();
            onNavigationComplete?.();
          }
        }
      }
    );

    setIsNavigating(true);
  };

  // Stop navigation
  const stopNavigation = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    setIsNavigating(false);
    setCurrentStepIndex(0);
    setDistanceToNextTurn(null);
  };

  // Get maneuver icon
  const getManeuverIcon = (maneuver?: string): any => {
    if (!maneuver) return "arrow.up";
    const maneuverLower = maneuver.toLowerCase();
    if (maneuverLower.includes("turn-left")) return "arrow.turn.up.left";
    if (maneuverLower.includes("turn-right")) return "arrow.turn.up.right";
    if (maneuverLower.includes("straight")) return "arrow.up";
    if (maneuverLower.includes("uturn") || maneuverLower.includes("u-turn"))
      return "arrow.uturn.down";
    if (maneuverLower.includes("ramp")) return "arrow.up.right";
    return "arrow.up";
  };

  // Format distance for display
  const formatDistance = (distance: number): string => {
    if (distance < 0.1) {
      return `${Math.round(distance * 1000)}m`;
    } else if (distance < 1) {
      return `${(distance * 1000).toFixed(0)}m`;
    } else {
      return `${distance.toFixed(1)}mi`;
    }
  };

  // Initialize: fetch directions when component mounts
  useEffect(() => {
    fetchDirections();
    return () => {
      stopNavigation();
    };
  }, [fetchDirections]);

  const currentStep = steps[currentStepIndex];
  const mapRegion: Region = currentLocation
    ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : {
        latitude: origin.latitude,
        longitude: origin.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        initialRegion={mapRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
        followsUserLocation={isNavigating}
        loadingEnabled={true}
      >
        {/* Route line */}
        {routeCoordinates.length > 0 && (
          <>
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="rgba(66, 133, 244, 0.3)"
              strokeWidth={8}
              lineCap="round"
              lineJoin="round"
            />
            <Polyline
              coordinates={routeCoordinates}
              strokeColor="#4285F4"
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          </>
        )}

        {/* Origin marker */}
        <Marker coordinate={origin} title="Start" pinColor="#4285F4" />

        {/* Waypoint markers */}
        {waypoints.map((waypoint, index) => (
          <Marker
            key={`waypoint-${index}`}
            coordinate={waypoint}
            title={`Stop ${index + 1}`}
            pinColor="#FF9500"
          />
        ))}

        {/* Destination marker */}
        <Marker coordinate={destination} title="Destination" pinColor="#FF3B30" />

        {/* Current step marker */}
        {currentStep && (
          <Marker
            coordinate={currentStep.endLocation}
            title="Next Turn"
            pinColor="#34C759"
          />
        )}
      </MapView>

      {/* Navigation Card */}
      <View style={styles.navigationCard}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4285F4" />
            <Text style={styles.loadingText}>Loading directions...</Text>
          </View>
        ) : (
          <>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Text style={styles.headerTitle}>
                  {isNavigating ? "Navigating" : "Ready to Navigate"}
                </Text>
                {totalDistance && totalDuration && (
                  <Text style={styles.headerSubtitle}>
                    {totalDistance} • {totalDuration}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onCancel}
                activeOpacity={0.7}
              >
                <IconSymbol name="xmark" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Current Step (when navigating) */}
            {isNavigating && currentStep && (
              <View style={styles.currentStepCard}>
                <View style={styles.currentStepHeader}>
                  <View style={styles.maneuverIcon}>
                    <IconSymbol
                      name={getManeuverIcon(currentStep.maneuver)}
                      size={32}
                      color="#4285F4"
                    />
                  </View>
                  <View style={styles.currentStepInfo}>
                    <Text style={styles.currentStepDistance}>
                      {distanceToNextTurn !== null
                        ? formatDistance(distanceToNextTurn)
                        : currentStep.distance}
                    </Text>
                    <Text style={styles.currentStepInstruction} numberOfLines={2}>
                      {currentStep.instruction}
                    </Text>
                  </View>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${((currentStepIndex + 1) / steps.length) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  Step {currentStepIndex + 1} of {steps.length}
                </Text>
              </View>
            )}

            {/* Steps List */}
            {!isNavigating && steps.length > 0 && (
              <ScrollView
                style={styles.stepsList}
                showsVerticalScrollIndicator={true}
              >
                {steps.map((step, index) => (
                  <View
                    key={index}
                    style={[
                      styles.stepItem,
                      index === currentStepIndex && styles.stepItemActive,
                    ]}
                  >
                    <View style={styles.stepIcon}>
                      <IconSymbol
                        name={getManeuverIcon(step.maneuver)}
                        size={20}
                        color={
                          index === currentStepIndex ? "#4285F4" : "#999999"
                        }
                      />
                    </View>
                    <View style={styles.stepContent}>
                      <Text
                        style={[
                          styles.stepInstruction,
                          index === currentStepIndex && styles.stepInstructionActive,
                        ]}
                      >
                        {step.instruction}
                      </Text>
                      <Text style={styles.stepDistance}>
                        {step.distance} • {step.duration}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              {!isNavigating ? (
                <TouchableOpacity
                  style={styles.startButton}
                  onPress={startNavigation}
                  activeOpacity={0.8}
                >
                  <IconSymbol name="play.fill" size={20} color="#FFFFFF" />
                  <Text style={styles.startButtonText}>Start Navigation</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.stopButton}
                  onPress={stopNavigation}
                  activeOpacity={0.8}
                >
                  <IconSymbol name="stop.fill" size={20} color="#FFFFFF" />
                  <Text style={styles.stopButtonText}>Stop Navigation</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  map: {
    flex: 1,
  },
  navigationCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "50%",
    borderTopWidth: 1,
    borderTopColor: "#2A2A2C",
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 14,
    marginTop: 12,
    opacity: 0.7,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#999999",
    fontWeight: "500",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2A2A2C",
    alignItems: "center",
    justifyContent: "center",
  },
  currentStepCard: {
    backgroundColor: "#0F0F0F",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2A2A2C",
  },
  currentStepHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  maneuverIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(66, 133, 244, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  currentStepInfo: {
    flex: 1,
  },
  currentStepDistance: {
    fontSize: 24,
    fontWeight: "800",
    color: "#4285F4",
    marginBottom: 4,
  },
  currentStepInstruction: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    lineHeight: 22,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#2A2A2C",
    borderRadius: 2,
    marginBottom: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#4285F4",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: "#999999",
    textAlign: "center",
  },
  stepsList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#2A2A2C",
  },
  stepItemActive: {
    backgroundColor: "rgba(66, 133, 244, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2A2A2C",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stepContent: {
    flex: 1,
  },
  stepInstruction: {
    fontSize: 14,
    fontWeight: "500",
    color: "#FFFFFF",
    marginBottom: 4,
    lineHeight: 20,
  },
  stepInstructionActive: {
    color: "#4285F4",
    fontWeight: "600",
  },
  stepDistance: {
    fontSize: 12,
    color: "#999999",
  },
  actionsContainer: {
    marginTop: 8,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4285F4",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  stopButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF3B30",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  stopButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

