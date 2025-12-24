import { API_URL } from '@/config/api';
import { logger } from '@/utils/logger';
import { getErrorMessage, getErrorStatus, isApiError } from '@/types/errors';
import { fetchWithAuth } from './auth';
import type { ApiError } from './types';

export interface SavedAddress {
  id: number;
  riderId: number;
  address?: string;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export interface GetSavedAddressesResponse {
  success: boolean;
  message?: string;
  addresses: SavedAddress[];
}

export interface CreateSavedAddressRequest {
  address?: string;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export interface UpdateSavedAddressRequest {
  address?: string;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export interface SavedAddressResponse {
  success: boolean;
  message?: string;
  address: SavedAddress;
}

export async function getSavedAddresses(): Promise<GetSavedAddressesResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/saved-addresses`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to fetch saved addresses',
        status: response.status,
      } as ApiError;
    }

    if (result.data) {
      return {
        success: result.success,
        message: result.message,
        addresses: result.data.addresses,
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

export async function createSavedAddress(data: CreateSavedAddressRequest): Promise<SavedAddressResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/saved-addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to create saved address',
        status: response.status,
      } as ApiError;
    }

    if (result.data) {
      return {
        success: result.success,
        message: result.message,
        address: result.data.address,
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

export async function updateSavedAddress(
  addressId: number,
  data: UpdateSavedAddressRequest
): Promise<SavedAddressResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/saved-addresses/${addressId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to update saved address',
        status: response.status,
      } as ApiError;
    }

    if (result.data) {
      return {
        success: result.success,
        message: result.message,
        address: result.data.address,
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

export async function deleteSavedAddress(addressId: number): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/saved-addresses/${addressId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to delete saved address',
        status: response.status,
      } as ApiError;
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

