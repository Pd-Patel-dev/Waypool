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
    if (error && typeof error === 'object' && 'response' in error) {
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
  recurringPattern?: 'daily' | 'weekly' | 'monthly' | null;
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
  recurringPattern?: 'daily' | 'weekly' | 'monthly' | null;
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

    return result as SignupResponse;
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

    return result as LoginResponse;
  } catch (error: any) {
    if (error && typeof error === "object" && "message" in error && "success" in error) {
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
    if (error && typeof error === "object" && "message" in error && "success" in error) {
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
export interface RideEarning {
  rideId: number;
  date: string; // ISO date string for parsing
  displayDate?: string; // Formatted date for display
  from: string;
  to: string;
  seatsBooked: number;
  pricePerSeat: number;
  distance: number;
  earnings: number;
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

export const getEarnings = async (driverId: number): Promise<EarningsResponse> => {
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
        message: result.message || "Unable to retrieve earnings. Please try again.",
      } as ApiError;
    }

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

    return result as CheckEmailResponse;
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
 * Get a specific ride by ID with all details including passengers
 * @param rideId - The ID of the ride to fetch
 * @param driverId - Optional driver ID to verify ownership
 */
export const getRideById = async (
  rideId: number,
  driverId?: number
): Promise<Ride> => {
  try {
    // Build URL with driverId query parameter if provided
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

    if (!response.ok) {
      const result = await response.json();
      throw {
        success: false,
        message: result.message || "Unable to load ride details. Please try again.",
      } as ApiError;
    }

    const result = await response.json();

    if (!result.ride) {
      throw {
        success: false,
        message: "Ride data not found in response",
      } as ApiError;
    }

    return result.ride;
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
 * Submit a rating for a passenger
 */
export const submitRating = async (
  rideId: number,
  bookingId: number | null,
  driverId: number,
  riderId: number,
  rating: number,
  feedback?: string
): Promise<{ success: boolean; message: string; rating?: any }> => {
  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.RATINGS.SUBMIT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        rideId,
        bookingId,
        driverId,
        riderId,
        rating,
        feedback,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || 'Unable to submit rating. Please try again.',
      } as ApiError;
    }

    return result;
  } catch (error: any) {
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
 * Get ratings for a specific ride
 */
export const getRideRatings = async (rideId: number, driverId?: number): Promise<{ success: boolean; ratings: any[] }> => {
  try {
    const url = driverId
      ? `${API_BASE_URL}${API_ENDPOINTS.RATINGS.GET_BY_RIDE(rideId)}?driverId=${driverId}`
      : `${API_BASE_URL}${API_ENDPOINTS.RATINGS.GET_BY_RIDE(rideId)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || 'Unable to load ratings. Please try again.',
      } as ApiError;
    }

    return result;
  } catch (error: any) {
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
 * Get past/completed rides for the driver
 * @param driverId - The ID of the driver to fetch rides for
 */
export const getPastRides = async (driverId?: number): Promise<Ride[]> => {
  try {
    const url = driverId
      ? `${API_BASE_URL}${API_ENDPOINTS.RIDES.PAST}?driverId=${driverId}`
      : `${API_BASE_URL}${API_ENDPOINTS.RIDES.PAST}`;


    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const result = await response.json();
      throw {
        success: false,
        message: result.message || "Unable to load past rides. Please try again.",
      } as ApiError;
    }

    const result = await response.json();
    return result.rides || [];
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

    if (!response.ok) {
      const result = await response.json();
      throw {
        success: false,
        message: result.message || "Unable to load upcoming rides. Please try again.",
      } as ApiError;
    }

    const result = await response.json();
    return result.rides || [];
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
export const createRide = async (data: CreateRideRequest): Promise<CreateRideResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.RIDES.CREATE}`, {
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
        message: result.message || "Unable to create ride. Please check your input and try again.",
        errors: result.errors || [],
      } as ApiError;
    }

    return result as CreateRideResponse;
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
export const deleteRide = async (rideId: number, driverId: number): Promise<{ success: boolean; message: string }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.RIDES.DELETE(rideId)}?driverId=${driverId}`;
    
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Unable to delete ride. Please try again.",
      } as ApiError;
    }

    return result;
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
  driverId: number,
  data: Partial<CreateRideRequest>
): Promise<{ success: boolean; message: string; ride?: Ride }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.RIDES.UPDATE(rideId)}?driverId=${driverId}`;
    
    const response = await fetch(url, {
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
        message: result.message || "Unable to update ride. Please try again.",
        errors: result.errors || [],
      } as ApiError;
    }

    return result;
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
 * Cancel a ride
 */
export const cancelRide = async (rideId: number, driverId: number): Promise<{ success: boolean; message: string }> => {
  try {
    // driverId should be sent as query parameter, not in body
    const url = `${API_BASE_URL}${API_ENDPOINTS.RIDES.CANCEL(rideId)}?driverId=${driverId}`;
    
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Unable to cancel ride. Please try again.",
      } as ApiError;
    }

    return result;
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
export const startRide = async (rideId: number, driverId: number): Promise<{ success: boolean; message: string; ride?: Ride }> => {
  try {
    // driverId should be sent as query parameter, not in body
    const url = `${API_BASE_URL}${API_ENDPOINTS.RIDES.START(rideId)}?driverId=${driverId}`;
    
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Unable to start ride. Please ensure you have confirmed bookings.",
      } as ApiError;
    }

    return result;
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
 * Complete a ride
 */
export const completeRide = async (
  rideId: number,
  driverId: number,
  driverLatitude: number,
  driverLongitude: number
): Promise<{ success: boolean; message: string; totalEarnings?: number; ride?: Ride; distanceToDestination?: number }> => {
  try {
    // driverId should be sent as query parameter, location in body
    const url = `${API_BASE_URL}${API_ENDPOINTS.RIDES.COMPLETE(rideId)}?driverId=${driverId}`;
    
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        driverLatitude,
        driverLongitude,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Unable to complete ride. Please try again.",
      } as ApiError;
    }

    return result;
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
 * Mark a passenger as picked up
 */
export const markPassengerPickedUp = async (
  bookingId: number,
  driverId: number,
  pin: string
): Promise<{ success: boolean; message: string; booking?: any }> => {
  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.BOOKINGS.PICKUP_COMPLETE(bookingId)}?driverId=${driverId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pin }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Unable to mark passenger as picked up. Please verify the PIN and try again.",
      } as ApiError;
    }

    return result;
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
 * Update driver location
 */
export const updateDriverLocation = async (
  driverId: number,
  latitude: number,
  longitude: number
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.LOCATION.UPDATE}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        driverId,
        latitude,
        longitude,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Unable to update your location. Please check your GPS signal.",
      } as ApiError;
    }

    return result;
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
 * Get notifications for the driver
 */
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
    pickupCity: string | null;
    pickupState: string | null;
    pickupZipCode?: string | null;
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
      fromCity: string | null;
      toCity: string | null;
      departureDate: string;
      departureTime: string;
      pricePerSeat: number | null;
    };
  };
  ride?: {
    id: number;
    fromAddress: string;
    toAddress: string;
    fromCity: string | null;
    toCity: string | null;
  };
}

export const getNotifications = async (driverId: number): Promise<{ success: boolean; notifications: Notification[] }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.NOTIFICATIONS.GET_ALL}?driverId=${driverId}`;

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
        message: result.message || "Unable to load notifications. Please try again.",
      } as ApiError;
    }

    return result;
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
 * Mark a notification as read
 */
export const markNotificationRead = async (
  notificationId: number,
  driverId: number
): Promise<{ success: boolean; message: string }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.NOTIFICATIONS.MARK_READ(notificationId)}?driverId=${driverId}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Unable to mark notification as read. Please try again.",
      } as ApiError;
    }

    return result;
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
 * Mark all notifications as read
 */
export const markAllNotificationsRead = async (
  driverId: number
): Promise<{ success: boolean; message: string }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ}?driverId=${driverId}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Unable to mark notifications as read. Please try again.",
      } as ApiError;
    }

    return result;
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
 * Accept a booking request
 */
export const acceptBooking = async (
  bookingId: number,
  driverId: number
): Promise<{ success: boolean; message: string }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.BOOKINGS.ACCEPT(bookingId)}?driverId=${driverId}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Unable to accept booking. The ride may be full or no longer available.",
      } as ApiError;
    }

    return result;
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
 * Reject a booking request
 */
export const rejectBooking = async (
  bookingId: number,
  driverId: number
): Promise<{ success: boolean; message: string }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.BOOKINGS.REJECT(bookingId)}?driverId=${driverId}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Unable to reject booking. Please try again.",
      } as ApiError;
    }

    return result;
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

// ============ Profile Management ============

export interface UpdateProfileRequest {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  city?: string;
  photoUrl?: string;
}

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface NotificationPreferences {
  notifyBookings: boolean;
  notifyMessages: boolean;
  notifyRideUpdates: boolean;
  notifyPromotions: boolean;
  shareLocationEnabled: boolean;
}

/**
 * Profile type for driver
 */
export interface Profile {
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
}

/**
 * Vehicle type for driver
 */
export interface Vehicle {
  carMake: string | null;
  carModel: string | null;
  carYear: number | null;
  carColor: string | null;
}

/**
 * Get driver profile
 */
export const getProfile = async (driverId: number): Promise<Profile> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PROFILE.GET}?driverId=${driverId}`;

    const response = await apiFetch(
      url,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
      { maxRetries: 3 } // Important data, allow retries
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Unable to load profile. Please try again.",
        status: response.status,
      } as ApiError;
    }

    return result.user || result.profile;
  } catch (error: any) {
    if (error && typeof error === "object" && "message" in error && "success" in error) {
      throw error;
    }
    throw {
      success: false,
      message: getUserFriendlyErrorMessage(error),
      status: error?.status,
    } as ApiError;
  }
};

/**
 * Update driver profile information
 */
export const updateProfile = async (
  driverId: number,
  data: UpdateProfileRequest
): Promise<{ success: boolean; message: string; user: any }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PROFILE.UPDATE}?driverId=${driverId}`;

    const response = await fetch(url, {
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
        message: result.message || "Unable to update profile. Please check your input and try again.",
        errors: result.errors,
      } as ApiError;
    }

    return result;
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
 * Update driver password
 */
export const updatePassword = async (
  driverId: number,
  data: UpdatePasswordRequest
): Promise<{ success: boolean; message: string }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PROFILE.UPDATE_PASSWORD}?driverId=${driverId}`;

    const response = await fetch(url, {
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
        message: result.message || "Unable to update password. Please verify your current password and try again.",
      } as ApiError;
    }

    return result;
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
 * Update driver profile photo
 */
export const updateProfilePhoto = async (
  driverId: number,
  photoUrl: string
): Promise<{ success: boolean; message: string; user: any }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PROFILE.UPDATE_PHOTO}?driverId=${driverId}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ photoUrl }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Unable to update profile photo. Please try again.",
      } as ApiError;
    }

    return result;
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
 * Get notification and privacy preferences
 */
export const getPreferences = async (
  driverId: number
): Promise<{ success: boolean; preferences: NotificationPreferences }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PROFILE.GET_PREFERENCES}?driverId=${driverId}`;

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
        message: result.message || "Unable to load preferences. Please try again.",
      } as ApiError;
    }

    return result;
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
 * Update notification and privacy preferences
 */
export const updatePreferences = async (
  driverId: number,
  preferences: Partial<NotificationPreferences>
): Promise<{ success: boolean; message: string; preferences: NotificationPreferences }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PROFILE.UPDATE_PREFERENCES}?driverId=${driverId}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferences),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Unable to update preferences. Please try again.",
      } as ApiError;
    }

    return result;
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
 * Delete driver account permanently
 */
export const deleteAccount = async (
  driverId: number,
  password: string,
  reason?: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PROFILE.DELETE}?driverId=${driverId}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password, reason }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Unable to delete account. Please verify your password and try again.",
        activeRidesCount: result.activeRidesCount,
        pendingBookingsCount: result.pendingBookingsCount,
      } as ApiError & { activeRidesCount?: number; pendingBookingsCount?: number };
    }

    return result;
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
 * Get vehicle information
 */
export const getVehicle = async (driverId: number): Promise<Vehicle> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.VEHICLE.GET}?driverId=${driverId}`;

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
        message: result.message || "Unable to load vehicle information. Please try again.",
      } as ApiError;
    }

    return result.vehicle || result;
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
 * Update vehicle information
 */
export interface UpdateVehicleRequest {
  carMake?: string;
  carModel?: string;
  carYear?: number;
  carColor?: string;
}

export const updateVehicle = async (
  driverId: number,
  data: UpdateVehicleRequest
): Promise<{ success: boolean; message: string; vehicle?: Vehicle }> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.VEHICLE.UPDATE}?driverId=${driverId}`;

    const response = await fetch(url, {
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
        message: result.message || "Unable to update vehicle information. Please check your input and try again.",
        errors: result.errors,
      } as ApiError;
    }

    return result;
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
