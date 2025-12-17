import { useState, useEffect, useCallback } from 'react';
import { getRideById, type Ride, type ApiError } from '@/services/api';

interface UseRideDataOptions {
  rideId: number | null;
  driverId: number | null;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseRideDataReturn {
  rideData: Ride | null;
  isLoading: boolean;
  error: string | null;
  refreshRide: () => Promise<void>;
}

export function useRideData({
  rideId,
  driverId,
  autoRefresh = false,
  refreshInterval = 30000, // 30 seconds
}: UseRideDataOptions): UseRideDataReturn {
  const [rideData, setRideData] = useState<Ride | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRide = useCallback(async () => {
    if (!rideId || !driverId) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await getRideById(rideId, driverId);
      setRideData(data);
      console.log('✅ Ride data refreshed:', data.id);
    } catch (err) {
      const apiError = err as ApiError;
      console.error('❌ Error fetching ride:', apiError);
      setError(apiError.message || 'Failed to load ride');
    } finally {
      setIsLoading(false);
    }
  }, [rideId, driverId]);

  // Initial fetch
  useEffect(() => {
    fetchRide();
  }, [fetchRide]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (!autoRefresh || !rideId) return;

    const interval = setInterval(() => {
      fetchRide();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchRide, rideId]);

  return {
    rideData,
    isLoading,
    error,
    refreshRide: fetchRide,
  };
}





