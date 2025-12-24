import { API_URL } from '@/config/api';
import { logger } from '@/utils/logger';
import { getErrorMessage, getErrorStatus, isApiError } from '@/types/errors';
import { fetchWithAuth } from './auth';
import type { ApiError } from './types';

export interface RiderProfile {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  photoUrl: string | null;
  city: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GetProfileResponse {
  success: boolean;
  message?: string;
  user: RiderProfile;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  photoUrl?: string | null;
  city?: string | null;
}

export interface UpdateProfileResponse {
  success: boolean;
  message?: string;
  user: RiderProfile;
}

export async function getRiderProfile(): Promise<GetProfileResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to fetch profile',
        status: response.status,
      } as ApiError;
    }

    if (result.data) {
      return {
        success: result.success,
        message: result.message,
        user: result.data.user,
      };
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

export async function updateRiderProfile(data: UpdateProfileRequest): Promise<UpdateProfileResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to update profile',
        status: response.status,
      } as ApiError;
    }

    if (result.data) {
      return {
        success: result.success,
        message: result.message,
        user: result.data.user,
      };
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

export async function updateRiderProfilePhoto(photoUrl: string): Promise<UpdateProfileResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/profile/photo`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ photoUrl }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to update profile photo',
        status: response.status,
      } as ApiError;
    }

    if (result.data) {
      return {
        success: result.success,
        message: result.message,
        user: result.data.user,
      };
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

