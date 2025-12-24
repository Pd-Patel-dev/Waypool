import { API_URL } from '@/config/api';
import { logger } from '@/utils/logger';
import { getErrorMessage, getErrorStatus, isApiError } from '@/types/errors';
import { fetchWithAuth } from './auth';
import type { ApiError, Ride } from './types';

export interface RiderBooking {
  id: number;
  riderId: number;
  rideId: number;
  numberOfSeats: number;
  status: string;
  pickupAddress: string;
  pickupCity?: string | null;
  pickupState?: string | null;
  pickupZipCode?: string | null;
  pickupLatitude: number;
  pickupLongitude: number;
  pickupStatus: string;
  confirmationNumber: string;
  createdAt: string;
  isPast: boolean;
  rejectionReason?: string | null;
  ride: {
    id: number;
    driverName: string;
    driverPhone: string;
    fromAddress: string;
    toAddress: string;
    fromCity: string;
    toCity: string;
    fromLatitude: number;
    fromLongitude: number;
    toLatitude: number;
    toLongitude: number;
    departureTime: string;
    pricePerSeat: number;
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
  };
}

export interface RiderBookingsResponse {
  success: boolean;
  bookings: RiderBooking[];
  message?: string;
}

export interface BookingRequest {
  rideId: number;
  riderId: number;
  pickupAddress: string;
  pickupCity?: string | null;
  pickupState?: string | null;
  pickupZipCode?: string | null;
  pickupLatitude: number;
  pickupLongitude: number;
  numberOfSeats: number;
  paymentMethodId?: string;
}

export interface BookingResponse {
  success: boolean;
  message: string;
  booking: {
    id: number;
    confirmationNumber: string;
    status: string;
    numberOfSeats: number;
    pickupAddress: string;
    ride: Ride;
  };
}

export interface CancelBookingResponse {
  success: boolean;
  message: string;
}

export interface UpdateBookingRequest {
  numberOfSeats?: number;
  pickupAddress?: string;
  pickupCity?: string | null;
  pickupState?: string | null;
  pickupZipCode?: string | null;
  pickupLatitude?: number;
  pickupLongitude?: number;
}

export interface UpdateBookingResponse {
  success: boolean;
  message: string;
  booking: RiderBooking;
}

export interface PickupPINResponse {
  success: boolean;
  pin: string;
  expiresAt: string | null;
  pickupStatus: string;
  message?: string;
}

export async function getRiderBookings(riderId: number): Promise<RiderBookingsResponse> {
  const url = `${API_URL}/api/rider/rides/bookings?riderId=${riderId}`;
  
  try {
    logger.debug('Fetching bookings from:', url, 'getRiderBookings');
    logger.debug('API URL configured as:', API_URL, 'getRiderBookings');
    
    const response = await fetchWithAuth(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Check if response is valid
    if (!response) {
      throw {
        message: 'No response from server. Please check if the backend server is running.',
        status: 0,
      } as ApiError;
    }

    let result;
    try {
      result = await response.json();
    } catch (jsonError) {
      logger.error('Failed to parse JSON response', jsonError, 'getRiderBookings');
      throw {
        message: `Server error: ${response.status} ${response.statusText}`,
        status: response.status || 500,
      } as ApiError;
    }

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to fetch bookings',
        status: response.status,
        errors: result.errors,
      } as ApiError;
    }

    return result;
  } catch (error: unknown) {
    logger.error('getRiderBookings error', error, 'getRiderBookings');
    
    // Check if it's a network error
    if (error instanceof TypeError && error.message.includes('Network request failed')) {
      logger.error('Network connectivity issue. Check:', {
        apiUrl: API_URL,
        url,
        message: 'Ensure backend server is running and API_URL is correct for your device/emulator',
      }, 'getRiderBookings');
      
      throw {
        message: `Cannot connect to server at ${API_URL}. Please ensure the backend server is running and the API URL is correct for your device.`,
        status: 0,
      } as ApiError;
    }
    
    if (isApiError(error)) {
      throw error;
    }
    
    const errorMessage = getErrorMessage(error);
    throw {
      message: `${errorMessage} (API: ${API_URL})`,
      status: getErrorStatus(error) || 0,
    } as ApiError;
  }
}

export async function bookRide(data: BookingRequest): Promise<BookingResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/rides/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to book ride',
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

export async function cancelBooking(bookingId: number, riderId: number): Promise<CancelBookingResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/rides/bookings/${bookingId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ riderId }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to cancel booking',
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

export async function updateBooking(
  bookingId: number,
  data: UpdateBookingRequest
): Promise<UpdateBookingResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/rides/bookings/${bookingId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to update booking',
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

export async function getPickupPIN(bookingId: number, riderId: number): Promise<PickupPINResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/rides/bookings/${bookingId}/pickup-pin?riderId=${riderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to fetch pickup PIN',
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

