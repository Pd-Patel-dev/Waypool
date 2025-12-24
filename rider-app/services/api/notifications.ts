import { API_URL } from '@/config/api';
import { logger } from '@/utils/logger';
import { getErrorMessage, getErrorStatus, isApiError } from '@/types/errors';
import { fetchWithAuth } from './auth';
import type { ApiError } from './types';

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  data?: unknown;
  unread: boolean;
  createdAt: string;
}

export interface GetNotificationsResponse {
  success: boolean;
  notifications: Notification[];
  message?: string;
}

export interface MarkNotificationReadResponse {
  success: boolean;
  message?: string;
}

export interface MarkAllNotificationsReadResponse {
  success: boolean;
  message?: string;
}

export async function getNotifications(): Promise<GetNotificationsResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/notifications`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to fetch notifications',
        status: response.status,
      } as ApiError;
    }

    if (result.data) {
      return {
        success: result.success,
        notifications: result.data.notifications || [],
        message: result.message,
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

export async function markNotificationAsRead(notificationId: number): Promise<MarkNotificationReadResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/notifications/${notificationId}/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to mark notification as read',
        status: response.status,
      } as ApiError;
    }

    return result;
  } catch (error: unknown) {
    logger.error('Error marking notification as read', error, 'markNotificationAsRead');
    if (isApiError(error)) {
      throw error;
    }
    throw {
      message: getErrorMessage(error),
      status: getErrorStatus(error) || 0,
    } as ApiError;
  }
}

export async function markAllNotificationsAsRead(): Promise<MarkAllNotificationsReadResponse> {
  try {
    const response = await fetchWithAuth(`${API_URL}/api/rider/notifications/read-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw {
        message: result.message || 'Failed to mark all notifications as read',
        status: response.status,
      } as ApiError;
    }

    return result;
  } catch (error: unknown) {
    logger.error('Error marking all notifications as read', error, 'markAllNotificationsAsRead');
    if (isApiError(error)) {
      throw error;
    }
    throw {
      message: getErrorMessage(error),
      status: getErrorStatus(error) || 0,
    } as ApiError;
  }
}

