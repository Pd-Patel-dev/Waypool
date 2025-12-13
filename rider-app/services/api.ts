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
    const response = await fetch(`${API_URL}/api/rider/rides/upcoming`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to fetch rides',
        status: response.status,
      } as ApiError;
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

export interface BookRideRequest {
  rideId: number;
  riderId: number;
  numberOfSeats: number;
  pickupAddress: string;
  pickupCity?: string;
  pickupState?: string;
  pickupZipCode?: string;
  pickupLatitude: number;
  pickupLongitude: number;
}

export interface BookingResponse {
  success: boolean;
  message?: string;
  booking?: {
    id: number;
    confirmationNumber: string;
    numberOfSeats: number;
    pickupAddress: string;
    pickupCity?: string;
    pickupState?: string;
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
        photoUrl?: string;
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

export interface MyBookingsResponse {
  success: boolean;
  message?: string;
  bookings?: {
    upcoming: BookingDetail[];
    past: BookingDetail[];
  };
}

export interface BookingDetail {
  id: number;
  confirmationNumber: string;
  numberOfSeats: number;
  pickupAddress: string;
  pickupCity?: string;
  pickupState?: string;
  status: string;
  createdAt: string;
  isUpcoming: boolean;
  isPast: boolean;
  ride: {
    id: number;
    fromAddress: string;
    toAddress: string;
    fromCity: string;
    toCity: string;
    fromLatitude: number;
    fromLongitude: number;
    toLatitude: number;
    toLongitude: number;
    departureTime: string;
    departureDate: string;
    departureTimeStr: string;
    pricePerSeat: number;
    totalPrice: number;
    driver: {
      id: number;
      fullName: string;
      email: string;
      phoneNumber: string;
      photoUrl?: string;
    };
    driverName: string;
    driverPhone: string;
    carMake?: string;
    carModel?: string;
    carYear?: number;
    carColor?: string;
  };
}

export async function getMyBookings(riderId: number): Promise<MyBookingsResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/rides/my-bookings?riderId=${riderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to fetch bookings',
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

export async function bookRide(data: BookRideRequest): Promise<BookingResponse> {
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

