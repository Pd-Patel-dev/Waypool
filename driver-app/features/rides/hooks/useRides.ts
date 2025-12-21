import { useState, useEffect, useCallback, useMemo } from "react";
import { router } from "expo-router";
import { useUser } from "@/context/UserContext";
import { RideApplicationService } from "../application/services/RideApplicationService";
import { createRideRepository } from "../infrastructure/RideRepositoryFactory";
import { LocationService } from "../services/locationService";
import { RideDomainService } from "../domain/services/RideDomainService";
import { RideStatusService } from "../domain/services/RideStatusService";
import { HapticFeedback } from "@/utils/haptics";
import type { RideEntity, RideFilters } from "../domain/entities/Ride.entity";
import type { Ride } from "@/services/api";

// Create service instance (singleton pattern)
const rideRepository = createRideRepository();
const rideApplicationService = new RideApplicationService(rideRepository);

export interface UseRidesOptions {
  autoFetch?: boolean;
  refreshInterval?: number;
}

export interface UseRidesReturn {
  // Data
  rides: Ride[];
  isLoading: boolean;
  error: string | null;
  refreshing: boolean;

  // Location
  currentCity: string | null;
  currentState: string | null;
  currentLocation: { latitude: number; longitude: number } | null;
  locationError: string | null;

  // Computed
  greeting: string;
  currentRide: Ride | null;
  todaysRides: Ride[];
  upcomingRides: Ride[];
  filteredRides: Ride[];
  sortedRides: Ride[];

  // Actions
  fetchRides: () => Promise<void>;
  onRefresh: () => Promise<void>;
  deleteRide: (rideId: number) => Promise<void>;
  handleRidePress: (rideId: number) => void;
  handleAddRide: () => void;

  // Filters
  filterStatus: "all" | "scheduled" | "in-progress" | "completed";
  setFilterStatus: (
    status: "all" | "scheduled" | "in-progress" | "completed"
  ) => void;
  sortBy: "date" | "distance" | "earnings";
  setSortBy: (sort: "date" | "distance" | "earnings") => void;
}

// Helper to convert domain entity to API format
function entityToApiRide(entity: RideEntity): Ride {
  return {
    id: entity.id,
    driverId: entity.driverId,
    fromAddress: entity.fromAddress,
    toAddress: entity.toAddress,
    fromLatitude: entity.fromLatitude,
    fromLongitude: entity.fromLongitude,
    toLatitude: entity.toLatitude,
    toLongitude: entity.toLongitude,
    departureTime: entity.departureTime.toISOString(),
    departureDate: entity.departureTime.toISOString().split("T")[0],
    pricePerSeat: entity.pricePerSeat,
    price: entity.pricePerSeat,
    totalSeats: entity.totalSeats,
    availableSeats: entity.availableSeats,
    distance: entity.distance,
    status: entity.status,
    passengers: entity.passengers.map((p) => ({
      id: p.id,
      riderId: p.riderId,
      rideId: p.rideId,
      numberOfSeats: p.numberOfSeats,
      pickupAddress: p.pickupAddress,
      pickupLatitude: p.pickupLatitude,
      pickupLongitude: p.pickupLongitude,
      status: p.status,
    })),
  } as Ride;
}

export function useRides(options: UseRidesOptions = {}): UseRidesReturn {
  const { user } = useUser();
  const { autoFetch = true, refreshInterval } = options;

  // State
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<
    "all" | "scheduled" | "in-progress" | "completed"
  >("all");
  const [sortBy, setSortBy] = useState<"date" | "distance" | "earnings">(
    "date"
  );

  // Location state
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [currentState, setCurrentState] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Fetch rides using application service
  const fetchRides = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const filters: RideFilters = {
        status: filterStatus === "all" ? undefined : filterStatus,
        sortBy,
      };

      const response = await rideApplicationService.getRides(user.id, filters);

      // Convert domain entities to API format
      const apiRides = response.rides.map(entityToApiRide);
      setRides(apiRides);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch rides";
      setError(errorMessage);
      console.error("Error fetching rides:", err);
      // Clear rides on error to prevent showing stale data
      setRides([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, filterStatus, sortBy]);

  // Initialize location
  useEffect(() => {
    let mounted = true;

    const initializeLocation = async () => {
      try {
        console.log('📍 [Location] Requesting location permission...');
        const hasPermission = await LocationService.requestPermissions();
        if (!hasPermission) {
          console.warn('📍 [Location] Permission denied');
          if (mounted) setLocationError("Location permission denied");
          return;
        }

        console.log('📍 [Location] Getting current location...');
        const location = await LocationService.getCurrentLocation();
        console.log('📍 [Location] Got coordinates:', location.latitude, location.longitude);
        
        if (mounted) {
          setCurrentLocation(location);
        }

        console.log('📍 [Location] Reverse geocoding...');
        const locationInfo = await LocationService.reverseGeocode(
          location.latitude,
          location.longitude
        );
        console.log('📍 [Location] Reverse geocode result:', locationInfo);

        if (mounted && locationInfo) {
          if (locationInfo.city) {
            console.log('📍 [Location] Setting city:', locationInfo.city);
            setCurrentCity(locationInfo.city);
          }
          if (locationInfo.state) {
            console.log('📍 [Location] Setting state:', locationInfo.state);
            setCurrentState(locationInfo.state);
          }
        } else {
          console.warn('📍 [Location] No location info returned from reverse geocode');
        }
      } catch (err) {
        console.error('📍 [Location] Error:', err);
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : "Location error";
          setLocationError(errorMessage);
          console.error('📍 [Location] Error setting location:', errorMessage);
        }
      }
    };

    initializeLocation();

    return () => {
      mounted = false;
    };
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchRides();
    }
  }, [autoFetch, fetchRides]);

  // Refresh interval
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(() => {
      fetchRides();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, fetchRides]);

  // Computed values
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  // Convert to entities for domain service operations
  const rideEntities = useMemo(() => {
    return rides.map((ride) => ({
      ...ride,
      departureTime: new Date(ride.departureTime),
      status: (ride.status || "scheduled") as RideEntity["status"],
      passengers: (ride.passengers || []).map((p) => ({
        id: p.id,
        riderId: p.riderId || 0,
        rideId: ride.id, // Use ride.id from parent
        numberOfSeats: p.numberOfSeats || 1,
        pickupAddress: p.pickupAddress,
        pickupLatitude: p.pickupLatitude,
        pickupLongitude: p.pickupLongitude,
        status: (p.status || "pending") as any,
      })),
    })) as RideEntity[];
  }, [rides]);

  const currentRideEntity = useMemo(
    () => RideDomainService.getActiveRide(rideEntities),
    [rideEntities]
  );

  const currentRide = useMemo(
    () => (currentRideEntity ? entityToApiRide(currentRideEntity) : null),
    [currentRideEntity]
  );

  const filteredRides = useMemo(() => {
    const filtered = RideDomainService.filterByStatus(
      rideEntities,
      filterStatus
    );
    return filtered.map(entityToApiRide);
  }, [rideEntities, filterStatus]);

  const sortedRides = useMemo(() => {
    const sorted = RideDomainService.sortRides(
      filteredRides.map((r) => ({
        ...r,
        departureTime: new Date(r.departureTime),
        status: (r.status || "scheduled") as RideEntity["status"],
        passengers: (r.passengers || []).map((p) => ({
          id: p.id,
          riderId: p.riderId || 0,
          rideId: r.id, // Use r.id from parent
          numberOfSeats: p.numberOfSeats || 1,
          pickupAddress: p.pickupAddress,
          pickupLatitude: p.pickupLatitude,
          pickupLongitude: p.pickupLongitude,
          status: (p.status || "pending") as any,
        })),
      })) as RideEntity[],
      sortBy,
      currentLocation // Pass current location for distance sorting
    );
    return sorted.map(entityToApiRide);
  }, [filteredRides, sortBy, currentLocation]);

  const { today, upcoming } = useMemo(() => {
    const separated = RideDomainService.separateByDate(
      sortedRides.map((r) => ({
        ...r,
        departureTime: new Date(r.departureTime),
        status: (r.status || "scheduled") as RideEntity["status"],
        passengers: (r.passengers || []).map((p) => ({
          id: p.id,
          riderId: p.riderId || 0,
          rideId: r.id, // Use r.id from parent
          numberOfSeats: p.numberOfSeats || 1,
          pickupAddress: p.pickupAddress,
          pickupLatitude: p.pickupLatitude,
          pickupLongitude: p.pickupLongitude,
          status: (p.status || "pending") as any,
        })),
      })) as RideEntity[]
    );
    return {
      today: separated.today.map(entityToApiRide),
      upcoming: separated.upcoming.map(entityToApiRide),
    };
  }, [sortedRides]);

  // Filter out in-progress rides from today's rides (they're shown in ActiveRideCard)
  const todaysRides = useMemo(() => {
    return today.filter((ride) => ride.status !== "in-progress");
  }, [today]);
  const upcomingRides = upcoming;

  // Actions
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    HapticFeedback.selection();
    await fetchRides();
    HapticFeedback.success();
  }, [fetchRides]);

  const deleteRideAction = useCallback(
    async (rideId: number) => {
      if (!user?.id) return;

      try {
        const response = await rideApplicationService.deleteRide(
          rideId,
          user.id
        );
        if (response.success) {
          // Remove from local state
          setRides((prev) => prev.filter((r) => r.id !== rideId));
          HapticFeedback.success();
        } else {
          throw new Error(response.message);
        }
      } catch (err) {
        HapticFeedback.error();
        throw err;
      }
    },
    [user?.id]
  );

  const handleRidePress = useCallback(
    (rideId: number) => {
      // Find the ride from the rides array
      const ride = rides.find((r) => r.id === rideId);
      if (!ride) {
        return;
      }

      // For in-progress rides, navigate to current ride screen
      if (ride.status === "in-progress") {
        router.push({
          pathname: "/current-ride",
          params: {
            rideId: String(ride.id),
            ride: JSON.stringify(ride),
          },
        });
      } else {
        // For scheduled/upcoming rides, navigate to upcoming ride details screen (read-only)
        router.push({
          pathname: "/upcoming-ride-details",
          params: {
            rideId: String(ride.id),
          },
        });
      }
    },
    [rides]
  );

  const handleAddRide = useCallback(() => {
    router.push("/add-ride");
  }, []);

  return {
    // Data
    rides,
    isLoading,
    error,
    refreshing,

    // Location
    currentCity,
    currentState,
    currentLocation,
    locationError,

    // Computed
    greeting,
    currentRide,
    todaysRides,
    upcomingRides,
    filteredRides,
    sortedRides,

    // Actions
    fetchRides,
    onRefresh,
    deleteRide: deleteRideAction,
    handleRidePress,
    handleAddRide,

    // Filters
    filterStatus,
    setFilterStatus,
    sortBy,
    setSortBy,
  };
}
