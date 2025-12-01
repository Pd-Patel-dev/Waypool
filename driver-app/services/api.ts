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

