import { API_BASE_URL, API_ENDPOINTS } from "@/config/api";

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
  totalEarnings?: number; // Total earnings from completed ride
  status?: "scheduled" | "in-progress" | "completed" | "cancelled";
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
  console.log("🔌 Login request to:", url);

  try {
    const response = await fetch(url, {
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
        message: result.message || "Login failed",
      } as ApiError;
    }

    return result as LoginResponse;
  } catch (error) {
    console.error("❌ Login network error:", error);
    console.error("📡 Attempted URL:", url);
    console.error("🌐 API Base URL:", API_BASE_URL);

    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }

    // Network or other errors
    throw {
      success: false,
      message: `Network error. Cannot reach ${API_BASE_URL}. Please check your connection and ensure backend is running.`,
    } as ApiError;
  }
};

/**
 * Logout API call
 */
export const logout = async (): Promise<LogoutResponse> => {
  const url = `${API_BASE_URL}${API_ENDPOINTS.AUTH.LOGOUT}`;
  console.log("🔌 Logout request to:", url);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Logout failed",
      } as ApiError;
    }

    return result as LogoutResponse;
  } catch (error) {
    console.error("❌ Logout network error:", error);
    console.error("📡 Attempted URL:", url);
    console.error("🌐 API Base URL:", API_BASE_URL);

    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }

    // Network or other errors
    throw {
      success: false,
      message: `Network error. Cannot reach ${API_BASE_URL}. Please check your connection and ensure backend is running.`,
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

    console.log("🌐 Fetching ride from:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const result = await response.json();
      console.error("❌ API error response:", result);
      throw {
        success: false,
        message: result.message || "Failed to fetch ride",
      } as ApiError;
    }

    const result = await response.json();
    console.log("✅ API response received:", result);

    if (!result.ride) {
      throw {
        success: false,
        message: "Ride data not found in response",
      } as ApiError;
    }

    return result.ride;
  } catch (error) {
    console.error("❌ Error in getRideById:", error);
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
 * Get past/completed rides for the driver
 * @param driverId - The ID of the driver to fetch rides for
 */
export const getPastRides = async (driverId?: number): Promise<Ride[]> => {
  try {
    const url = driverId
      ? `${API_BASE_URL}${API_ENDPOINTS.RIDES.PAST}?driverId=${driverId}`
      : `${API_BASE_URL}${API_ENDPOINTS.RIDES.PAST}`;

    console.log("🌐 Fetching past rides from:", url);

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
        message: result.message || "Failed to fetch past rides",
      } as ApiError;
    }

    const result = await response.json();
    console.log("✅ Fetched past rides from API:", result);
    return result.rides || [];
  } catch (error: any) {
    console.error("❌ Error fetching past rides from API:", error);
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
    // Build URL with driverId query parameter if provided
    const url = driverId
      ? `${API_BASE_URL}${API_ENDPOINTS.RIDES.UPCOMING}?driverId=${driverId}`
      : `${API_BASE_URL}${API_ENDPOINTS.RIDES.UPCOMING}`;

    console.log("🌐 Fetching rides from:", url);
    console.log("🔗 API Base URL:", API_BASE_URL);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      // If endpoint doesn't exist yet, return mock data
      if (response.status === 404) {
        console.warn("⚠️ Endpoint not found (404), using mock data");
        return getMockRides();
      }

      const result = await response.json();
      throw {
        success: false,
        message: result.message || "Failed to fetch rides",
      } as ApiError;
    }

    const result = await response.json();
    
    // Return rides array from response
    const rides = result.rides || result || [];
    if (Array.isArray(rides)) {
      console.log(`✅ Received ${rides.length} ride${rides.length !== 1 ? 's' : ''} from API`);
      return rides;
    } else {
      // If result is not an array, log warning but don't throw
      console.warn("⚠️ Unexpected response format, returning empty array");
      return [];
    }
  } catch (error: any) {
    // Only log errors if it's a real error (not a successful response)
    const isNetworkError = 
      error?.message?.includes("Network request failed") ||
      error?.message?.includes("Failed to fetch") ||
      error?.name === "TypeError";

    if (isNetworkError) {
      console.warn("⚠️ Network error - Backend server may not be running or unreachable");
      console.warn("💡 Make sure:");
      console.warn("   1. Backend server is running on port 3000");
      console.warn("   2. IP address is correct (check config/api.ts)");
      console.warn("   3. Device and computer are on the same network");
      console.warn("   4. Firewall is not blocking connections");
      console.warn("⚠️ Using mock rides data as fallback");
      return getMockRides();
    }

    // For other errors, only log if it's a real error (not just a warning)
    if (error && typeof error === "object" && "message" in error) {
      console.error("❌ Error fetching rides from API:", error.message);
      throw error;
    }

    // If we get here, it's an unexpected error
    console.error("❌ Unexpected error fetching rides:", error);
    throw {
      success: false,
      message: "Failed to fetch rides. Please try again.",
    } as ApiError;
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
      fromAddress: "123 Main Street, San Francisco, CA",
      toAddress: "456 Market Street, San Francisco, CA",
      fromLatitude: 37.7749,
      fromLongitude: -122.4194,
      toLatitude: 37.7896,
      toLongitude: -122.4019,
      departureTime: tomorrow.toISOString(),
      availableSeats: 3,
      totalSeats: 4,
      price: 25,
      status: "scheduled",
      distance: 2.5,
      passengers: [
        {
          id: 1,
          pickupAddress: "100 California Street, San Francisco, CA",
          pickupLatitude: 37.7849,
          pickupLongitude: -122.4094,
        },
      ],
    },
    {
      id: 2,
      fromAddress: "789 Mission Street, San Francisco, CA",
      toAddress: "321 Castro Street, San Francisco, CA",
      fromLatitude: 37.7831,
      fromLongitude: -122.4091,
      toLatitude: 37.7606,
      toLongitude: -122.4343,
      departureTime: dayAfter.toISOString(),
      availableSeats: 2,
      totalSeats: 4,
      price: 30,
      status: "scheduled",
      distance: 3.2,
      passengers: [],
    },
  ];
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

    return result as CreateRideResponse;
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

export interface DeleteRideResponse {
  success: boolean;
  message: string;
}

/**
 * Delete a ride by ID
 * @param rideId - The ID of the ride to delete
 * @param driverId - The ID of the driver (required for security)
 */
export interface UpdateRideRequest {
  departureDate?: string;
  departureTime?: string;
  pricePerSeat?: number;
  availableSeats?: number;
}

export interface UpdateRideResponse {
  success: boolean;
  message: string;
  ride?: Ride;
  changes?: string[];
}

/**
 * Update a ride
 * @param rideId - The ID of the ride to update
 * @param driverId - The ID of the driver (for security)
 * @param updateData - The fields to update
 */
export const updateRide = async (
  rideId: number,
  driverId: number,
  updateData: UpdateRideRequest
): Promise<UpdateRideResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.RIDES.UPDATE(
        rideId
      )}?driverId=${driverId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to update ride",
      } as ApiError;
    }

    return result as UpdateRideResponse;
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

export const deleteRide = async (
  rideId: number,
  driverId: number
): Promise<DeleteRideResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.RIDES.DELETE(
        rideId
      )}?driverId=${driverId}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to delete ride",
      } as ApiError;
    }

    return result as DeleteRideResponse;
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

export interface CancelRideResponse {
  success: boolean;
  message: string;
}

/**
 * Cancel a ride by ID (updates status to 'cancelled')
 * @param rideId - The ID of the ride to cancel
 * @param driverId - The ID of the driver (required for security)
 */
export const cancelRide = async (
  rideId: number,
  driverId: number
): Promise<CancelRideResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.RIDES.CANCEL(
        rideId
      )}?driverId=${driverId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to cancel ride",
      } as ApiError;
    }

    return result as CancelRideResponse;
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
    pickupCity?: string | null;
    pickupState?: string | null;
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

export interface NotificationsResponse {
  success: boolean;
  notifications: Notification[];
  message?: string;
}

export interface MarkReadResponse {
  success: boolean;
  message: string;
}

/**
 * Get all notifications for a driver
 * @param driverId - The ID of the driver
 */
export const getNotifications = async (
  driverId: number
): Promise<NotificationsResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.NOTIFICATIONS.GET_ALL}?driverId=${driverId}`,
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
        message: result.message || "Failed to fetch notifications",
        status: response.status,
      } as ApiError;
    }

    return result as NotificationsResponse;
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
 * Mark a notification as read
 * @param notificationId - The ID of the notification
 * @param driverId - The ID of the driver (required for security)
 */
export const markNotificationRead = async (
  notificationId: number,
  driverId: number
): Promise<MarkReadResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.NOTIFICATIONS.MARK_READ(
        notificationId
      )}?driverId=${driverId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || "Failed to mark notification as read",
        status: response.status,
      } as ApiError;
    }

    return result as MarkReadResponse;
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
 * Mark all notifications as read for a driver
 * @param driverId - The ID of the driver
 */
export const markAllNotificationsRead = async (
  driverId: number
): Promise<MarkReadResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ}?driverId=${driverId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || "Failed to mark all notifications as read",
        status: response.status,
      } as ApiError;
    }

    return result as MarkReadResponse;
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
 * Accept a booking request
 * @param bookingId - The ID of the booking
 * @param driverId - The ID of the driver (required for security)
 */
export interface AcceptBookingResponse {
  success: boolean;
  message: string;
}

export const acceptBooking = async (
  bookingId: number,
  driverId: number
): Promise<AcceptBookingResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.BOOKINGS.ACCEPT(
        bookingId
      )}?driverId=${driverId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || "Failed to accept booking",
        status: response.status,
      } as ApiError;
    }

    return result as AcceptBookingResponse;
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
 * Reject a booking request
 * @param bookingId - The ID of the booking
 * @param driverId - The ID of the driver (required for security)
 */
export interface RejectBookingResponse {
  success: boolean;
  message: string;
}

export const rejectBooking = async (
  bookingId: number,
  driverId: number
): Promise<RejectBookingResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.BOOKINGS.REJECT(
        bookingId
      )}?driverId=${driverId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || "Failed to reject booking",
        status: response.status,
      } as ApiError;
    }

    return result as RejectBookingResponse;
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
 * Start a ride (update status to in-progress)
 * @param rideId - The ID of the ride
 * @param driverId - The ID of the driver (required for security)
 */
export interface StartRideResponse {
  success: boolean;
  message: string;
}

export const startRide = async (
  rideId: number,
  driverId: number
): Promise<StartRideResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.RIDES.START(rideId)}?driverId=${driverId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || "Failed to start ride",
        status: response.status,
      } as ApiError;
    }

    return result as StartRideResponse;
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
 * Complete a ride (update status to completed)
 * @param rideId - The ID of the ride
 * @param driverId - The ID of the driver (required for security)
 */
export interface CompleteRideResponse {
  success: boolean;
  message: string;
  totalEarnings?: number;
}

export const completeRide = async (
  rideId: number,
  driverId: number
): Promise<CompleteRideResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.RIDES.COMPLETE(rideId)}?driverId=${driverId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || "Failed to complete ride",
        status: response.status,
      } as ApiError;
    }

    return result as CompleteRideResponse;
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
 * Earnings Summary Interface
 */
export interface EarningsSummary {
  total: number;
  monthly: number;
  weekly: number;
  averagePerRide: number;
  totalRides: number;
  totalDistance: number;
  recentEarnings: Array<{
    rideId: number;
    amount: number;
    date: string;
  }>;
}

export interface EarningsResponse {
  success: boolean;
  earnings: EarningsSummary;
}

/**
 * Get earnings summary for driver
 */
export const getEarnings = async (
  driverId: number
): Promise<EarningsSummary> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.RIDES.EARNINGS}?driverId=${driverId}`,
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
        message: result.message || "Failed to fetch earnings",
        status: response.status,
      } as ApiError;
    }

    return (result as EarningsResponse).earnings;
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

// Profile interfaces
export interface Profile {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string;
  photoUrl: string | null;
  city: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileRequest {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  photoUrl?: string | null;
  city?: string | null;
}

export interface UpdateProfileResponse {
  success: boolean;
  message: string;
  user?: Profile;
  errors?: string[];
}

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdatePasswordResponse {
  success: boolean;
  message: string;
}

/**
 * Get driver profile
 */
export const getProfile = async (driverId: number): Promise<Profile> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.PROFILE.GET}?driverId=${driverId}`,
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
        message: result.message || "Failed to fetch profile",
        status: response.status,
      } as ApiError;
    }

    return (result as { success: boolean; user: Profile }).user;
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
 * Update driver profile
 */
export const updateProfile = async (
  driverId: number,
  updateData: UpdateProfileRequest
): Promise<UpdateProfileResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.PROFILE.UPDATE}?driverId=${driverId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to update profile",
        errors: result.errors || [],
        status: response.status,
      } as ApiError;
    }

    return result as UpdateProfileResponse;
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
 * Update driver password
 */
export const updatePassword = async (
  driverId: number,
  passwordData: UpdatePasswordRequest
): Promise<UpdatePasswordResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.PROFILE.UPDATE_PASSWORD}?driverId=${driverId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(passwordData),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to update password",
        status: response.status,
      } as ApiError;
    }

    return result as UpdatePasswordResponse;
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

// Vehicle interfaces
export interface Vehicle {
  carMake: string | null;
  carModel: string | null;
  carYear: number | null;
  carColor: string | null;
}

export interface UpdateVehicleRequest {
  carMake?: string | null;
  carModel?: string | null;
  carYear?: number | null;
  carColor?: string | null;
}

export interface UpdateVehicleResponse {
  success: boolean;
  message: string;
  vehicle?: Vehicle;
  errors?: string[];
}

/**
 * Get driver vehicle information
 */
export const getVehicle = async (driverId: number): Promise<Vehicle> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.VEHICLE.GET}?driverId=${driverId}`,
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
        message: result.message || "Failed to fetch vehicle information",
        status: response.status,
      } as ApiError;
    }

    return (result as { success: boolean; vehicle: Vehicle }).vehicle;
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
 * Update driver vehicle information
 */
export const updateVehicle = async (
  driverId: number,
  updateData: UpdateVehicleRequest
): Promise<UpdateVehicleResponse> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}${API_ENDPOINTS.VEHICLE.UPDATE}?driverId=${driverId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to update vehicle information",
        errors: result.errors || [],
        status: response.status,
      } as ApiError;
    }

    return result as UpdateVehicleResponse;
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
