import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, AppState } from 'react-native';
import { updateDriverLocation } from '@/services/api';

// Conditionally import Location
let Location: any = null;
if (Platform.OS !== 'web') {
  try {
    Location = require('expo-location');
  } catch (e) {
  }
}

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface UseRideLocationOptions {
  driverId: number | null;
  rideId: number | null;
  isActive: boolean;
}

interface UseRideLocationReturn {
  location: LocationCoords | null;
  locationError: string | null;
  isWatching: boolean;
  refreshLocation: () => Promise<void>;
}

export function useRideLocation({
  driverId,
  rideId,
  isActive,
}: UseRideLocationOptions): UseRideLocationReturn {
  const [location, setLocation] = useState<LocationCoords | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const locationWatchSubscriptionRef = useRef<any>(null);
  const appStateRef = useRef(AppState.currentState);
  const lastUpdateRef = useRef<number>(0);

  // Function to update driver location in backend
  const updateBackendLocation = useCallback(async (coords: LocationCoords) => {
    if (!driverId || !rideId) return;

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    // Rate limit: only update backend every 5 seconds
    if (timeSinceLastUpdate < 5000) return;

    try {
      await updateDriverLocation(driverId, coords.latitude, coords.longitude);
      lastUpdateRef.current = now;
    } catch (error) {
    }
  }, [driverId, rideId]);

  // Start watching location
  const startLocationWatch = useCallback(async () => {
    if (!Location || Platform.OS === 'web') return;
    if (locationWatchSubscriptionRef.current) return; // Already watching

    try {
      setIsWatching(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied');
        setIsWatching(false);
        return;
      }

      // Start watching location
      locationWatchSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Or every 10 meters
        },
        (newLocation: any) => {
          const coords = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
          };

          setLocation(coords);
          setLocationError(null);

          // Update backend
          if (isActive) {
            updateBackendLocation(coords);
          }
        }
      );

    } catch (error) {
      setLocationError('Failed to start location tracking');
      setIsWatching(false);
    }
  }, [isActive, driverId]);

  // Stop watching location
  const stopLocationWatch = () => {
    if (locationWatchSubscriptionRef.current) {
      locationWatchSubscriptionRef.current.remove();
      locationWatchSubscriptionRef.current = null;
      setIsWatching(false);
    }
  };

  // Refresh location once
  const refreshLocation = useCallback(async () => {
    if (!Location || Platform.OS === 'web') return;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      setLocation(coords);
      setLocationError(null);

      // Update backend
      if (isActive && driverId) {
        updateBackendLocation(coords);
      }
    } catch (error) {
      setLocationError('Failed to get location');
    }
  }, [isActive, driverId, updateBackendLocation]);

  // Handle app state changes (pause/resume location tracking)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - resume location tracking
        if (isActive) {
          refreshLocation();
        }
      } else if (
        appStateRef.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        // App went to background - keep location tracking if ride is active
      }

      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isActive, refreshLocation]);

  // Start/stop location tracking based on ride status
  useEffect(() => {
    if (isActive) {
      startLocationWatch();
    } else {
      stopLocationWatch();
    }

    return () => {
      stopLocationWatch();
    };
  }, [isActive, driverId, rideId, startLocationWatch]);

  return {
    location,
    locationError,
    isWatching,
    refreshLocation,
  };
}





