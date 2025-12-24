import { API_URL } from '@/config/api';
import { logger } from '@/utils/logger';
import { getErrorMessage, getErrorStatus, isApiError } from '@/types/errors';
import { fetchWithAuth } from './auth';
import type { ApiError } from './types';

export interface Ride {
  id: number;
  driverId: number;
  driverName: string;
  driverPhone: string;
  fromAddress: string;
  toAddress: string;
  fromCity: string;
  toCity: string;
  fromState: string;
  toState: string;
  fromLatitude: number;
  fromLongitude: number;
  toLatitude: number;
  toLongitude: number;
  departureTime: string;
  price: number;
  pricePerSeat: number;
  availableSeats: number;
  totalSeats: number;
  distance?: number | null;
  status: string;
  carMake?: string | null;
  carModel?: string | null;
  carYear?: number | null;
  carColor?: string | null;
  driver: {
    id: number;
    fullName: string;
    email: string;
    phoneNumber: string;
    photoUrl?: string | null;
  };
}

export interface UpcomingRidesResponse {
  success: boolean;
  rides: Ride[];
  message?: string;
}

export async function getUpcomingRides(
  riderLatitude?: number,
  riderLongitude?: number
): Promise<UpcomingRidesResponse> {
  try {
    // Build URL with optional location query params
    let url = `${API_URL}/api/rider/rides/upcoming`;
    if (riderLatitude !== undefined && riderLongitude !== undefined) {
      url += `?riderLatitude=${riderLatitude}&riderLongitude=${riderLongitude}`;
    }
    
    logger.debug('Fetching rides from:', url, 'getUpcomingRides');
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    let result;
    try {
      result = await response.json();
    } catch (jsonError) {
      logger.error('Failed to parse JSON response', jsonError, 'getUpcomingRides');
      throw {
        message: `Server error: ${response.status} ${response.statusText}`,
        status: response.status,
      } as ApiError;
    }

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to fetch rides',
        status: response.status,
      } as ApiError;
    }

    return result;
  } catch (error: unknown) {
    logger.error('getUpcomingRides error', error, 'getUpcomingRides');
    if (isApiError(error)) {
      throw error;
    }
    const errorMessage = getErrorMessage(error);
    logger.debug('API URL', API_URL, 'getUpcomingRides');
    throw {
      message: `${errorMessage} (API: ${API_URL})`,
      status: 0,
    } as ApiError;
  }
}

export async function getRideById(rideId: number): Promise<{ success: boolean; ride: Ride }> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/rides/${rideId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    let result;
    try {
      result = await response.json();
    } catch (jsonError) {
      logger.error('Failed to parse JSON response', jsonError, 'getRideById');
      throw {
        message: `Server error: ${response.status} ${response.statusText}`,
        status: response.status,
      } as ApiError;
    }

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to fetch ride details',
        status: response.status,
      } as ApiError;
    }

    return result;
  } catch (error: unknown) {
    logger.error('Error fetching ride details', error, 'getRideDetails');
    if (isApiError(error)) {
      throw error;
    }
    throw {
      message: getErrorMessage(error),
      status: getErrorStatus(error) || 0,
    } as ApiError;
  }
}

