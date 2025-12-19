import { API_BASE_URL, API_ENDPOINTS } from "@/config/api";
import { getUserFriendlyErrorMessage } from "@/utils/errorHandler";
import { fetchWithRetry, RetryOptions } from "@/utils/apiRetry";

/**
 * Internal helper function to make API calls with automatic retry logic
 * All API functions should use this helper instead of direct fetch
 */
async function apiFetch(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  try {
    return await fetchWithRetry(url, options, retryOptions);
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
      photoUrl: string | null;
      city: string | null;
      carMake: string | null;
      carModel: string | null;
      carYear: number | null;
      carColor: string | null;
      createdAt: string;
      updatedAt: string;
    };
  };
  // For backwards compatibility, also allow direct user field
  user?: {
    id: number;
    fullName: string;
    email: string;
    phoneNumber: string;
    isDriver: boolean;
    isRider: boolean;
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

    return {
      success: result.success ?? true,
      message: result.message || "Signup successful",
      user: user,
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
    // Backend wraps response in data field: { success: true, message: "...", data: { user: {...} } }
    const user = result.data?.user ?? result.user;

    const loginResponse: LoginResponse = {
      success: result.success ?? true,
      message: result.message,
      ...(result.data ? { data: result.data } : {}),
      user: user, // Extract user from either location
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

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Logout failed",
        status: response.status,
      } as ApiError;
    }

    return result as LogoutResponse;
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
 * Individual ride earning details
 */
export interface EarningsBreakdown {
  grossEarnings: number;
  processingFee: number;
  commission: number;
  totalFees: number;
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
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message:
          result.message || "Unable to retrieve earnings. Please try again.",
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
  } catch (error) {
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
export const getUpcomingRides = async (driverId?: number): Promise<Ride[]> => {
  try {
    const url = driverId
      ? `${API_BASE_URL}${API_ENDPOINTS.RIDES.UPCOMING}?driverId=${driverId}`
      : `${API_BASE_URL}${API_ENDPOINTS.RIDES.UPCOMING}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

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
 */
export const getPastRides = async (driverId: number): Promise<Ride[]> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.RIDES.PAST}?driverId=${driverId}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

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
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.RIDES.CREATE}`,
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
        message: result.message || "Failed to create ride",
        errors: result.errors || [],
      } as ApiError;
    }

    // Handle both wrapped (data.ride) and direct (ride) response formats
    const ride = result.data?.ride ?? result.ride;

    return {
      success: result.success ?? true,
      message: result.message || "Ride created successfully",
      ride: ride,
    } as CreateRideResponse;
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
 */
export const updateRide = async (
  rideId: number,
  data: Partial<CreateRideRequest>
): Promise<CreateRideResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.RIDES.UPDATE(rideId)}`,
      {
        method: "PUT",
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
        message: result.message || "Failed to update ride",
        errors: result.errors || [],
      } as ApiError;
    }

    // Handle both wrapped (data.ride) and direct (ride) response formats
    const ride = result.data?.ride ?? result.ride;

    return {
      success: result.success ?? true,
      message: result.message || "Ride updated successfully",
      ride: ride,
    } as CreateRideResponse;
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
 */
export const getRideById = async (
  rideId: number,
  driverId?: number
): Promise<Ride> => {
  try {
    const url = driverId
      ? `${API_BASE_URL}${API_ENDPOINTS.RIDES.GET_BY_ID(
          rideId
        )}?driverId=${driverId}`
      : `${API_BASE_URL}${API_ENDPOINTS.RIDES.GET_BY_ID(rideId)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

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
 */
export const getProfile = async (driverId: number): Promise<ProfileData> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PROFILE.GET}?driverId=${driverId}`;
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
 */
export const getVehicle = async (driverId: number): Promise<VehicleData> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.VEHICLE.GET}?driverId=${driverId}`;
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
 */
export const updateVehicle = async (
  driverId: number,
  data: Partial<VehicleData>
): Promise<{ success: boolean; message: string; vehicle: VehicleData }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.VEHICLE.UPDATE}?driverId=${driverId}`;
    const response = await apiFetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

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
  driverId: number
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
  backUri?: string
): Promise<ConnectRequirements> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.CONNECT.UPLOAD_DOCUMENT}`;

    // Create FormData
    const formData = new FormData();
    formData.append("driverId", driverId.toString());

    // Add front image
    const frontFile = {
      uri: frontUri,
      type: "image/jpeg",
      name: "front.jpg",
    } as any;
    formData.append("front", frontFile);

    // Add back image if provided
    if (backUri) {
      const backFile = {
        uri: backUri,
        type: "image/jpeg",
        name: "back.jpg",
      } as any;
      formData.append("back", backFile);
    }

    const response = await apiFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data",
      },
      body: formData,
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
