import { API_URL } from '@/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

    // Save token if provided
    if (result.token) {
      await AsyncStorage.setItem('token', result.token);
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
    console.log('Fetching rides from:', `${API_URL}/api/rider/rides/upcoming`);
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
      console.error('Failed to parse JSON response:', jsonError);
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
  } catch (error: any) {
    console.error('getUpcomingRides error:', error);
    console.error('Error type:', error.constructor.name);
    console.error('Error details:', JSON.stringify(error, null, 2));
    if (error.message && error.status !== undefined) {
      throw error;
    }
    // Provide more detailed error message
    const errorMessage = error.message || error.toString() || 'Network error. Please check your connection and try again.';
    console.error('API URL:', API_URL);
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
 * Get a single ride by ID
 */
export async function getRideById(rideId: number): Promise<{ success: boolean; ride: Ride }> {
  try {
    const response = await fetch(`${API_URL}/api/driver/rides/${rideId}`, {
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
  } catch (error) {
    console.error('Error fetching ride details:', error);
    throw error as ApiError;
  }
}

export async function getRiderBookings(riderId: number): Promise<RiderBookingsResponse> {
  try {
    console.log('Fetching bookings from:', `${API_URL}/api/rider/rides/bookings?riderId=${riderId}`);
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
      console.error('Failed to parse JSON response:', jsonError);
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
    console.error('getRiderBookings error:', error);
    console.error('Error type:', error.constructor.name);
    console.error('Error details:', JSON.stringify(error, null, 2));
    if (error.message && error.status !== undefined) {
      throw error;
    }
    // Provide more detailed error message
    const errorMessage = error.message || error.toString() || 'Network error. Please check your connection and try again.';
    console.error('API URL:', API_URL);
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
      console.log('Calling attach-payment-method API:', {
        url: `${API_URL}/api/rider/payment/attach-payment-method`,
        body: {
          riderId: data.riderId,
          paymentMethodId: data.paymentMethodId,
          paymentMethodType: data.paymentMethodType,
        },
      });

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

      console.log('API response status:', response.status, response.statusText);

      const result = await response.json();
      console.log('API response body:', result);

      if (!response.ok) {
        const errorMessage = result.message || 'Failed to save payment method';
        console.error('API error:', {
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
    console.error('savePaymentMethod error:', error);
    
    if (error.message && error.status !== undefined) {
      throw error;
    }
    
    const networkError = {
      message: error.message || 'Network error. Please check your connection and try again.',
      status: error.status || 0,
    } as ApiError;
    
    console.error('Throwing network error:', networkError);
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
    console.warn('Get payment methods endpoint not available, using mock response');
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
    console.warn('Delete payment method endpoint not available, using mock response');
    return {
      success: true,
      message: 'Mock response - payment method deleted',
    };
  }
}

