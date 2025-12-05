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
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Login failed',
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

export async function signup(data: SignupRequest): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        role: 'rider', // Always set role to rider for rider app
      }),
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

