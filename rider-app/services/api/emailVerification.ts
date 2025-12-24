import { API_URL } from '@/config/api';
import { logger } from '@/utils/logger';
import { getErrorMessage, getErrorStatus, isApiError } from '@/types/errors';
import type { ApiError } from './types';

export interface SendOTPRequest {
  email: string;
  fullName?: string;
}

export interface SendOTPResponse {
  success: boolean;
  message: string;
  data?: {
    email: string;
    expiresIn: number;
  };
}

export interface VerifyOTPRequest {
  email: string;
  code: string;
}

export interface VerifyOTPResponse {
  success: boolean;
  message: string;
  data?: {
    email: string;
    verified: boolean;
  };
}

export interface ResendOTPRequest {
  email: string;
  fullName?: string;
}

export interface ResendOTPResponse {
  success: boolean;
  message: string;
  data?: {
    email: string;
    expiresIn: number;
  };
}

// Send OTP to email
export async function sendOTP(data: SendOTPRequest): Promise<SendOTPResponse> {
  try {
    const response = await fetch(`${API_URL}/api/rider/email-verification/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      logger.error('Failed to send OTP', result, 'sendOTP');
      throw {
        message: result.message || 'Failed to send verification code',
        status: response.status,
      } as ApiError;
    }

    return {
      success: result.success ?? true,
      message: result.message || 'Verification code sent successfully',
      data: result.data,
    };
  } catch (error: unknown) {
    if (isApiError(error)) {
      throw error;
    }
    logger.error('Error sending OTP', error, 'sendOTP');
    throw {
      message: getErrorMessage(error),
      status: getErrorStatus(error) || 0,
    } as ApiError;
  }
}

// Verify OTP
export async function verifyOTP(data: VerifyOTPRequest): Promise<VerifyOTPResponse> {
  try {
    const response = await fetch(`${API_URL}/api/rider/email-verification/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      logger.error('Failed to verify OTP', result, 'verifyOTP');
      throw {
        message: result.message || 'Failed to verify code',
        status: response.status,
      } as ApiError;
    }

    return {
      success: result.success ?? true,
      message: result.message || 'Email verified successfully',
      data: result.data,
    };
  } catch (error: unknown) {
    if (isApiError(error)) {
      throw error;
    }
    logger.error('Error verifying OTP', error, 'verifyOTP');
    throw {
      message: getErrorMessage(error),
      status: getErrorStatus(error) || 0,
    } as ApiError;
  }
}

// Resend OTP
export async function resendOTP(data: ResendOTPRequest): Promise<ResendOTPResponse> {
  const url = `${API_URL}/api/rider/email-verification/resend`;
  
  try {
    logger.debug('Resending OTP to:', url, 'resendOTP');
    logger.debug('Request data:', { email: data.email, hasFullName: !!data.fullName }, 'resendOTP');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    // Check if response is valid
    if (!response) {
      throw {
        message: 'No response from server. Please check if the backend server is running.',
        status: 0,
      } as ApiError;
    }

    let result;
    try {
      result = await response.json();
    } catch (jsonError) {
      logger.error('Failed to parse JSON response', jsonError, 'resendOTP');
      throw {
        message: `Server error: ${response.status} ${response.statusText}`,
        status: response.status || 500,
      } as ApiError;
    }

    if (!response.ok) {
      logger.error('Failed to resend OTP', result, 'resendOTP');
      throw {
        message: result.message || 'Failed to resend verification code',
        status: response.status,
        errors: result.errors,
      } as ApiError;
    }

    logger.info('OTP resent successfully', { email: data.email }, 'resendOTP');
    return {
      success: result.success ?? true,
      message: result.message || 'Verification code resent successfully',
      data: result.data,
    };
  } catch (error: unknown) {
    // Check if it's a network error
    if (error instanceof TypeError && error.message.includes('Network request failed')) {
      logger.error('Network connectivity issue. Check:', {
        apiUrl: API_URL,
        url,
        message: 'Ensure backend server is running and API_URL is correct for your device/emulator',
      }, 'resendOTP');
      
      throw {
        message: `Cannot connect to server at ${API_URL}. Please ensure the backend server is running and the API URL is correct for your device.`,
        status: 0,
      } as ApiError;
    }
    
    if (isApiError(error)) {
      throw error;
    }
    
    logger.error('Error resending OTP', error, 'resendOTP');
    throw {
      message: getErrorMessage(error),
      status: getErrorStatus(error) || 0,
    } as ApiError;
  }
}

