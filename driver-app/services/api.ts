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
export const createConnectAccount = async (driverId: number): Promise<{
  success: boolean;
  accountId?: string;
  onboardingUrl?: string;
  status?: string;
}> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PAYOUTS.CONNECT_ACCOUNT}`;
    const response = await apiFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
export const getAccountStatus = async (driverId: number): Promise<PayoutAccountStatus> => {
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
export const createAccountLink = async (driverId: number, type: 'account_onboarding' | 'account_update' = 'account_onboarding'): Promise<{
  success: boolean;
  url: string;
}> => {
  try {
    const url = `${API_BASE_URL}${API_ENDPOINTS.PAYOUTS.CREATE_ACCOUNT_LINK}`;
    const response = await apiFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
export const initiatePayout = async (driverId: number, amount: number, description?: string): Promise<{
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
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
export const getPayoutHistory = async (driverId: number, limit: number = 20, offset: number = 0): Promise<{
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
export const getPayoutBalance = async (driverId: number): Promise<PayoutBalance> => {
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
