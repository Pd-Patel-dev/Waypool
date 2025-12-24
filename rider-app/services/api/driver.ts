import { API_URL } from '@/config/api';
import { logger } from '@/utils/logger';
import { getErrorMessage, getErrorStatus, isApiError } from '@/types/errors';
import { fetchWithAuth } from './auth';
import type { ApiError } from './types';

export interface DriverLocationResponse {
  success: boolean;
  location?: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    timestamp: string;
  };
  message?: string;
}

export async function getDriverLocation(
  rideId: number,
  riderId: number
): Promise<DriverLocationResponse> {
  try {
    const response = await fetchWithAuth(
      `${API_URL}/api/rider/rides/${rideId}/driver-location?riderId=${riderId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to fetch driver location',
        status: response.status,
      } as ApiError;
    }

    return result;
  } catch (error: unknown) {
    if (isApiError(error)) {
      throw error;
    }
    throw {
      message: getErrorMessage(error),
      status: getErrorStatus(error) || 0,
    } as ApiError;
  }
}

