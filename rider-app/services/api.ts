import { API_URL } from '@/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';
import { getErrorMessage, getErrorStatus, isApiError, type TypedError } from '@/types/errors';

export interface ApiError {
  message: string;
  status?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: {
    id: string;
    email: string;
    role: string;
    isDriver?: boolean;
    isRider?: boolean;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    profilePicture?: string;
  };
  token?: string;
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await AsyncStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  return response;
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_URL}/api/rider/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    let result;
    try {
      result = await response.json();
    } catch (jsonError) {
      // If response is not JSON, create a generic error
      throw {
        message: `Server error: ${response.status} ${response.statusText}`,
        status: response.status,
      } as ApiError;
    }

    if (!response.ok) {
      throw {
        message: result.message || 'Login failed',
        status: response.status,
        errors: result.errors,
      } as ApiError;
    }

    // Handle response structure (support both old flat format and new data format)
    const responseData = result.data || result;
    
    // Save token if provided (support both old 'token' and new 'tokens' format)
    if (responseData.tokens?.accessToken) {
      await AsyncStorage.setItem('token', responseData.tokens.accessToken);
      if (responseData.tokens.refreshToken) {
        await AsyncStorage.setItem('refreshToken', responseData.tokens.refreshToken);
      }
    } else if (responseData.token) {
      await AsyncStorage.setItem('token', responseData.token);
    }

    // Return in expected format for frontend
    return {
      ...result,
      user: responseData.user,
      tokens: responseData.tokens,
      token: responseData.token, // Keep for backward compatibility
    };
  } catch (error: any) {
    if (error.message && error.status !== undefined) {
      throw error;
    }
    throw {
      message: 'Network error. Please check your connection and try again.',
      status: 0,
    } as ApiError;
  }
}

export async function signup(data: SignupRequest): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_URL}/api/rider/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Signup failed',
        status: response.status,
      } as ApiError;
    }

    // Save token if provided
    if (result.token) {
      await AsyncStorage.setItem('token', result.token);
    }

    return result;
  } catch (error: any) {
    if (error.message && error.status) {
      throw error;
    }
    throw {
      message: 'Network error. Please check your connection and try again.',
      status: 0,
    } as ApiError;
  }
}

export interface Ride {
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
  availableSeats: number;
  totalSeats: number;
  price: number;
  status: string;
  distance?: number | null;
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

export async function getUpcomingRides(): Promise<UpcomingRidesResponse> {
  try {
    logger.debug('Fetching rides from:', `${API_URL}/api/rider/rides/upcoming`, 'getUpcomingRides');
    const response = await fetch(`${API_URL}/api/rider/rides/upcoming`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    let result;
    try {
      result = await response.json();
    } catch (jsonError) {
      logger.error('Failed to parse JSON response', jsonError, 'getRiderBookings');
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
    // Provide more detailed error message
    const errorMessage = getErrorMessage(error);
    logger.debug('API URL', API_URL, 'getUpcomingRides');
    throw {
      message: `${errorMessage} (API: ${API_URL})`,
      status: 0,
    } as ApiError;
  }
}

export interface RiderBooking {
  id: number;
  confirmationNumber: string;
  numberOfSeats: number;
  pickupAddress: string;
  pickupCity?: string | null;
  pickupState?: string | null;
  pickupZipCode?: string | null;
  pickupLatitude: number;
  pickupLongitude: number;
  status: string;
  createdAt: string;
  isPast: boolean;
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

/**
 * Get a single ride by ID (rider endpoint)
 */
export async function getRideById(rideId: number): Promise<{ success: boolean; ride: Ride }> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/rides/${rideId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to fetch ride details',
        status: response.status,
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    logger.error('Error fetching ride details', error, 'getRideDetails');
    if (error.message && error.status !== undefined) {
      throw error;
    }
    throw {
      message: 'Network error. Please check your connection and try again.',
      status: 0,
    } as ApiError;
  }
}

export async function getRiderBookings(riderId: number): Promise<RiderBookingsResponse> {
  try {
    logger.debug('Fetching bookings from:', `${API_URL}/api/rider/rides/bookings?riderId=${riderId}`, 'getRiderBookings');
    const response = await fetchWithAuth(`${API_URL}/api/rider/rides/bookings?riderId=${riderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    let result;
    try {
      result = await response.json();
    } catch (jsonError) {
      logger.error('Failed to parse JSON response', jsonError, 'getRiderBookings');
      throw {
        message: `Server error: ${response.status} ${response.statusText}`,
        status: response.status,
      } as ApiError;
    }

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to fetch bookings',
        status: response.status,
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    logger.error('getRiderBookings error', error, 'getRiderBookings');
    if (error.message && error.status !== undefined) {
      throw error;
    }
    // Provide more detailed error message
    const errorMessage = error.message || error.toString() || 'Network error. Please check your connection and try again.';
    logger.debug('API URL', API_URL, 'getUpcomingRides');
    throw {
      message: `${errorMessage} (API: ${API_URL})`,
      status: 0,
    } as ApiError;
  }
}

export interface CancelBookingResponse {
  success: boolean;
  message: string;
}

export interface DriverLocationResponse {
  success: boolean;
  driverLocation: {
    latitude: number;
    longitude: number;
    updatedAt: string | null;
  } | null;
  pickupLocation: {
    latitude: number;
    longitude: number;
    address: string;
  };
  ride: {
    id: number;
    status: string;
    fromLatitude: number;
    fromLongitude: number;
    toLatitude: number;
    toLongitude: number;
  };
  booking: {
    id: number;
    pickupStatus: string;
  };
}

export async function getDriverLocation(
  rideId: number,
  riderId: number
): Promise<DriverLocationResponse> {
  try {
    const response = await fetchWithAuth(
      `${API_URL}/api/rider/tracking/${rideId}?riderId=${riderId}`,
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
  } catch (error: any) {
    if (error.message && error.status !== undefined) {
      throw error;
    }
    throw {
      message: 'Network error. Please check your connection and try again.',
      status: 0,
    } as ApiError;
  }
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
}

export interface BookingResponse {
  success: boolean;
  message: string;
  booking: {
    id: number;
    confirmationNumber: string;
    pickupAddress: string;
    pickupCity?: string | null;
    pickupState?: string | null;
    status: string;
    createdAt: string;
    ride: {
      id: number;
      fromAddress: string;
      toAddress: string;
      departureDate: string;
      departureTime: string;
      pricePerSeat: number;
      driver: {
        id: number;
        fullName: string;
        email: string;
        phoneNumber: string;
        photoUrl?: string | null;
      };
    };
    rider: {
      id: number;
      fullName: string;
      email: string;
      phoneNumber: string;
    };
  };
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
  } catch (error: any) {
    if (error.message && error.status !== undefined) {
      throw error;
    }
    throw {
      message: 'Network error. Please check your connection and try again.',
      status: 0,
    } as ApiError;
  }
}

export interface UpdateBookingRequest {
  pickupAddress?: string;
  pickupCity?: string | null;
  pickupState?: string | null;
  pickupZipCode?: string | null;
  pickupLatitude?: number;
  pickupLongitude?: number;
  numberOfSeats?: number;
}

export interface UpdateBookingResponse {
  success: boolean;
  message: string;
  booking?: RiderBooking;
}

export async function updateBooking(
  bookingId: number,
  riderId: number,
  data: UpdateBookingRequest
): Promise<UpdateBookingResponse> {
  try {
    const response = await fetchWithAuth(
      `${API_URL}/api/rider/bookings/${bookingId}?riderId=${riderId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to update booking',
        status: response.status,
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    if (error.message && error.status !== undefined) {
      throw error;
    }
    throw {
      message: 'Network error. Please check your connection and try again.',
      status: 0,
    } as ApiError;
  }
}

export async function cancelBooking(bookingId: number, riderId: number): Promise<CancelBookingResponse> {
  try {
    const response = await fetchWithAuth(
      `${API_URL}/api/rider/bookings/${bookingId}/cancel?riderId=${riderId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to cancel booking',
        status: response.status,
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    if (error.message && error.status !== undefined) {
      throw error;
    }
    throw {
      message: 'Network error. Please check your connection and try again.',
      status: 0,
    } as ApiError;
  }
}

/**
 * Get pickup PIN for a booking
 * @param bookingId - The ID of the booking
 * @param riderId - The ID of the rider (required for security)
 */
export interface PickupPINResponse {
  success: boolean;
  pin: string;
  expiresAt: string | null;
  pickupStatus: string;
  message?: string;
}

export interface RiderProfile {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  photoUrl: string | null;
  city: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GetProfileResponse {
  success: boolean;
  message?: string;
  user: RiderProfile;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  photoUrl?: string | null;
  city?: string | null;
}

export interface UpdateProfileResponse {
  success: boolean;
  message?: string;
  user: RiderProfile;
}

/**
 * Get rider profile
 */
export async function getRiderProfile(): Promise<GetProfileResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to fetch profile',
        status: response.status,
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    if (error.message && error.status !== undefined) {
      throw error;
    }
    throw {
      message: 'Network error. Please check your connection and try again.',
      status: 0,
    } as ApiError;
  }
}

/**
 * Update rider profile
 */
export async function updateRiderProfile(data: UpdateProfileRequest): Promise<UpdateProfileResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to update profile',
        status: response.status,
      } as ApiError;
    }

    // Handle response structure (support both old flat format and new data format)
    if (result.data) {
      return {
        success: result.success,
        message: result.message,
        user: result.data.user,
      };
    }

    return result;
  } catch (error: any) {
    if (error.message && error.status !== undefined) {
      throw error;
    }
    throw {
      message: 'Network error. Please check your connection and try again.',
      status: 0,
    } as ApiError;
  }
}

/**
 * Update rider profile photo
 */
export async function updateRiderProfilePhoto(photoUrl: string): Promise<UpdateProfileResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/profile/photo`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ photoUrl }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to update profile photo',
        status: response.status,
      } as ApiError;
    }

    // Handle response structure (support both old flat format and new data format)
    if (result.data) {
      return {
        success: result.success,
        message: result.message,
        user: result.data.user,
      };
    }

    return result;
  } catch (error: any) {
    if (error.message && error.status !== undefined) {
      throw error;
    }
    throw {
      message: 'Network error. Please check your connection and try again.',
      status: 0,
    } as ApiError;
  }
}

export interface SavedAddress {
  id: number;
  riderId: number;
  label: string;
  address: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GetSavedAddressesResponse {
  success: boolean;
  message?: string;
  addresses: SavedAddress[];
}

export interface CreateSavedAddressRequest {
  label: string;
  address: string;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude: number;
  longitude: number;
  isDefault?: boolean;
}

export interface UpdateSavedAddressRequest {
  label?: string;
  address?: string;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export interface SavedAddressResponse {
  success: boolean;
  message?: string;
  address: SavedAddress;
}

/**
 * Get all saved addresses for the rider
 */
export async function getSavedAddresses(): Promise<GetSavedAddressesResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/saved-addresses`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to fetch saved addresses',
        status: response.status,
      } as ApiError;
    }

    // Handle response structure (support both old flat format and new data format)
    if (result.data) {
      return {
        success: result.success,
        message: result.message,
        addresses: result.data.addresses,
      };
    }

    return result;
  } catch (error: any) {
    if (error.message && error.status !== undefined) {
      throw error;
    }
    throw {
      message: 'Network error. Please check your connection and try again.',
      status: 0,
    } as ApiError;
  }
}

/**
 * Create a new saved address
 */
export async function createSavedAddress(data: CreateSavedAddressRequest): Promise<SavedAddressResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/saved-addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to create saved address',
        status: response.status,
      } as ApiError;
    }

    // Handle response structure
    if (result.data) {
      return {
        success: result.success,
        message: result.message,
        address: result.data.address,
      };
    }

    return result;
  } catch (error: any) {
    if (error.message && error.status !== undefined) {
      throw error;
    }
    throw {
      message: 'Network error. Please check your connection and try again.',
      status: 0,
    } as ApiError;
  }
}

/**
 * Update a saved address
 */
export async function updateSavedAddress(
  addressId: number,
  data: UpdateSavedAddressRequest
): Promise<SavedAddressResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/saved-addresses/${addressId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to update saved address',
        status: response.status,
      } as ApiError;
    }

    // Handle response structure
    if (result.data) {
      return {
        success: result.success,
        message: result.message,
        address: result.data.address,
      };
    }

    return result;
  } catch (error: any) {
    if (error.message && error.status !== undefined) {
      throw error;
    }
    throw {
      message: 'Network error. Please check your connection and try again.',
      status: 0,
    } as ApiError;
  }
}

/**
 * Delete a saved address
 */
export async function deleteSavedAddress(addressId: number): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/saved-addresses/${addressId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to delete saved address',
        status: response.status,
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    if (error.message && error.status !== undefined) {
      throw error;
    }
    throw {
      message: 'Network error. Please check your connection and try again.',
      status: 0,
    } as ApiError;
  }
}

export async function getPickupPIN(bookingId: number, riderId: number): Promise<PickupPINResponse> {
  try {
    const response = await fetchWithAuth(
      `${API_URL}/api/rider/bookings/${bookingId}/pickup-pin?riderId=${riderId}`,
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
        message: result.message || 'Failed to fetch pickup PIN',
        status: response.status,
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    if (error.message && error.status !== undefined) {
      throw error;
    }
    throw {
      message: 'Network error. Please check your connection and try again.',
      status: 0,
    } as ApiError;
  }
}

export interface SavePaymentMethodRequest {
  riderId: number;
  paymentMethodType: 'card' | 'applePay' | 'googlePay';
  rideId: number;
  paymentMethodId?: string; // The tokenized payment method ID from Stripe (pm_xxx)
}

export interface SavePaymentMethodResponse {
  success: boolean;
  message?: string;
  paymentMethodId?: string;
  setupIntentClientSecret?: string;
}

/**
 * Save a payment method securely
 * 
 * Flow 1 (with paymentMethodId - from createPaymentMethod):
 * 1. Frontend tokenizes card using Stripe publishable key → returns paymentMethodId
 * 2. Frontend sends paymentMethodId to backend (never sends actual card details)
 * 3. Backend attaches payment method to Stripe customer using secret key
 * 
 * Flow 2 (without paymentMethodId - for PaymentSheet):
 * 1. Frontend requests SetupIntent from backend
 * 2. Backend creates SetupIntent and returns setupIntentClientSecret
 * 3. Frontend uses PaymentSheet to collect payment method
 * 4. After PaymentSheet completes, frontend calls attach-payment-method with the paymentMethodId
 * 
 * This follows Stripe's secure best practices - card details never touch our servers
 */
export async function savePaymentMethod(data: SavePaymentMethodRequest): Promise<SavePaymentMethodResponse> {
  try {
    // If paymentMethodId is provided, attach it to customer
    if (data.paymentMethodId) {
      logger.debug('Calling attach-payment-method API', {
        url: `${API_URL}/api/rider/payment/attach-payment-method`,
        body: {
          riderId: data.riderId,
          paymentMethodId: data.paymentMethodId,
          paymentMethodType: data.paymentMethodType,
        },
      }, 'savePaymentMethod');

      const response = await fetchWithAuth(`${API_URL}/api/rider/payment/attach-payment-method`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          riderId: data.riderId,
          paymentMethodId: data.paymentMethodId,
          paymentMethodType: data.paymentMethodType,
        }),
      });

      logger.debug('API response status', { status: response.status, statusText: response.statusText }, 'savePaymentMethod');

      const result = await response.json();
      logger.debug('API response body', result, 'savePaymentMethod');

      if (!response.ok) {
        const errorMessage = result.message || 'Failed to save payment method';
        logger.error('API error', {
          status: response.status,
          message: errorMessage,
          result,
        });
        throw {
          message: errorMessage,
          status: response.status,
        } as ApiError;
      }

      return result;
    }

    // If no paymentMethodId, create SetupIntent for PaymentSheet flow
    const response = await fetchWithAuth(`${API_URL}/api/rider/payment/create-setup-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        riderId: data.riderId,
        paymentMethodType: data.paymentMethodType,
        rideId: data.rideId,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to create setup intent',
        status: response.status,
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    logger.error('savePaymentMethod error', error, 'savePaymentMethod');
    
    if (error.message && error.status !== undefined) {
      throw error;
    }
    
    const networkError = {
      message: error.message || 'Network error. Please check your connection and try again.',
      status: error.status || 0,
    } as ApiError;
    
    logger.error('Throwing network error', networkError, 'savePaymentMethod');
    throw networkError;
  }
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'applePay' | 'googlePay';
  last4?: string;
  brand?: string;
  isDefault: boolean;
  card?: {
    brand?: string;
    last4?: string;
    expMonth?: number;
    expYear?: number;
  };
  billingDetails?: {
    name?: string;
    email?: string;
  };
}

export interface GetPaymentMethodsResponse {
  success: boolean;
  paymentMethods?: PaymentMethod[];
  message?: string;
}

/**
 * Get all saved payment methods for a rider
 */
export async function getPaymentMethods(riderId: number): Promise<GetPaymentMethodsResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/payment/payment-methods?riderId=${riderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to fetch payment methods',
        status: response.status,
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    if (error.message && error.status !== undefined) {
      throw error;
    }
    // For development, return empty array if endpoint doesn't exist yet
    logger.warn('Get payment methods endpoint not available, using mock response', undefined, 'getPaymentMethods');
    return {
      success: true,
      paymentMethods: [],
      message: 'Mock response - no payment methods',
    };
  }
}

export interface DeletePaymentMethodResponse {
  success: boolean;
  message?: string;
}

/**
 * Delete a saved payment method
 */
export async function deletePaymentMethod(riderId: number, paymentMethodId: string): Promise<DeletePaymentMethodResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/payment/payment-methods/${paymentMethodId}?riderId=${riderId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to delete payment method',
        status: response.status,
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    if (error.message && error.status !== undefined) {
      throw error;
    }
    // For development, return success if endpoint doesn't exist yet
    logger.warn('Delete payment method endpoint not available, using mock response', undefined, 'deletePaymentMethod');
    return {
      success: true,
      message: 'Mock response - payment method deleted',
    };
  }
}

// ==================== Notifications ====================

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  createdAt: string;
  booking?: {
    id: number;
    confirmationNumber: string;
    numberOfSeats: number;
    status: string;
    pickupAddress: string;
    pickupCity?: string;
    pickupState?: string;
    ride: {
      id: number;
      fromAddress: string;
      toAddress: string;
      fromCity: string;
      toCity: string;
      departureDate: string;
      departureTime: string;
      pricePerSeat: number;
      driverName: string;
      driverPhone: string;
      status: string;
    };
  } | null;
  ride?: {
    id: number;
    fromAddress: string;
    toAddress: string;
    fromCity: string;
    toCity: string;
    driver?: {
      id: number;
      fullName: string;
      email: string;
      phoneNumber: string;
    } | null;
  } | null;
}

export interface GetNotificationsResponse {
  success: boolean;
  notifications: Notification[];
  message?: string;
}

export async function getNotifications(): Promise<GetNotificationsResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/notifications`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Check if response exists (network errors may not have a response)
    if (!response) {
      throw {
        message: 'Network error. Please check your connection and try again.',
        status: 0,
      } as ApiError;
    }

    let result;
    try {
      result = await response.json();
    } catch (jsonError) {
      // If response is not JSON, it's likely a network/server error
      throw {
        message: `Server error: ${response.status} ${response.statusText}`,
        status: response.status || 0,
      } as ApiError;
    }

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to fetch notifications',
        status: response.status,
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    // If it's already an ApiError with status, rethrow it
    if (error.message && error.status !== undefined) {
      throw error;
    }
    // Network errors (TypeError: Network request failed) don't have status
    // Wrap them in our ApiError format
    throw {
      message: error.message || 'Network error. Please check your connection and try again.',
      status: 0,
    } as ApiError;
  }
}

export async function markNotificationAsRead(notificationId: number): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/notifications/${notificationId}/read`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to mark notification as read',
        status: response.status,
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    logger.error('Error marking notification as read', error, 'markNotificationAsRead');
    if (error.message && error.status !== undefined) {
      throw error;
    }
    throw {
      message: 'Network error. Please check your connection and try again.',
      status: 0,
    } as ApiError;
  }
}

export async function markAllNotificationsAsRead(): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/notifications/read-all`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to mark all notifications as read',
        status: response.status,
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    logger.error('Error marking all notifications as read', error, 'markAllNotificationsAsRead');
    if (error.message && error.status !== undefined) {
      throw error;
    }
    throw {
      message: 'Network error. Please check your connection and try again.',
      status: 0,
    } as ApiError;
  }
}

