import { type Ride } from "@/services/api";

/**
 * Calculate distance between two coordinates using Haversine formula (returns miles)
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 3959; // Radius of the Earth in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in miles
  return distance;
};

/**
 * Calculate total distance for a ride including all passenger pickups
 * Route: Origin → Passenger Pickup 1 → Passenger Pickup 2 → ... → Destination
 */
export const calculateTotalDistance = (ride: Ride): number => {
  if (
    !ride.fromLatitude ||
    !ride.fromLongitude ||
    !ride.toLatitude ||
    !ride.toLongitude
  ) {
    // Fallback to stored distance if coordinates are missing
    return ride.distance || 0;
  }

  let totalDistance = 0;
  let currentLat = ride.fromLatitude;
  let currentLon = ride.fromLongitude;

  // Add distance from origin to each passenger pickup
  if (ride.passengers && ride.passengers.length > 0) {
    ride.passengers.forEach((passenger) => {
      if (passenger.pickupLatitude && passenger.pickupLongitude) {
        totalDistance += calculateDistance(
          currentLat,
          currentLon,
          passenger.pickupLatitude,
          passenger.pickupLongitude
        );
        // Update current position to passenger pickup location
        currentLat = passenger.pickupLatitude;
        currentLon = passenger.pickupLongitude;
      }
    });
  }

  // Add distance from last pickup (or origin if no passengers) to destination
  totalDistance += calculateDistance(
    currentLat,
    currentLon,
    ride.toLatitude,
    ride.toLongitude
  );

  return totalDistance;
};

/**
 * Calculate distance between two coordinates in meters using Haversine formula
 */
export const calculateDistanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000; // Radius of the Earth in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};
