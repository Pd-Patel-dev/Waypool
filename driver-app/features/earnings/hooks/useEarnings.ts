import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@/context/UserContext';
import { getEarnings, type EarningsSummary } from '@/services/api';
import { HapticFeedback } from '@/utils/haptics';
import { getUserFriendlyErrorMessage } from '@/utils/errorHandler';

export interface UseEarningsReturn {
  earnings: EarningsSummary | null;
  isLoading: boolean;
  error: string | null;
  refreshing: boolean;
  fetchEarnings: () => Promise<void>;
  onRefresh: () => Promise<void>;

  // Computed
  totalEarnings: number;
  weeklyEarnings: number;
  completedRides: number;
  avgEarningsPerRide: number;
  weeklyData: {
    labels: string[];
    datasets: Array<{ data: number[] }>;
  };
}

export function useEarnings(): UseEarningsReturn {
  const { user } = useUser();
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEarnings = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await getEarnings(user.id);
      setEarnings(response.earnings || null);
    } catch (err) {
      const errorMessage = getUserFriendlyErrorMessage(err);
      setError(errorMessage);
      HapticFeedback.error();
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    HapticFeedback.selection();
    await fetchEarnings();
    HapticFeedback.success();
  }, [fetchEarnings]);

  // Computed values
  const totalEarnings = useMemo(() => earnings?.total || 0, [earnings]);
  const weeklyEarnings = useMemo(() => earnings?.thisWeek || 0, [earnings]);
  const completedRides = useMemo(() => earnings?.totalRides || 0, [earnings]);
  const avgEarningsPerRide = useMemo(() => earnings?.averagePerRide || 0, [earnings]);

  const weeklyData = useMemo(() => {
    const now = new Date();
    const labels: string[] = [];
    const data: number[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      labels.push(dayNames[date.getDay()]);

      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);

      let dayEarnings = 0;
      if (earnings?.recentRides) {
        earnings.recentRides.forEach((ride) => {
          const rideDate = new Date(ride.date);
          rideDate.setHours(0, 0, 0, 0);
          if (rideDate.getTime() === dayStart.getTime()) {
            dayEarnings += ride.earnings;
          }
        });
      }

      data.push(dayEarnings);
    }

    return { labels, datasets: [{ data }] };
  }, [earnings]);

  return {
    earnings,
    isLoading,
    error,
    refreshing,
    fetchEarnings,
    onRefresh,
    totalEarnings,
    weeklyEarnings,
    completedRides,
    avgEarningsPerRide,
    weeklyData,
  };
}

