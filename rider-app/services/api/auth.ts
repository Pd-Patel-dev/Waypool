import { API_URL } from '@/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';
import { getErrorMessage, getErrorStatus, isApiError } from '@/types/errors';
import type { ApiError } from './types';

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
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await AsyncStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers,
  });
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

    if (result.token) {
      await AsyncStorage.setItem('token', result.token);
    } else if (result.tokens?.accessToken) {
      await AsyncStorage.setItem('token', result.tokens.accessToken);
    }

    return result;
  } catch (error: unknown) {
    if (isApiError(error)) {
      throw error;
    }
    throw {
      message: getErrorMessage(error),
      status: getErrorStatus(error) || 0,
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
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Signup failed',
        status: response.status,
      } as ApiError;
    }

    if (result.token) {
      await AsyncStorage.setItem('token', result.token);
    } else if (result.tokens?.accessToken) {
      await AsyncStorage.setItem('token', result.tokens.accessToken);
    }

    return result;
  } catch (error: unknown) {
    if (isApiError(error)) {
      throw error;
    }
    throw {
      message: getErrorMessage(error),
      status: getErrorStatus(error) || 0,
    } as ApiError;
  }
}

export { fetchWithAuth };

