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
  pickupAddress: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  confirmationNumber?: string;
  status?: string;
  pickupStatus?: "pending" | "picked_up";
  pickedUpAt?: string | null;
}

export interface Ride {
  id: number;
  fromAddress: string;
  toAddress: string;
  fromLatitude?: number;
  fromLongitude?: number;
  toLatitude?: number;
  toLongitude?: number;
  departureTime: string;
  availableSeats: number;
  totalSeats: number;
  price?: number;
  pricePerSeat?: number;
  totalEarnings?: number; // Total earnings from completed ride
  status?: "scheduled" | "in-progress" | "completed" | "cancelled";
  distance?: number; // Distance in kilometers
  isRecurring?: boolean;
  recurringPattern?: 'daily' | 'weekly' | 'monthly' | null;
  recurringEndDate?: string | null;
  parentRideId?: number | null;
  passengers?: Passenger[]; // List of enrolled passengers
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
        message: result.message || 'Failed to submit rating',
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
        message: result.message || 'Failed to fetch ratings',
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
    const url = driverId
      ? `${API_BASE_URL}${API_ENDPOINTS.RIDES.UPCOMING}?driverId=${driverId}`
      : `${API_BASE_URL}${API_ENDPOINTS.RIDES.UPCOMING}`;

    console.log("🌐 Fetching upcoming rides from:", url);

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
        message: result.message || "Failed to fetch upcoming rides",
      } as ApiError;
    }

    const result = await response.json();
    console.log("✅ Fetched upcoming rides from API:", result);
    return result.rides || [];
  } catch (error: any) {
    console.error("❌ Error fetching upcoming rides from API:", error);
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
        message: result.message || "Failed to create ride",
        errors: result.errors || [],
      } as ApiError;
    }

    return result as CreateRideResponse;
  } catch (error: any) {
    console.error("❌ Error creating ride:", error);
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
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.RIDES.CANCEL(rideId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ driverId }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to cancel ride",
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    console.error("❌ Error canceling ride:", error);
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
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.RIDES.START(rideId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ driverId }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to start ride",
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    console.error("❌ Error starting ride:", error);
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
export const completeRide = async (rideId: number, driverId: number): Promise<{ success: boolean; message: string; totalEarnings?: number; ride?: Ride }> => {
  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.RIDES.COMPLETE(rideId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ driverId }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        success: false,
        message: result.message || "Failed to complete ride",
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    console.error("❌ Error completing ride:", error);
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
  pin: string
): Promise<{ success: boolean; message: string; booking?: any }> => {
  try {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.BOOKINGS.PICKUP_COMPLETE(bookingId)}`, {
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
        message: result.message || "Failed to mark passenger as picked up",
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    console.error("❌ Error marking passenger as picked up:", error);
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
        message: result.message || "Failed to update location",
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    console.error("❌ Error updating driver location:", error);
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
export const getNotifications = async (driverId: number): Promise<{ success: boolean; notifications: any[] }> => {
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
        message: result.message || "Failed to fetch notifications",
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    console.error("❌ Error fetching notifications:", error);
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
        message: result.message || "Failed to update profile",
        errors: result.errors,
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    console.error("❌ Error updating profile:", error);
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
        message: result.message || "Failed to update password",
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    console.error("❌ Error updating password:", error);
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
        message: result.message || "Failed to update profile photo",
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    console.error("❌ Error updating profile photo:", error);
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
        message: result.message || "Failed to fetch preferences",
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    console.error("❌ Error fetching preferences:", error);
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
        message: result.message || "Failed to update preferences",
      } as ApiError;
    }

    return result;
  } catch (error: any) {
    console.error("❌ Error updating preferences:", error);
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
        message: result.message || "Failed to delete account",
        activeRidesCount: result.activeRidesCount,
        pendingBookingsCount: result.pendingBookingsCount,
      } as ApiError & { activeRidesCount?: number; pendingBookingsCount?: number };
    }

    return result;
  } catch (error: any) {
    console.error("❌ Error deleting account:", error);
    if (error && typeof error === "object" && "message" in error) {
      throw error;
    }
    throw {
      success: false,
      message: "Network error. Please check your connection.",
    } as ApiError;
  }
};
