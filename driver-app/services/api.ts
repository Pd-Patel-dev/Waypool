import { API_BASE_URL, API_ENDPOINTS } from '@/config/api';

export interface SignupRequest {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  photoUrl: string;
  city: string;
  carMake: string;
  carModel: string;
  carYear: number;
  carColor: string;
}

export interface SignupResponse {
  success: boolean;
  message: string;
  user?: {
    id: number;
    fullName: string;
    email: string;
    phoneNumber: string;
    photoUrl: string | null;
    city: string | null;
    carMake: string | null;
    carModel: string | null;
    carYear: number | null;
    carColor: string | null;
    createdAt: string;
  };
  errors?: string[];
}

export interface ApiError {
  success: false;
  message: string;
  errors?: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  user?: {
    id: number;
    fullName: string;
    email: string;
    phoneNumber: string;
    photoUrl: string | null;
    city: string | null;
    carMake: string | null;
    carModel: string | null;
    carYear: number | null;
    carColor: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

export interface CheckEmailResponse {
  success: boolean;
  available: boolean;
  message: string;
}

export interface Passenger {
  id: number;
  riderId?: number;
  riderName?: string;
  riderPhone?: string;
  pickupAddress: string;
  pickupCity?: string;
  pickupState?: string;
  pickupZipCode?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  confirmationNumber?: string;
  status?: string;
}

export interface Ride {
  id: number;
  driverId?: number;
  driverName?: string;
  driverPhone?: string;
  carMake?: string;
  carModel?: string;
  carYear?: number;
  carColor?: string;
  fromAddress: string;
  fromCity?: string;
  fromState?: string;
  fromZipCode?: string;
  toAddress: string;
  toCity?: string;
  toState?: string;
  toZipCode?: string;
  fromLatitude?: number;
  fromLongitude?: number;
  toLatitude?: number;
  toLongitude?: number;
  departureTime: string;
  departureDate?: string;
  departureTimeString?: string;
  departureTimeISO?: string;
  availableSeats: number;
  totalSeats: number;
  price?: number;
  pricePerSeat?: number;
  status?: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  distance?: number; // Distance in kilometers
  passengers?: Passenger[]; // List of enrolled passengers
  driver?: {
    id: number;
    fullName: string;
    email: string;
    phoneNumber: string;
    photoUrl?: string | null;
    carMake?: string | null;
    carModel?: string | null;
    carYear?: number | null;
    carColor?: string | null;
  };
}

export interface CreateRideRequest {
  driverId: number;
  driverName: string;
  driverPhone: string;
  carMake?: string;
  carModel?: string;
  carYear?: number;
  carColor?: string;
  fromAddress: string;
  fromCity: string;
  fromState: string;
  fromZipCode: string;
  fromLatitude: number;
  fromLongitude: number;
  toAddress: string;
  toCity: string;
  toState: string;
  toZipCode: string;
  toLatitude: number;
  toLongitude: number;
  departureDate: string;
  departureTime: string;
  availableSeats: number;
  pricePerSeat: number;
  distance?: number;
}

export interface CreateRideResponse {
  success: boolean;
  message: string;
  ride?: Ride;
}

/**
 * Signup API call
 */
export const signup = async (data: SignupRequest): Promise<SignupResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH.SIGNUP}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || 'Signup failed',
        errors: result.errors || [],
      } as ApiError;
    }

    return result as SignupResponse;
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      throw error;
    }
    
    // Network or other errors
    throw {
      success: false,
      message: 'Network error. Please check your connection.',
      errors: [],
    } as ApiError;
  }
};

/**
 * Login API call
 */
export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH.LOGIN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || 'Login failed',
      } as ApiError;
    }

    return result as LoginResponse;
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      throw error;
    }
    
    // Network or other errors
    throw {
      success: false,
      message: 'Network error. Please check your connection.',
    } as ApiError;
  }
};

/**
 * Logout API call
 */
export const logout = async (): Promise<LogoutResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH.LOGOUT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || 'Logout failed',
      } as ApiError;
    }

    return result as LogoutResponse;
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      throw error;
    }
    
    // Network or other errors
    throw {
      success: false,
      message: 'Network error. Please check your connection.',
    } as ApiError;
  }
};

/**
 * Check if email is available
 */
export const checkEmail = async (email: string): Promise<CheckEmailResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.AUTH.CHECK_EMAIL}?email=${encodeURIComponent(email)}`,
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
        success: false,
        message: result.message || 'Email check failed',
      } as ApiError;
    }

    return result as CheckEmailResponse;
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      throw error;
    }
    
    // Network or other errors
    throw {
      success: false,
      message: 'Network error. Please check your connection.',
    } as ApiError;
  }
};

/**
 * Get a specific ride by ID with all details including passengers
 * @param rideId - The ID of the ride to fetch
 * @param driverId - Optional driver ID to verify ownership
 */
export const getRideById = async (rideId: number, driverId?: number): Promise<Ride> => {
  try {
    // Build URL with driverId query parameter if provided
    const url = driverId
      ? `${API_BASE_URL}${API_ENDPOINTS.RIDES.GET_BY_ID(rideId)}?driverId=${driverId}`
      : `${API_BASE_URL}${API_ENDPOINTS.RIDES.GET_BY_ID(rideId)}`;
    
    console.log('🌐 Fetching ride from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const result = await response.json();
      console.error('❌ API error response:', result);
      throw {
        success: false,
        message: result.message || 'Failed to fetch ride',
      } as ApiError;
    }

    const result = await response.json();
    console.log('✅ API response received:', result);
    
    if (!result.ride) {
      throw {
        success: false,
        message: 'Ride data not found in response',
      } as ApiError;
    }
    
    return result.ride;
  } catch (error) {
    console.error('❌ Error in getRideById:', error);
    if (error && typeof error === 'object' && 'message' in error) {
      throw error;
    }
    throw {
      success: false,
      message: 'Network error. Please check your connection.',
    } as ApiError;
  }
};

/**
 * Get upcoming rides for the driver
 * @param driverId - The ID of the driver to fetch rides for
 */
export const getUpcomingRides = async (driverId?: number): Promise<Ride[]> => {
  try {
    // Build URL with driverId query parameter if provided
    const url = driverId 
      ? `${API_BASE_URL}${API_ENDPOINTS.RIDES.UPCOMING}?driverId=${driverId}`
      : `${API_BASE_URL}${API_ENDPOINTS.RIDES.UPCOMING}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // If endpoint doesn't exist yet, return mock data
      if (response.status === 404) {
        return getMockRides();
      }
      
      const result = await response.json();
      throw {
        success: false,
        message: result.message || 'Failed to fetch rides',
      } as ApiError;
    }

    const result = await response.json();
    console.log('✅ Fetched rides from API:', result);
    return result.rides || result || [];
  } catch (error) {
    // Log the actual error for debugging
    console.error('❌ Error fetching rides from API:', error);
    // If network error or endpoint doesn't exist, return mock data for development
    console.warn('⚠️ Using mock rides data as fallback');
    return getMockRides();
  }
};

/**
 * Mock rides data for development when backend endpoint is not available
 */
const getMockRides = (): Ride[] => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 30, 0, 0);

  const dayAfter = new Date(now);
  dayAfter.setDate(dayAfter.getDate() + 2);
  dayAfter.setHours(14, 0, 0, 0);

  return [
    {
      id: 1,
      fromAddress: '123 Main Street, San Francisco, CA',
      toAddress: '456 Market Street, San Francisco, CA',
      fromLatitude: 37.7749,
      fromLongitude: -122.4194,
      toLatitude: 37.7896,
      toLongitude: -122.4019,
      departureTime: tomorrow.toISOString(),
      availableSeats: 3,
      totalSeats: 4,
      price: 25,
      status: 'scheduled',
      distance: 2.5,
      passengers: [
        {
          id: 1,
          pickupAddress: '100 California Street, San Francisco, CA',
          pickupLatitude: 37.7849,
          pickupLongitude: -122.4094,
        },
      ],
    },
    {
      id: 2,
      fromAddress: '789 Mission Street, San Francisco, CA',
      toAddress: '321 Castro Street, San Francisco, CA',
      fromLatitude: 37.7831,
      fromLongitude: -122.4091,
      toLatitude: 37.7606,
      toLongitude: -122.4343,
      departureTime: dayAfter.toISOString(),
      availableSeats: 2,
      totalSeats: 4,
      price: 30,
      status: 'scheduled',
      distance: 3.2,
      passengers: [],
    },
  ];
};

/**
 * Create a new ride
 */
export const createRide = async (data: CreateRideRequest): Promise<CreateRideResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.RIDES.CREATE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || 'Failed to create ride',
        errors: result.errors || [],
      } as ApiError;
    }

    return result as CreateRideResponse;
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      throw error;
    }
    
    // Network or other errors
    throw {
      success: false,
      message: 'Network error. Please check your connection.',
      errors: [],
    } as ApiError;
  }
};

export interface DeleteRideResponse {
  success: boolean;
  message: string;
}

/**
 * Delete a ride by ID
 * @param rideId - The ID of the ride to delete
 * @param driverId - The ID of the driver (required for security)
 */
export const deleteRide = async (rideId: number, driverId: number): Promise<DeleteRideResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.RIDES.DELETE(rideId)}?driverId=${driverId}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || 'Failed to delete ride',
      } as ApiError;
    }

    return result as DeleteRideResponse;
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      throw error;
    }
    
    // Network or other errors
    throw {
      success: false,
      message: 'Network error. Please check your connection.',
    } as ApiError;
  }
};

export interface CancelRideResponse {
  success: boolean;
  message: string;
}

/**
 * Cancel a ride by ID (updates status to 'cancelled')
 * @param rideId - The ID of the ride to cancel
 * @param driverId - The ID of the driver (required for security)
 */
export const cancelRide = async (rideId: number, driverId: number): Promise<CancelRideResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.RIDES.CANCEL(rideId)}?driverId=${driverId}`,
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
        success: false,
        message: result.message || 'Failed to cancel ride',
      } as ApiError;
    }

    return result as CancelRideResponse;
  } catch (error) {
    if (error && typeof error === 'object' && 'message' in error) {
      throw error;
    }
    
    // Network or other errors
    throw {
      success: false,
      message: 'Network error. Please check your connection.',
    } as ApiError;
  }
};

