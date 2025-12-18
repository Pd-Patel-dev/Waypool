/**
 * Toast notification utility
 * Provides user-visible feedback for operations without blocking the UI
 */

import { Alert } from 'react-native';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
  duration?: number;
  position?: 'top' | 'bottom' | 'center';
}

/**
 * Show a toast notification to the user
 * For now, uses Alert. In production, consider using a proper toast library
 * like react-native-toast-message or react-native-root-toast
 */
export function showToast(
  message: string,
  type: ToastType = 'info',
  options: ToastOptions = {}
): void {
  // duration is reserved for future use when proper toast library is integrated
  // const { duration = 3000 } = options;

  // For now, use Alert for critical errors
  // In production, replace with a proper toast library
  if (type === 'error') {
    Alert.alert('Error', message);
  } else if (type === 'warning') {
    Alert.alert('Warning', message);
  } else if (type === 'success') {
    // For success, we could use a non-blocking toast
    // For now, just log it (in production, use a toast library)
    // In a real app, you'd use react-native-toast-message or similar
  } else {
    // Info messages - could be silent or use a toast library
  }
}

/**
 * Show success toast
 */
export function showSuccess(message: string, options?: ToastOptions): void {
  showToast(message, 'success', options);
}

/**
 * Show error toast
 */
export function showError(message: string, options?: ToastOptions): void {
  showToast(message, 'error', options);
}

/**
 * Show warning toast
 */
export function showWarning(message: string, options?: ToastOptions): void {
  showToast(message, 'warning', options);
}

/**
 * Show info toast
 */
export function showInfo(message: string, options?: ToastOptions): void {
  showToast(message, 'info', options);
}

