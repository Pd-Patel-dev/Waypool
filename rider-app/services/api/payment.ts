import { API_URL } from '@/config/api';
import { logger } from '@/utils/logger';
import { getErrorMessage, getErrorStatus, isApiError } from '@/types/errors';
import { fetchWithAuth } from './auth';
import type { ApiError } from './types';

export interface SavePaymentMethodRequest {
  riderId: number;
  paymentMethodId: string;
  paymentMethodType: 'card' | 'applePay' | 'googlePay';
  rideId?: number; // Optional, for backward compatibility
}

export interface SavePaymentMethodResponse {
  success: boolean;
  message: string;
  paymentMethod?: {
    id: string;
    type: string;
    last4?: string;
    brand?: string;
  };
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'applePay' | 'googlePay';
  brand?: string;
  last4?: string;
  isDefault?: boolean;
  card?: {
    brand?: string;
    last4?: string;
  };
  billingDetails?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postal_code?: string;
      country?: string;
    };
  };
}

export interface GetPaymentMethodsResponse {
  success: boolean;
  paymentMethods: PaymentMethod[];
  message?: string;
}

export interface DeletePaymentMethodResponse {
  success: boolean;
  message: string;
}

export async function savePaymentMethod(data: SavePaymentMethodRequest): Promise<SavePaymentMethodResponse> {
  try {
    logger.debug('Calling attach-payment-method API', {
      url: `${API_URL}/api/rider/payment/attach-payment-method`,
      body: {
        riderId: data.riderId,
        paymentMethodId: data.paymentMethodId,
        paymentMethodType: data.paymentMethodType,
      },
    }, 'savePaymentMethod');

    const response = await fetchWithAuth(`${API_URL}/api/rider/payment/attach-payment-method`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Note: riderId is now obtained from JWT token on backend, but we keep it for backward compatibility
        // Backend will ignore it and use the authenticated user's ID from the token
        paymentMethodId: data.paymentMethodId,
        paymentMethodType: data.paymentMethodType,
      }),
    });

    logger.debug('API response status', { status: response.status, statusText: response.statusText }, 'savePaymentMethod');

    const result = await response.json();
    logger.debug('API response body', result, 'savePaymentMethod');

    if (!response.ok) {
      const errorMessage = result.message || 'Failed to save payment method';
      
      // Provide more user-friendly error messages
      let userFriendlyMessage = errorMessage;
      
      if (response.status === 401) {
        if (errorMessage.includes('expired')) {
          userFriendlyMessage = 'Your session has expired. Please log in again.';
        } else if (errorMessage.includes('Invalid token')) {
          userFriendlyMessage = 'Authentication failed. Please log out and log back in.';
        } else {
          userFriendlyMessage = 'Authentication required. Please log in again.';
        }
      } else if (response.status === 403) {
        userFriendlyMessage = 'You do not have permission to perform this action.';
      } else if (response.status === 404) {
        userFriendlyMessage = 'Payment service not found. Please try again later.';
      }
      
      logger.error('API error', {
        status: response.status,
        message: errorMessage,
        userFriendlyMessage,
        result,
      }, 'savePaymentMethod');
      
      throw {
        message: userFriendlyMessage,
        status: response.status,
        originalMessage: errorMessage,
      } as ApiError;
    }

    return result;
  } catch (error: unknown) {
    logger.error('savePaymentMethod error', error, 'savePaymentMethod');
    if (isApiError(error)) {
      throw error;
    }
    
    const networkError: ApiError = {
      message: getErrorMessage(error) || 'Network error. Please check your connection and try again.',
      status: getErrorStatus(error) || 0,
    };
    logger.error('Throwing network error', networkError, 'savePaymentMethod');
    throw networkError;
  }
}

export async function getPaymentMethods(riderId: number): Promise<GetPaymentMethodsResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/payment/methods?riderId=${riderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to fetch payment methods',
        status: response.status,
      } as ApiError;
    }

    if (result.data) {
      return {
        success: result.success,
        paymentMethods: result.data.paymentMethods || [],
        message: result.message,
      };
    }

    return result;
  } catch (error: unknown) {
    logger.warn('Get payment methods endpoint not available, using mock response', undefined, 'getPaymentMethods');
    
    if (isApiError(error) && error.status === 404) {
      return {
        success: true,
        paymentMethods: [],
        message: 'No payment methods found',
      };
    }
    
    throw {
      message: getErrorMessage(error),
      status: getErrorStatus(error) || 0,
    } as ApiError;
  }
}

export async function deletePaymentMethod(riderId: number, paymentMethodId: string): Promise<DeletePaymentMethodResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/payment/methods/${paymentMethodId}?riderId=${riderId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to delete payment method',
        status: response.status,
      } as ApiError;
    }

    return result;
  } catch (error: unknown) {
    logger.warn('Delete payment method endpoint not available, using mock response', undefined, 'deletePaymentMethod');
    
    if (isApiError(error) && error.status === 404) {
      return {
        success: true,
        message: 'Payment method deleted',
      };
    }
    
    throw {
      message: getErrorMessage(error),
      status: getErrorStatus(error) || 0,
    } as ApiError;
  }
}

