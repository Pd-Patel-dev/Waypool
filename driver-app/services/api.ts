import { API_BASE_URL, API_ENDPOINTS } from "@/config/api";
import { getUserFriendlyErrorMessage } from "@/utils/errorHandler";
import { fetchWithRetry, RetryOptions } from "@/utils/apiRetry";
import { getAccessToken, getRefreshToken, storeTokens, clearTokens } from "@/utils/tokenStorage";

/**
 * Internal helper function to make API calls with automatic retry logic and JWT authentication
 * All API functions should use this helper instead of direct fetch
 */
async function apiFetch(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {},
  requireAuth: boolean = true
): Promise<Response> {
  try {
    // Add JWT token to request if authentication is required
    if (requireAuth) {
      const token = await getAccessToken();
      if (token) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        };
      }
    }

    const response = await fetchWithRetry(url, options, retryOptions);

    // If unauthorized, try refreshing token (only once to avoid loops)
    if (response.status === 401 && requireAuth && !url.includes('/auth/refresh')) {
      // Token might be expired, try to refresh
      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        try {
          const refreshResponse = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH.REFRESH}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshResponse.ok) {
            const refreshResult = await refreshResponse.json();
            const newAccessToken = refreshResult.data?.accessToken || refreshResult.accessToken;
            const newRefreshToken = refreshResult.data?.refreshToken || refreshResult.refreshToken;
            
            if (newAccessToken && newRefreshToken) {
              await storeTokens(newAccessToken, newRefreshToken);
              
              // Retry the original request with new token
              const retryOptionsWithAuth = {
                ...options,
                headers: {
                  ...options.headers,
                  Authorization: `Bearer ${newAccessToken}`,
                },
              };
              return await fetchWithRetry(url, retryOptionsWithAuth, retryOptions);
            }
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // If refresh fails, clear tokens and let the 401 response through
          await clearTokens();
        }
      }
    }

    return response;
  } catch (error: unknown) {
    // If fetchWithRetry throws, it means all retries failed
    // Attach status code if available
    if (error && typeof error === "object" && "response" in error) {
      const err = error as Error & { response?: Response; status?: number };
      if (err.response) {
        err.status = err.response.status;
      }
    }
    throw error;
  }
}

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
  verificationCode: string;
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
  success?: false;
  message: string;
  errors?: string[];
  status?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  data?: {
    user?: {
      id: number;
      fullName: string;
      email: string;
      phoneNumber: string;
      isDriver: boolean;
      isRider: boolean;
      emailVerified?: boolean;
      photoUrl: string | null;
      city: string | null;
      carMake: string | null;
      carModel: string | null;
      carYear: number | null;
      carColor: string | null;
      createdAt: string;
      updatedAt: string;
    };
    tokens?: {
      accessToken: string;
      refreshToken: string;
    };
  };
  // For backwards compatibility, also allow direct user and tokens fields
  user?: {
    id: number;
    fullName: string;
    email: string;
    phoneNumber: string;
    isDriver: boolean;
    isRider: boolean;
    emailVerified?: boolean;
    photoUrl: string | null;
    city: string | null;
    carMake: string | null;
    carModel: string | null;
    carYear: number | null;
    carColor: string | null;
    createdAt: string;
    updatedAt: string;
  };
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

export interface CheckEmailResponse {
  success: boolean;
  message?: string;
  data?: {
    available: boolean;
  };
  // For backwards compatibility, also allow direct available field
  available?: boolean;
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
  pickupStatus?: "pending" | "picked_up";
  pickedUpAt?: string | null;
  numberOfSeats?: number; // Number of seats booked by this passenger
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
  pricePerSeat?: number | null;
  totalEarnings?: number; // Total earnings from completed ride
  status?: "scheduled" | "in-progress" | "completed" | "cancelled";
  distance?: number; // Distance in kilometers
  estimatedTimeMinutes?: number; // Estimated time in minutes
  isRecurring?: boolean;
  recurringPattern?: "daily" | "weekly" | "monthly" | null;
  recurringEndDate?: string | null;
  parentRideId?: number | null;
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
  // driverId is now obtained from JWT token - removed from interface
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
  estimatedTimeMinutes?: number;
  isRecurring?: boolean;
  recurringPattern?: "daily" | "weekly" | "monthly" | null;
  recurringEndDate?: string;
  isDraft?: boolean;
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
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.AUTH.SIGNUP}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Signup failed",
        errors: result.errors || [],
      } as ApiError;
    }

    // Handle both wrapped (data.user) and direct (user) response formats
    const user = result.data?.user ?? result.user;
    const tokens = result.data?.tokens ?? result.tokens;

    // Store tokens if provided
    if (tokens?.accessToken && tokens?.refreshToken) {
      await storeTokens(tokens.accessToken, tokens.refreshToken);
    }

    return {
      success: result.success ?? true,
      message: result.message || "Signup successful",
      user: user,
      tokens: tokens,
      errors: result.errors,
    } as SignupResponse;
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }

    // Network or other errors
    throw {
      success: false,
      message: "Network error. Please check your connection.",
      errors: [],
    } as ApiError;
  }
};

/**
 * Login API call
 */
export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  const url = `${API_BASE_URL}${API_ENDPOINTS.AUTH.LOGIN}`;

  try {
    const response = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      },
      { maxRetries: 2 } // Login doesn't need as many retries
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Login failed",
        status: response.status,
      } as ApiError;
    }

    // Handle both wrapped (data.user) and direct (user) response formats
    // Backend wraps response in data field: { success: true, message: "...", data: { user: {...}, tokens: {...} } }
    const user = result.data?.user ?? result.user;
    const tokens = result.data?.tokens ?? result.tokens;
    
    // Normalize emailVerified to boolean (default to false if undefined)
    if (user) {
      user.emailVerified = user.emailVerified ?? false;
    }

    // Store tokens if provided
    if (tokens?.accessToken && tokens?.refreshToken) {
      await storeTokens(tokens.accessToken, tokens.refreshToken);
    }

    const loginResponse: LoginResponse = {
      success: result.success ?? true,
      message: result.message,
      ...(result.data ? { data: result.data } : {}),
      user: user, // Extract user from either location
      tokens: tokens, // Extract tokens from either location
    };

    return loginResponse;
  } catch (error: any) {
    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      "success" in error
    ) {
      throw error;
    }

    // Network or other errors
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
      status: error?.status,
    } as ApiError;
  }
};

/**
 * Logout API call
 */
// Email Verification Interfaces
export interface SendOTPRequest {
  email: string;
  fullName?: string;
}

export interface SendOTPResponse {
  success: boolean;
  message: string;
  data?: {
    email: string;
    expiresIn: number;
  };
}

export interface VerifyOTPRequest {
  email: string;
  code: string;
}

export interface VerifyOTPResponse {
  success: boolean;
  message: string;
  data?: {
    email: string;
    verified: boolean;
  };
}

export interface ResendOTPRequest {
  email: string;
  fullName?: string;
}

export interface ResendOTPResponse {
  success: boolean;
  message: string;
  data?: {
    email: string;
    expiresIn: number;
  };
}

// Send OTP to email
export const sendOTP = async (data: SendOTPRequest): Promise<SendOTPResponse> => {
  try {
    const response = await apiFetch(
      `${API_BASE_URL}${API_ENDPOINTS.EMAIL_VERIFICATION.SEND_OTP}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || 'Failed to send verification code',
      } as ApiError;
    }

    return {
      success: result.success ?? true,
      message: result.message || 'Verification code sent successfully',
      data: result.data,
    };
  } catch (error) {
    const errorMessage = getUserFriendlyErrorMessage(error);
    throw {
      success: false,
      message: errorMessage,
    } as ApiError;
  }
};

// Verify OTP
export const verifyOTP = async (data: VerifyOTPRequest): Promise<VerifyOTPResponse> => {
  try {
    const response = await apiFetch(
      `${API_BASE_URL}${API_ENDPOINTS.EMAIL_VERIFICATION.VERIFY_OTP}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || 'Failed to verify code',
      } as ApiError;
    }

    return {
      success: result.success ?? true,
      message: result.message || 'Email verified successfully',
      data: result.data,
    };
  } catch (error) {
    const errorMessage = getUserFriendlyErrorMessage(error);
    throw {
      success: false,
      message: errorMessage,
    } as ApiError;
  }
};

// Resend OTP
export const resendOTP = async (data: ResendOTPRequest): Promise<ResendOTPResponse> => {
  try {
    const response = await apiFetch(
      `${API_BASE_URL}${API_ENDPOINTS.EMAIL_VERIFICATION.RESEND_OTP}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || 'Failed to resend verification code',
      } as ApiError;
    }

    return {
      success: result.success ?? true,
      message: result.message || 'Verification code resent successfully',
      data: result.data,
    };
  } catch (error) {
    const errorMessage = getUserFriendlyErrorMessage(error);
    throw {
      success: false,
      message: errorMessage,
    } as ApiError;
  }
};

export const logout = async (): Promise<LogoutResponse> => {
  const url = `${API_BASE_URL}${API_ENDPOINTS.AUTH.LOGOUT}`;

  try {
    const response = await apiFetch(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      },
      { maxRetries: 1 } // Logout is low priority, minimal retries
    );

    const result = await response.json();

    // Clear tokens regardless of response (even if backend call fails)
    await clearTokens();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Logout failed",
        status: response.status,
      } as ApiError;
    }

    return result as LogoutResponse;
  } catch (error: any) {
    // Always clear tokens even if there was an error
    await clearTokens();

    if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      "success" in error
    ) {
      throw error;
    }

    // Network or other errors
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
      status: error?.status,
    } as ApiError;
  }
};

/**
 * Individual ride earning details
 */
export interface EarningsBreakdown {
  grossEarnings: number;
  // Note: Platform fees are charged to riders, not deducted from driver earnings
  netEarnings: number;
}

export interface RideEarning {
  rideId: number;
  date: string; // ISO date string for parsing
  displayDate?: string; // Formatted date for display
  from: string;
  to: string;
  seatsBooked: number;
  pricePerSeat: number;
  distance: number;
  earnings: number; // Net earnings (after fees)
  earningsBreakdown?: EarningsBreakdown; // Detailed breakdown of fees
}

/**
 * Get earnings data for driver
 */
export interface EarningsData {
  total: number;
  totalRides: number;
  totalSeatsBooked: number;
  totalDistance: number;
  averagePerRide: number;
  thisWeek: number;
  thisMonth: number;
  byDate: { [key: string]: number };
  recentRides: RideEarning[];
  currency: string;
}

// Export EarningsSummary as an alias for EarningsData for backwards compatibility
export type EarningsSummary = EarningsData;

export interface EarningsResponse {
  success: boolean;
  earnings: EarningsData;
  message?: string;
}

export const getEarnings = async (
  driverId: number
): Promise<EarningsResponse> => {
  const url = `${API_BASE_URL}${API_ENDPOINTS.EARNINGS.GET}?driverId=${driverId}`;

  try {
    // Use apiFetch with retry logic for network errors
    const response = await apiFetch(
      url,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
      { maxRetries: 3, initialDelay: 1000 } // Retry up to 3 times with 1s initial delay
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message:
          result.message || "Unable to retrieve earnings. Please try again.",
        status: response.status,
      } as ApiError;
    }

    // Handle standardized response format (data wrapper)
    if (result.data && result.data.earnings) {
      return {
        success: result.success,
        message: result.message,
        earnings: result.data.earnings,
      } as EarningsResponse;
    }

    // Fallback for direct earnings response (backwards compatibility)
    return result as EarningsResponse;
  } catch (error: unknown) {
    // Enhanced error handling with user-friendly messages
    if (error && typeof error === "object" && "message" in error && "success" in error) {
      throw error; // Already an ApiError
    }

    const errorMessage = getUserFriendlyErrorMessage(error);
    console.error('[getEarnings] Error fetching earnings:', error);
    
    throw {
      success: false,
      message: errorMessage,
      status: (error as { status?: number })?.status,
    } as ApiError;
  }
};

/**
 * Check if email is available
 */
export const checkEmail = async (
  email: string
): Promise<CheckEmailResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${
        API_ENDPOINTS.AUTH.CHECK_EMAIL
      }?email=${encodeURIComponent(email)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Email check failed",
      } as ApiError;
    }

    // Handle both wrapped (data) and direct response formats
    // Backend wraps response in data field: { success: true, message: "...", data: { available: true } }
    const isAvailable = result.data?.available ?? result.available ?? false;

    const checkResponse: CheckEmailResponse = {
      success: result.success ?? true,
      message: result.message,
      data: { available: isAvailable },
      available: isAvailable, // For backwards compatibility
    };

    return checkResponse;
  } catch (error) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }

    // Network or other errors
    throw {
      success: false,
      message: "Network error. Please check your connection.",
    } as ApiError;
  }
};

/**
 * Get upcoming rides for the driver
 * @param driverId - The ID of the driver to fetch rides for
 */
/**
 * Get upcoming rides for the authenticated driver
 * Note: driverId is now obtained from JWT token - parameter kept for backwards compatibility but not used
 */
export const getUpcomingRides = async (driverId?: number): Promise<Ride[]> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.RIDES.UPCOMING}`;

    const response = await apiFetch(
      url,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
      {},
      true // requireAuth
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message:
          result.message || "Unable to load upcoming rides. Please try again.",
      } as ApiError;
    }

    // Handle both wrapped (data.rides) and direct (rides) response formats
    // Backend returns: { success: true, rides: [...] }
    const rides = result.data?.rides ?? result.rides ?? [];
    return Array.isArray(rides) ? rides : [];
  } catch (error: any) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: "Network error. Please check your connection.",
    } as ApiError;
  }
};

/**
 * Get past rides for the driver
 * Note: driverId is now obtained from JWT token - parameter kept for backwards compatibility but not used
 */
/**
 * Get past rides for the authenticated driver
 * Note: driverId is now obtained from JWT token - parameter kept for backwards compatibility but not used
 */
export const getPastRides = async (driverId?: number): Promise<Ride[]> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.RIDES.PAST}`;
    const response = await apiFetch(
      url,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
      {},
      true // requireAuth
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message:
          result.message || "Unable to load past rides. Please try again.",
      } as ApiError;
    }

    // Handle both wrapped (data.rides) and direct (rides) response formats
    const rides = result.data?.rides ?? result.rides ?? [];
    return Array.isArray(rides) ? rides : [];
  } catch (error: any) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: "Network error. Please check your connection.",
    } as ApiError;
  }
};

/**
 * Create a new ride
 */
export const createRide = async (
  data: CreateRideRequest
): Promise<CreateRideResponse> => {
  const url = `${API_BASE_URL}${API_ENDPOINTS.RIDES.CREATE}`;

  try {
    // Use apiFetch with retry logic for network errors
    const response = await apiFetch(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      },
      { maxRetries: 3, initialDelay: 1000 } // Retry up to 3 times with 1s initial delay
    );

    // Check if response has content before parsing JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      throw {
        success: false,
        message: text || "Invalid response from server",
        status: response.status,
      } as ApiError;
    }

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to create ride",
        errors: result.errors || [],
        status: response.status,
      } as ApiError;
    }

    // Handle both wrapped (data.ride) and direct (ride) response formats
    const ride = result.data?.ride ?? result.ride;

    return {
      success: result.success ?? true,
      message: result.message || "Ride created successfully",
      ride: ride,
    } as CreateRideResponse;
  } catch (error: unknown) {
    // If error is already an ApiError, re-throw it
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }

    // Use getUserFriendlyErrorMessage for consistent error messages
    const errorMessage = getUserFriendlyErrorMessage(error);
    throw {
      success: false,
      message: errorMessage,
    } as ApiError;
  }
};

/**
 * Delete a ride
 */
export const deleteRide = async (
  rideId: number,
  driverId: number
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.RIDES.DELETE(rideId)}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ driverId }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to delete ride",
      } as ApiError;
    }

    // Handle both wrapped (data) and direct response formats
    return {
      success: result.success ?? true,
      message:
        result.message || result.data?.message || "Ride deleted successfully",
    };
  } catch (error: any) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: "Network error. Please check your connection.",
    } as ApiError;
  }
};

/**
 * Update a ride
 * Note: driverId is now obtained from JWT token - parameter kept for backwards compatibility but not used
 */
export const updateRide = async (
  rideId: number,
  data: Partial<CreateRideRequest>,
  driverId?: number
): Promise<CreateRideResponse> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.RIDES.UPDATE(rideId)}`;

    // Use apiFetch with retry logic for network errors
    const response = await apiFetch(
      url,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      },
      { maxRetries: 3, initialDelay: 1000 }, // Retry up to 3 times with 1s initial delay
      true // requireAuth
    );

    // Check if response has content before parsing JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      throw {
        success: false,
        message: text || "Invalid response from server",
        status: response.status,
      } as ApiError;
    }

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to update ride",
        errors: result.errors || [],
        status: response.status,
      } as ApiError;
    }

    // Handle both wrapped (data.ride) and direct (ride) response formats
    const ride = result.data?.ride ?? result.ride;

    return {
      success: result.success ?? true,
      message: result.message || "Ride updated successfully",
      ride: ride,
    } as CreateRideResponse;
  } catch (error: unknown) {
    // If error is already an ApiError, re-throw it
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }

    // Use getUserFriendlyErrorMessage for consistent error messages
    const errorMessage = getUserFriendlyErrorMessage(error);
    throw {
      success: false,
      message: errorMessage,
    } as ApiError;
  }
};

/**
 * Start a ride
 */
export const startRide = async (
  rideId: number,
  driverId: number
): Promise<{ success: boolean; message: string; ride?: Ride }> => {
  try {
    // Backend expects PUT method with driverId as query parameter
    const url = `${API_BASE_URL}${API_ENDPOINTS.RIDES.START(
      rideId
    )}?driverId=${driverId}`;
    const response = await apiFetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Check if response has content before parsing JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      throw {
        success: false,
        message: text || "Invalid response from server",
      } as ApiError;
    }

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to start ride",
        errors: result.errors || [],
      } as ApiError;
    }

    // Backend returns: { success: true, message: "Ride started successfully" }
    // It doesn't return the ride object, so we'll return success without ride
    return {
      success: result.success ?? true,
      message: result.message || "Ride started successfully",
      ride: result.data?.ride ?? result.ride ?? undefined,
    };
  } catch (error: unknown) {
    // Handle JSON parse errors specifically
    if (error instanceof SyntaxError) {
      throw {
        success: false,
        message: "Invalid response from server. Please try again.",
      } as ApiError;
    }

    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }

    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Complete a ride
 */
export const completeRide = async (
  rideId: number,
  driverId: number,
  driverLatitude?: number,
  driverLongitude?: number
): Promise<{ success: boolean; message: string; ride?: Ride }> => {
  try {
    // Backend expects PUT method with driverId as query parameter
    const url = `${API_BASE_URL}${API_ENDPOINTS.RIDES.COMPLETE(
      rideId
    )}?driverId=${driverId}`;
    const response = await apiFetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...(driverLatitude !== undefined && { driverLatitude }),
        ...(driverLongitude !== undefined && { driverLongitude }),
      }),
    });

    // Check if response has content before parsing JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      throw {
        success: false,
        message: text || "Invalid response from server",
      } as ApiError;
    }

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to complete ride",
        errors: result.errors || [],
      } as ApiError;
    }

    // Handle both wrapped (data.ride) and direct (ride) response formats
    const ride = result.data?.ride ?? result.ride;

    return {
      success: result.success ?? true,
      message: result.message || "Ride completed successfully",
      ride: ride,
    };
  } catch (error: unknown) {
    // Handle JSON parse errors specifically
    if (error instanceof SyntaxError) {
      throw {
        success: false,
        message: "Invalid response from server. Please try again.",
      } as ApiError;
    }

    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }

    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Get a ride by ID
 * Note: driverId is now obtained from JWT token - parameter kept for backwards compatibility but not used
 */
export const getRideById = async (
  rideId: number,
  driverId?: number
): Promise<Ride> => {
  const url = `${API_BASE_URL}${API_ENDPOINTS.RIDES.GET_BY_ID(rideId)}`;

  try {
    // Use apiFetch with retry logic for network errors
    const response = await apiFetch(
      url,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
      { maxRetries: 3, initialDelay: 1000 }, // Retry up to 3 times with 1s initial delay
      true // requireAuth
    );

    // Check if response has content before parsing JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      throw {
        success: false,
        message: text || "Invalid response from server",
        status: response.status,
      } as ApiError;
    }

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to load ride",
      } as ApiError;
    }

    // Handle both wrapped (data.ride) and direct (ride) response formats
    const ride = result.data?.ride ?? result.ride;

    if (!ride) {
      throw {
        success: false,
        message: "Ride not found",
      } as ApiError;
    }

    return ride as Ride;
  } catch (error: unknown) {
    // If error is already an ApiError, re-throw it
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }

    // Use getUserFriendlyErrorMessage for consistent error messages
    const errorMessage = getUserFriendlyErrorMessage(error);
    throw {
      success: false,
      message: errorMessage,
    } as ApiError;
  }
};

// ==================== PROFILE ====================

export interface NotificationPreferences {
  notifyBookings: boolean;
  notifyMessages: boolean;
  notifyRideUpdates: boolean;
  notifyPromotions: boolean;
  shareLocationEnabled: boolean;
}

export interface ProfileData {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  city: string | null;
  photoUrl: string | null;
  carMake: string | null;
  carModel: string | null;
  carYear: number | null;
  carColor: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get driver profile
 * Note: driverId is now obtained from JWT token - parameter kept for backwards compatibility but not used
 */
export const getProfile = async (driverId?: number): Promise<ProfileData> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PROFILE.GET}`;
    const response = await apiFetch(
      url,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
      {},
      true // requireAuth
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to load profile",
      } as ApiError;
    }

    // Handle both wrapped (data.user) and direct (user) response formats
    // Backend returns: { success: true, message: "...", data: { user: {...} } }
    const profile = result.data?.user ?? result.user ?? result;

    if (!profile || !profile.id) {
      throw {
        success: false,
        message: "Profile data not found in response",
      } as ApiError;
    }

    return profile as ProfileData;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Update driver profile
 * Note: driverId is now obtained from JWT token - parameter kept for backwards compatibility but not used
 */
export const updateProfile = async (
  driverId: number,
  data: {
    fullName?: string;
    email?: string;
    phoneNumber?: string;
    city?: string;
    photoUrl?: string;
  }
): Promise<{ success: boolean; message: string; user?: ProfileData }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PROFILE.UPDATE}`;
    const response = await apiFetch(
      url,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data), // Remove driverId from body
      },
      {},
      true // requireAuth
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to update profile",
        errors: result.errors || [],
      } as ApiError;
    }

    // Handle both wrapped (data.user) and direct (user) response formats
    const user = result.data?.user ?? result.user;

    return {
      success: result.success ?? true,
      message: result.message || "Profile updated successfully",
      user: user,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Update driver password
 */
export const updatePassword = async (
  driverId: number,
  data: {
    currentPassword: string;
    newPassword: string;
  }
): Promise<{ success: boolean; message: string }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PROFILE.UPDATE_PASSWORD}`;
    const response = await apiFetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ driverId, ...data }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to update password",
        errors: result.errors || [],
      } as ApiError;
    }

    return {
      success: result.success ?? true,
      message:
        result.message ||
        result.data?.message ||
        "Password updated successfully",
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Get notification preferences
 */
export const getPreferences = async (
  driverId: number
): Promise<{ success: boolean; preferences: NotificationPreferences }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PROFILE.GET_PREFERENCES}?driverId=${driverId}`;
    const response = await apiFetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to load preferences",
      } as ApiError;
    }

    // Handle both wrapped (data.preferences) and direct (preferences) response formats
    const preferences = result.data?.preferences ?? result.preferences;

    return {
      success: result.success ?? true,
      preferences: preferences || {
        notifyBookings: true,
        notifyMessages: true,
        notifyRideUpdates: true,
        notifyPromotions: true,
        shareLocationEnabled: true,
      },
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Update notification preferences
 */
export const updatePreferences = async (
  driverId: number,
  preferences: Partial<NotificationPreferences>
): Promise<{
  success: boolean;
  message: string;
  preferences: NotificationPreferences;
}> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PROFILE.UPDATE_PREFERENCES}`;
    const response = await apiFetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ driverId, ...preferences }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to update preferences",
      } as ApiError;
    }

    // Handle both wrapped (data.preferences) and direct (preferences) response formats
    const updatedPreferences = result.data?.preferences ?? result.preferences;

    return {
      success: result.success ?? true,
      message: result.message || "Preferences updated successfully",
      preferences: updatedPreferences,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Delete driver account
 */
export const deleteAccount = async (
  driverId: number,
  password: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PROFILE.DELETE}`;
    const response = await apiFetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ driverId, password }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to delete account",
        errors: result.errors || [],
      } as ApiError;
    }

    return {
      success: result.success ?? true,
      message:
        result.message ||
        result.data?.message ||
        "Account deleted successfully",
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

// ==================== VEHICLE ====================

export interface VehicleData {
  carMake: string | null;
  carModel: string | null;
  carYear: number | null;
  carColor: string | null;
}

/**
 * Get vehicle information
 * Note: driverId is now obtained from JWT token - parameter kept for backwards compatibility but not used
 */
export const getVehicle = async (driverId?: number): Promise<VehicleData> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.VEHICLE.GET}`;
    const response = await apiFetch(
      url,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
      {},
      true // requireAuth
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to load vehicle information",
      } as ApiError;
    }

    // Handle both wrapped (data.vehicle) and direct (vehicle) response formats
    const vehicle = result.data?.vehicle ?? result.vehicle;

    if (!vehicle) {
      throw {
        success: false,
        message: "Vehicle data not found in response",
      } as ApiError;
    }

    return vehicle as VehicleData;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Update vehicle information
 * Note: driverId is now obtained from JWT token - parameter kept for backwards compatibility but not used
 */
export const updateVehicle = async (
  driverId: number,
  data: Partial<VehicleData>
): Promise<{ success: boolean; message: string; vehicle: VehicleData }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.VEHICLE.UPDATE}`;
    const response = await apiFetch(
      url,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      },
      {},
      true // requireAuth
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to update vehicle information",
        errors: result.errors || [],
      } as ApiError;
    }

    // Handle both wrapped (data.vehicle) and direct (vehicle) response formats
    const vehicle = result.data?.vehicle ?? result.vehicle;

    return {
      success: result.success ?? true,
      message: result.message || "Vehicle information updated successfully",
      vehicle: vehicle,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

// ==================== NOTIFICATIONS ====================

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
    pickupCity: string;
    pickupState: string;
    pickupZipCode?: string;
    pickupLatitude?: number | null;
    pickupLongitude?: number | null;
    rider: {
      id: number;
      fullName: string;
      email: string;
      phoneNumber: string;
    };
    ride: {
      id: number;
      fromAddress: string;
      toAddress: string;
      fromCity: string;
      toCity: string;
      fromLatitude?: number | null;
      fromLongitude?: number | null;
      toLatitude?: number | null;
      toLongitude?: number | null;
      departureDate: string;
      departureTime: string;
      pricePerSeat: number;
    };
  } | null;
  ride?: {
    id: number;
    fromAddress: string;
    toAddress: string;
    fromCity: string;
    toCity: string;
  } | null;
}

/**
 * Get all notifications
 */
export const getNotifications = async (
  driverId: number
): Promise<{ success: boolean; notifications: Notification[] }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.NOTIFICATIONS.GET_ALL}?driverId=${driverId}`;
    const response = await apiFetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to load notifications",
      } as ApiError;
    }

    // Handle both wrapped (data.notifications) and direct (notifications) response formats
    const notifications =
      result.data?.notifications ?? result.notifications ?? [];

    return {
      success: result.success ?? true,
      notifications: Array.isArray(notifications) ? notifications : [],
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Mark notification as read
 */
export const markNotificationRead = async (
  notificationId: number,
  driverId: number
): Promise<{ success: boolean; message: string }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.NOTIFICATIONS.MARK_READ(
      notificationId
    )}?driverId=${driverId}`;
    const response = await apiFetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to mark notification as read",
      } as ApiError;
    }

    return {
      success: result.success ?? true,
      message: result.message || "Notification marked as read",
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsRead = async (
  driverId: number
): Promise<{ success: boolean; message: string }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ}?driverId=${driverId}`;
    const response = await apiFetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to mark all notifications as read",
      } as ApiError;
    }

    return {
      success: result.success ?? true,
      message: result.message || "All notifications marked as read",
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

// ==================== BOOKINGS ====================

/**
 * Accept a booking request
 */
export const acceptBooking = async (
  bookingId: number,
  driverId: number
): Promise<{ success: boolean; message: string; booking?: any }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.BOOKINGS.ACCEPT(
      bookingId
    )}?driverId=${driverId}`;
    const response = await apiFetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to accept booking",
      } as ApiError;
    }

    // Handle both wrapped (data.booking) and direct (booking) response formats
    const booking = result.data?.booking ?? result.booking;

    return {
      success: result.success ?? true,
      message: result.message || "Booking accepted successfully",
      booking: booking,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Reject a booking request
 */
export const rejectBooking = async (
  bookingId: number,
  driverId: number,
  rejectionReason?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.BOOKINGS.REJECT(
      bookingId
    )}?driverId=${driverId}`;
    const response = await apiFetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rejectionReason: rejectionReason && rejectionReason.trim() ? rejectionReason.trim() : undefined,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to reject booking",
      } as ApiError;
    }

    return {
      success: result.success ?? true,
      message: result.message || "Booking rejected successfully",
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Mark pickup as complete (with PIN verification)
 */
export const markPassengerPickedUp = async (
  bookingId: number,
  driverId: number,
  pin: string
): Promise<{ success: boolean; message: string; booking?: any }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.BOOKINGS.PICKUP_COMPLETE(
      bookingId
    )}?driverId=${driverId}`;
    const response = await apiFetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pin }),
    });

    // Check if response has content before parsing JSON
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      throw {
        success: false,
        message: text || "Invalid response from server",
      } as ApiError;
    }

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to mark pickup as complete",
        errors: result.errors || [],
        attemptsRemaining: result.attemptsRemaining,
      } as ApiError;
    }

    // Handle both wrapped (data.booking) and direct (booking) response formats
    const booking = result.data?.booking ?? result.booking;

    return {
      success: result.success ?? true,
      message: result.message || "Pickup marked as complete",
      booking: booking,
    };
  } catch (error: unknown) {
    // Handle JSON parse errors specifically
    if (error instanceof SyntaxError) {
      throw {
        success: false,
        message: "Invalid response from server. Please try again.",
      } as ApiError;
    }

    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Mark pickup as complete (without PIN - for backwards compatibility)
 */
export const pickupComplete = async (
  bookingId: number,
  driverId: number
): Promise<{ success: boolean; message: string }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.BOOKINGS.PICKUP_COMPLETE(
      bookingId
    )}?driverId=${driverId}`;
    const response = await apiFetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to mark pickup as complete",
      } as ApiError;
    }

    return {
      success: result.success ?? true,
      message: result.message || "Pickup marked as complete",
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

// ==================== LOCATION ====================

/**
 * Update driver location
 */
export const updateDriverLocation = async (
  driverId: number,
  latitude: number,
  longitude: number
): Promise<{ success: boolean; message: string }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.LOCATION.UPDATE}`;
    const response = await apiFetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ driverId, latitude, longitude }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to update location",
      } as ApiError;
    }

    return {
      success: result.success ?? true,
      message: result.message || "Location updated successfully",
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

// ==================== RATINGS ====================

export interface Rating {
  id: number;
  rideId: number;
  bookingId: number | null;
  raterId: number;
  ratedUserId: number;
  rating: number;
  feedback: string | null;
  createdAt: string;
  rater?: {
    id: number;
    fullName: string;
    photoUrl: string | null;
  };
  ratedUser?: {
    id: number;
    fullName: string;
    photoUrl: string | null;
  };
}

/**
 * Submit a rating
 */
export const submitRating = async (data: {
  rideId: number;
  bookingId?: number;
  driverId: number;
  riderId: number;
  rating: number;
  feedback?: string;
}): Promise<{ success: boolean; message: string; rating: Rating }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.RATINGS.SUBMIT}`;
    const response = await apiFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to submit rating",
      } as ApiError;
    }

    // Handle both wrapped (data.rating) and direct (rating) response formats
    const rating = result.data?.rating ?? result.rating;

    return {
      success: result.success ?? true,
      message: result.message || "Rating submitted successfully",
      rating: rating,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Get ratings for a ride
 */
export const getRatingByRide = async (
  rideId: number,
  driverId?: number
): Promise<{ success: boolean; ratings: Rating[] }> => {
  try {
    const url = driverId
      ? `${API_BASE_URL}${API_ENDPOINTS.RATINGS.GET_BY_RIDE(
          rideId
        )}?driverId=${driverId}`
      : `${API_BASE_URL}${API_ENDPOINTS.RATINGS.GET_BY_RIDE(rideId)}`;

    const response = await apiFetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to load ratings",
      } as ApiError;
    }

    // Handle both wrapped (data.ratings) and direct (ratings) response formats
    const ratings = result.data?.ratings ?? result.ratings ?? [];

    return {
      success: result.success ?? true,
      ratings: Array.isArray(ratings) ? ratings : [],
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

// ==================== MESSAGES ====================

export interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  message: string;
  isRead: boolean;
  rideId: number | null;
  bookingId: number | null;
  createdAt: string;
  sender?: {
    id: number;
    fullName: string;
    photoUrl: string | null;
  };
  receiver?: {
    id: number;
    fullName: string;
    photoUrl: string | null;
  };
}

export interface Conversation {
  partnerId: number;
  partnerName: string;
  partnerPhoto: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  rideId: number | null;
  ride?: {
    id: number;
    fromAddress: string;
    toAddress: string;
    departureDate: string;
    departureTime: string;
  };
}

/**
 * Get conversations
 */
export const getConversations = async (
  driverId: number
): Promise<{ success: boolean; conversations: Conversation[] }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.MESSAGES.CONVERSATIONS}?driverId=${driverId}`;
    const response = await apiFetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to load conversations",
      } as ApiError;
    }

    // Handle both wrapped (data.conversations) and direct (conversations) response formats
    const conversations =
      result.data?.conversations ?? result.conversations ?? [];

    return {
      success: result.success ?? true,
      conversations: Array.isArray(conversations) ? conversations : [],
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Get messages with a partner
 */
export const getMessages = async (
  partnerId: number,
  driverId: number,
  rideId?: number
): Promise<{ success: boolean; messages: Message[] }> => {
  try {
    const url = rideId
      ? `${API_BASE_URL}${API_ENDPOINTS.MESSAGES.GET_MESSAGES(
          partnerId
        )}?driverId=${driverId}&rideId=${rideId}`
      : `${API_BASE_URL}${API_ENDPOINTS.MESSAGES.GET_MESSAGES(
          partnerId
        )}?driverId=${driverId}`;

    const response = await apiFetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to load messages",
      } as ApiError;
    }

    // Handle both wrapped (data.messages) and direct (messages) response formats
    const messages = result.data?.messages ?? result.messages ?? [];

    return {
      success: result.success ?? true,
      messages: Array.isArray(messages) ? messages : [],
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Send a message
 */
export const sendMessage = async (data: {
  senderId: number;
  receiverId: number;
  message: string;
  rideId?: number;
  bookingId?: number;
}): Promise<{ success: boolean; message: string; sentMessage: Message }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.MESSAGES.SEND}`;
    const response = await apiFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to send message",
      } as ApiError;
    }

    // Handle both wrapped (data.message) and direct (message) response formats
    const sentMessage = result.data?.message ?? result.message;

    return {
      success: result.success ?? true,
      message: result.message || "Message sent successfully",
      sentMessage: sentMessage,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Cancel a ride
 */
export const cancelRide = async (
  rideId: number,
  driverId: number
): Promise<{ success: boolean; message: string; ride?: Ride }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.RIDES.CANCEL(
      rideId
    )}?driverId=${driverId}`;
    const response = await apiFetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to cancel ride",
      } as ApiError;
    }

    // Handle both wrapped (data.ride) and direct (ride) response formats
    const ride = result.data?.ride ?? result.ride;

    return {
      success: result.success ?? true,
      message: result.message || "Ride cancelled successfully",
      ride: ride,
    };
  } catch (error: unknown) {
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

// ==================== PAYOUTS ====================

export interface PayoutAccountStatus {
  hasAccount: boolean;
  accountId?: string;
  status?: string;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  bankAccount?: {
    id: string;
    last4: string;
    bankName: string;
    accountType: string;
    status: string;
  } | null;
  requirements?: any;
}

export interface PayoutHistoryItem {
  id: number;
  amount: number;
  currency: string;
  status: string;
  payoutMethod: string;
  description?: string;
  failureCode?: string;
  failureMessage?: string;
  arrivalDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayoutBalance {
  weeklyNetEarnings: number;
  pendingPayouts: number;
  availableBalance: number;
  currency: string;
}

/**
 * Create or retrieve Stripe Connect account
 */
export const createConnectAccount = async (
  driverId: number
): Promise<{
  success: boolean;
  accountId?: string;
  onboardingUrl?: string;
  status?: string;
}> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PAYOUTS.CONNECT_ACCOUNT}`;
    const response = await apiFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ driverId }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || getUserFriendlyErrorMessage(result),
      } as ApiError;
    }

    return result.data || result;
  } catch (error: unknown) {
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Get Stripe Connect account status
 */
export const getAccountStatus = async (
  driverId: number
): Promise<PayoutAccountStatus> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PAYOUTS.ACCOUNT_STATUS}?driverId=${driverId}`;
    const response = await apiFetch(url);

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || getUserFriendlyErrorMessage(result),
      } as ApiError;
    }

    return result.data || result;
  } catch (error: unknown) {
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Create account link for onboarding
 */
export const createAccountLink = async (
  driverId: number,
  type: "account_onboarding" | "account_update" = "account_onboarding"
): Promise<{
  success: boolean;
  url: string;
}> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PAYOUTS.CREATE_ACCOUNT_LINK}`;
    const response = await apiFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ driverId, type }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || getUserFriendlyErrorMessage(result),
      } as ApiError;
    }

    return result.data || result;
  } catch (error: unknown) {
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Initiate a payout
 */
export const initiatePayout = async (
  driverId: number,
  amount: number,
  description?: string
): Promise<{
  success: boolean;
  payoutId: string;
  stripePayoutId: string;
  amount: number;
  status: string;
  arrivalDate?: string;
}> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PAYOUTS.INITIATE}`;
    const response = await apiFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ driverId, amount, description }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || getUserFriendlyErrorMessage(result),
      } as ApiError;
    }

    return result.data || result;
  } catch (error: unknown) {
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Get payout history
 */
export const getPayoutHistory = async (
  driverId: number,
  limit: number = 20,
  offset: number = 0
): Promise<{
  success: boolean;
  payouts: PayoutHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PAYOUTS.HISTORY}?driverId=${driverId}&limit=${limit}&offset=${offset}`;
    const response = await apiFetch(url);

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || getUserFriendlyErrorMessage(result),
      } as ApiError;
    }

    return result.data || result;
  } catch (error: unknown) {
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Get available balance for payout
 */
export const getPayoutBalance = async (
  driverId: number
): Promise<PayoutBalance> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PAYOUTS.BALANCE}?driverId=${driverId}`;
    const response = await apiFetch(url);

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || getUserFriendlyErrorMessage(result),
      } as ApiError;
    }

    return result.data || result;
  } catch (error: unknown) {
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Update Stripe Connect account information (for in-app onboarding)
 */
export const updatePayoutAccount = async (
  driverId: number,
  data: {
    ssnLast4?: string;
    dob?: string; // YYYY-MM-DD format
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    bankAccountToken?: string;
  }
): Promise<{
  success: boolean;
  accountId: string;
  status: string;
  payoutsEnabled: boolean;
  requirements?: any;
  bankAccount?: {
    id: string;
    last4: string;
    bankName: string;
    accountType: string;
    status: string;
  } | null;
  needsIndividualInfo?: boolean;
  message?: string;
}> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PAYOUTS.UPDATE_ACCOUNT}`;
    const response = await apiFetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ driverId, ...data }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || getUserFriendlyErrorMessage(result),
      } as ApiError;
    }

    return result.data || result;
  } catch (error: unknown) {
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Create bank account token (for in-app onboarding)
 * Note: In production, this should be done client-side with Stripe.js for security
 */
export const createBankAccountToken = async (
  driverId: number,
  bankData: {
    accountNumber: string;
    routingNumber: string;
    accountHolderName: string;
    accountType?: "checking" | "savings";
  }
): Promise<{
  success: boolean;
  token: string;
}> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PAYOUTS.CREATE_BANK_TOKEN}`;
    const response = await apiFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ driverId, ...bankData }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || getUserFriendlyErrorMessage(result),
      } as ApiError;
    }

    return result.data || result;
  } catch (error: unknown) {
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Get account requirements (what information is still needed)
 */
export const getAccountRequirements = async (
  driverId: number
): Promise<{
  success: boolean;
  requirements: any;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  currentlyDue: string[];
  eventuallyDue: string[];
  pastDue: string[];
  disabledReason: string | null;
}> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PAYOUTS.ACCOUNT_REQUIREMENTS}?driverId=${driverId}`;
    const response = await apiFetch(url);

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || getUserFriendlyErrorMessage(result),
      } as ApiError;
    }

    return result.data || result;
  } catch (error: unknown) {
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Delete/unlink Stripe Connect account
 */
export const deletePayoutAccount = async (
  driverId: number
): Promise<{
  success: boolean;
  deleted: boolean;
}> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PAYOUTS.DELETE_ACCOUNT}?driverId=${driverId}`;
    const response = await apiFetch(url, {
      method: "DELETE",
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || getUserFriendlyErrorMessage(result),
      } as ApiError;
    }

    return result.data || result;
  } catch (error: unknown) {
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Reset/clear Stripe status in database (for testing)
 * This clears database fields WITHOUT deleting the Stripe account
 */
export const resetStripeStatus = async (
  driverId: number
): Promise<{
  success: boolean;
  reset: boolean;
  note?: string;
}> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PAYOUTS.RESET_STRIPE_STATUS}`;
    const response = await apiFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ driverId }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || getUserFriendlyErrorMessage(result),
      } as ApiError;
    }

    return result.data || result;
  } catch (error: unknown) {
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Get Stripe Connect account status
 */
export const getConnectStatus = async (
  driverId: number
): Promise<{
  hasAccount: boolean;
  stripeAccountId: string | null;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  currentlyDue: string[];
  detailsSubmitted?: boolean;
}> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.CONNECT.STATUS}?driverId=${driverId}`;
    const response = await apiFetch(url, {
      method: "GET",
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || getUserFriendlyErrorMessage(result),
      } as ApiError;
    }

    return result.data || result;
  } catch (error: unknown) {
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

// ==================== Stripe Connect Custom Account APIs ====================

export interface ConnectRequirements {
  hasAccount: boolean;
  stripeAccountId?: string;
  payoutsEnabled?: boolean;
  chargesEnabled?: boolean;
  currentlyDue?: string[];
  eventuallyDue?: string[];
  pastDue?: string[];
  disabledReason?: string | null;
}

/**
 * Create Custom connected account
 */
export const createCustomConnectAccount = async (
  driverId: number
): Promise<{ stripeAccountId: string }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.CONNECT.CUSTOM_CREATE}`;
    const response = await apiFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ driverId }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || getUserFriendlyErrorMessage(result),
      } as ApiError;
    }

    return result.data || result;
  } catch (error: unknown) {
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Get Connect requirements
 */
/**
 * Clear business_profile requirements for individual accounts
 */
export const clearBusinessProfile = async (driverId: number): Promise<ConnectRequirements> => {
  try {
    const response = await apiFetch(
      `${API_BASE_URL}/api/driver/connect/custom/clear-business-profile`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ driverId }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to clear business profile");
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    throw new Error(getUserFriendlyErrorMessage(error));
  }
};

export const getConnectRequirements = async (
  driverId: number
): Promise<ConnectRequirements> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.CONNECT.REQUIREMENTS}?driverId=${driverId}`;
    const response = await apiFetch(url, {
      method: "GET",
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || getUserFriendlyErrorMessage(result),
      } as ApiError;
    }

    return result.data || result;
  } catch (error: unknown) {
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

export interface IndividualInfoPayload {
  firstName: string;
  lastName: string;
  phone: string;
  dob: {
    day: number;
    month: number;
    year: number;
  };
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
  };
  ssnLast4?: string;
  idNumber?: string;
}

/**
 * Update individual information
 */
export const updateIndividualInfo = async (
  driverId: number,
  payload: IndividualInfoPayload
): Promise<ConnectRequirements> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.CONNECT.UPDATE_INDIVIDUAL}`;
    const response = await apiFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ driverId, ...payload }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || getUserFriendlyErrorMessage(result),
      } as ApiError;
    }

    return result.data || result;
  } catch (error: unknown) {
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

export interface ConnectBankAccountTokenPayload {
  routingNumber: string;
  accountNumber: string;
  accountHolderName: string;
}

/**
 * Create bank account token for Stripe Connect Custom account
 */
export const createConnectBankAccountToken = async (
  driverId: number,
  payload: ConnectBankAccountTokenPayload
): Promise<{ tokenId: string }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.CONNECT.BANK_TOKEN}`;
    const response = await apiFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ driverId, ...payload }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || getUserFriendlyErrorMessage(result),
      } as ApiError;
    }

    return result.data || result;
  } catch (error: unknown) {
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Attach bank account to connected account
 */
export const attachBankAccount = async (
  driverId: number,
  tokenId: string
): Promise<ConnectRequirements> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.CONNECT.ATTACH_BANK}`;
    const response = await apiFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ driverId, tokenId }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || getUserFriendlyErrorMessage(result),
      } as ApiError;
    }

    return result.data || result;
  } catch (error: unknown) {
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
    } as ApiError;
  }
};

/**
 * Upload verification document
 */
export const uploadVerificationDocument = async (
  driverId: number,
  frontUri: string,
  backUri?: string,
  onProgress?: (progress: number) => void
): Promise<ConnectRequirements> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.CONNECT.UPLOAD_DOCUMENT}`;
    console.log("[uploadVerificationDocument] Starting upload for driver:", driverId);
    console.log("[uploadVerificationDocument] Front URI:", frontUri.substring(0, 50) + "...");
    if (backUri) {
      console.log("[uploadVerificationDocument] Back URI:", backUri.substring(0, 50) + "...");
    }

    // Build FormData - React Native FormData format
    const formData = new FormData();
    
    // Append driverId (needed for test mode and some auth setups)
    formData.append("driverId", driverId.toString());

    // Extract filename from URI or use default
    const getFilename = (uri: string, defaultName: string): string => {
      const uriParts = uri.split("/");
      const filename = uriParts[uriParts.length - 1];
      // If filename has extension, use it; otherwise add .jpg
      if (filename.includes(".")) {
        return filename;
      }
      return `${defaultName}.jpg`;
    };

    // Append front (required)
    const frontFilename = getFilename(frontUri, "front");
    formData.append("front", {
      uri: frontUri,
      type: "image/jpeg",
      name: frontFilename,
    } as any);

    // Append back only if selected
    if (backUri) {
      const backFilename = getFilename(backUri, "back");
      formData.append("back", {
        uri: backUri,
        type: "image/jpeg",
        name: backFilename,
      } as any);
    }

    console.log("[uploadVerificationDocument] Sending request to:", url);
    console.log("[uploadVerificationDocument] API_BASE_URL:", API_BASE_URL);
    console.log("[uploadVerificationDocument] Full URL:", url);
    
    // Test connection first (quick health check) - but don't fail if it times out
    // Some networks may block health checks but allow the actual upload
    try {
      console.log("[uploadVerificationDocument] Testing backend connection...");
      const healthController = new AbortController();
      const healthTimeout = setTimeout(() => healthController.abort(), 10000); // 10 second timeout
      
      const healthCheck = await fetch(`${API_BASE_URL}/health`, {
        method: "GET",
        signal: healthController.signal,
      });
      clearTimeout(healthTimeout);
      
      console.log("[uploadVerificationDocument] Health check status:", healthCheck.status);
      if (healthCheck.ok) {
        console.log("[uploadVerificationDocument] ✅ Backend is reachable");
      } else {
        console.warn("[uploadVerificationDocument] ⚠️  Health check returned non-OK status, but continuing anyway");
      }
    } catch (healthError: any) {
      // Don't fail the upload if health check fails - just log a warning
      // The actual upload might still work
      console.warn("[uploadVerificationDocument] ⚠️  Health check failed, but continuing with upload:", healthError?.message);
      console.warn("[uploadVerificationDocument] This may be a network configuration issue, but upload will still be attempted");
    }
    
    // For file uploads, use a longer timeout and disable retries (file uploads shouldn't be retried)
    // Use direct fetch instead of apiFetch to avoid retries and have better control
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error("[uploadVerificationDocument] Request timeout after 5 minutes");
      console.error("[uploadVerificationDocument] URL was:", url);
      console.error("[uploadVerificationDocument] This usually means:");
      console.error("  1. Backend is not responding");
      console.error("  2. Network connectivity issue");
      console.error("  3. Backend is processing but taking too long");
      controller.abort();
    }, 300000); // 5 minute timeout for file uploads (Stripe can be slow)

    try {
      console.log("[uploadVerificationDocument] ===== STARTING FETCH ===== ");
      console.log("[uploadVerificationDocument] Method: POST");
      console.log("[uploadVerificationDocument] URL:", url);
      console.log("[uploadVerificationDocument] FormData entries:", {
        hasDriverId: formData.has("driverId"),
        hasFront: formData.has("front"),
        hasBack: formData.has("back"),
      });
      
      // Log file sizes if possible
      try {
        const formDataAny = formData as any;
        const frontFile = formDataAny._parts?.find((p: any) => p[0] === "front")?.[1];
        const backFile = formDataAny._parts?.find((p: any) => p[0] === "back")?.[1];
        if (frontFile) {
          console.log("[uploadVerificationDocument] Front file type:", typeof frontFile);
          if (frontFile.uri) console.log("[uploadVerificationDocument] Front file URI:", frontFile.uri.substring(0, 50));
        }
        if (backFile) {
          console.log("[uploadVerificationDocument] Back file type:", typeof backFile);
          if (backFile.uri) console.log("[uploadVerificationDocument] Back file URI:", backFile.uri.substring(0, 50));
        }
      } catch (e) {
        console.warn("[uploadVerificationDocument] Could not inspect FormData parts:", e);
      }
      
      console.log("[uploadVerificationDocument] About to call fetch()...");
      console.log("[uploadVerificationDocument] AbortController signal:", controller.signal.aborted ? "ABORTED" : "ACTIVE");
      
      const fetchStartTime = Date.now();
      
      // Add a heartbeat to see if we're stuck
      const heartbeat = setInterval(() => {
        const elapsed = Date.now() - fetchStartTime;
        console.log(`[uploadVerificationDocument] ⏱️  Still waiting... ${elapsed}ms elapsed`);
      }, 5000); // Log every 5 seconds
      
      let response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            // Do NOT manually set Content-Type - let FormData set it with boundary
            // React Native will automatically set Content-Type with boundary for FormData
            // Authorization header will be added by apiFetch wrapper if needed
          },
          body: formData,
          signal: controller.signal,
        });
        clearInterval(heartbeat);
        console.log("[uploadVerificationDocument] ✅ Fetch promise resolved!");
      } catch (fetchError: any) {
        clearInterval(heartbeat);
        const elapsed = Date.now() - fetchStartTime;
        console.error("[uploadVerificationDocument] ❌ Fetch promise rejected after", elapsed, "ms");
        console.error("[uploadVerificationDocument] Error details:", {
          name: fetchError?.name,
          message: fetchError?.message,
          code: fetchError?.code,
          type: fetchError?.type,
        });
        
        // Check if it's a network error
        if (fetchError?.name === "AbortError" || fetchError?.message?.includes("aborted")) {
          throw {
            success: false,
            message: `Upload timed out after ${Math.round(elapsed / 1000)} seconds. Please check your connection and try again.`,
          } as ApiError;
        }
        
        if (fetchError?.message?.includes("Network request failed") || fetchError?.message?.includes("Failed to fetch")) {
          throw {
            success: false,
            message: `Network error: Could not connect to ${API_BASE_URL}. Please check your internet connection and API URL.`,
          } as ApiError;
        }
        
        throw fetchError;
      }

      const fetchTime = Date.now() - fetchStartTime;
      clearTimeout(timeoutId);

      console.log("[uploadVerificationDocument] ===== FETCH COMPLETED ===== ");
      console.log("[uploadVerificationDocument] Fetch took:", fetchTime, "ms");
      console.log("[uploadVerificationDocument] Response status:", response.status);
      console.log("[uploadVerificationDocument] Response ok:", response.ok);
      console.log("[uploadVerificationDocument] Response statusText:", response.statusText);
      
      try {
        const headersObj: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headersObj[key] = value;
        });
        console.log("[uploadVerificationDocument] Response headers:", headersObj);
      } catch (headerError) {
        console.warn("[uploadVerificationDocument] Could not log headers:", headerError);
      }

      if (!response.ok) {
        let errorMessage = `Upload failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
          console.error("[uploadVerificationDocument] Error response:", errorData);
        } catch (e) {
          const errorText = await response.text();
          console.error("[uploadVerificationDocument] Error text:", errorText);
          errorMessage = errorText || errorMessage;
        }
        throw {
          success: false,
          message: errorMessage,
          status: response.status,
        } as ApiError;
      }

      const result = await response.json();
      console.log("[uploadVerificationDocument] Upload successful:", result);
      
      // Backend returns: { success, message, frontFileId, backFileId?, payoutsEnabled, chargesEnabled, currentlyDue, eventuallyDue, pastDue, disabledReason? }
      // Frontend expects: ConnectRequirements { hasAccount, stripeAccountId?, payoutsEnabled?, chargesEnabled?, currentlyDue?, eventuallyDue?, pastDue?, disabledReason? }
      
      if (result.success) {
        // Transform backend response to ConnectRequirements format
        const connectRequirements: ConnectRequirements = {
          hasAccount: true, // We have an account if upload succeeded
          payoutsEnabled: result.payoutsEnabled,
          chargesEnabled: result.chargesEnabled,
          currentlyDue: result.currentlyDue || [],
          eventuallyDue: result.eventuallyDue || [],
          pastDue: result.pastDue || [],
          disabledReason: result.disabledReason || null,
        };
        
        console.log("[uploadVerificationDocument] Transformed response:", connectRequirements);
        return connectRequirements;
      }
      
      // Fallback for old format
      return result.data || result;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      console.error("[uploadVerificationDocument] ===== FETCH ERROR ===== ");
      console.error("[uploadVerificationDocument] Error name:", fetchError?.name);
      console.error("[uploadVerificationDocument] Error message:", fetchError?.message);
      console.error("[uploadVerificationDocument] Error type:", typeof fetchError);
      console.error("[uploadVerificationDocument] Full error:", fetchError);
      
      if (fetchError.name === "AbortError" || fetchError.name === "TimeoutError") {
        console.error("[uploadVerificationDocument] Upload timeout - request was aborted");
        console.error("[uploadVerificationDocument] This means the request took longer than 5 minutes");
        console.error("[uploadVerificationDocument] Possible causes:");
        console.error("  1. Backend is not responding");
        console.error("  2. Network is very slow");
        console.error("  3. Backend is stuck processing");
        console.error("[uploadVerificationDocument] URL was:", url);
        throw {
          success: false,
          message: "Upload timed out after 5 minutes. Please check your connection and try again. If the problem persists, check backend logs.",
        } as ApiError;
      }
      
      if (fetchError.message?.includes("Network request failed") || 
          fetchError.message?.includes("Failed to fetch") ||
          fetchError.message?.includes("NetworkError")) {
        console.error("[uploadVerificationDocument] Network error - cannot reach backend");
        console.error("[uploadVerificationDocument] API_BASE_URL:", API_BASE_URL);
        throw {
          success: false,
          message: `Network error: Cannot reach backend server at ${API_BASE_URL}. Please check your connection and API URL configuration.`,
        } as ApiError;
      }
      
      console.error("[uploadVerificationDocument] Unknown fetch error:", fetchError);
      throw fetchError;
    }
  } catch (error: unknown) {
    console.error("[uploadVerificationDocument] Upload error:", error);
    const errorMessage = getUserFriendlyErrorMessage(error);
    console.error("[uploadVerificationDocument] Error message:", errorMessage);
    throw {
      success: false,
      message: errorMessage,
    } as ApiError;
  }
};
