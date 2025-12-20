/**
 * Haptic Feedback Utility
 * Provides consistent haptic feedback for important user actions
 * Improves user experience by providing tactile feedback
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptic feedback types for different actions
 */
export enum HapticType {
  /**
   * Light impact - for subtle actions (button taps, toggles)
   */
  Light = 'light',

  /**
   * Medium impact - for standard actions (confirmations, selections)
   */
  Medium = 'medium',

  /**
   * Heavy impact - for important actions (errors, critical confirmations)
   */
  Heavy = 'heavy',

  /**
   * Success notification - for successful actions (ride accepted, payment received)
   */
  Success = 'success',

  /**
   * Warning notification - for warnings (validation errors, confirmations)
   */
  Warning = 'warning',

  /**
   * Error notification - for errors (failed operations, network errors)
   */
  Error = 'error',

  /**
   * Selection feedback - for list/item selections
   */
  Selection = 'selection',
}

/**
 * Trigger haptic feedback
 * 
 * @param type - Type of haptic feedback
 * 
 * @example
 * ```typescript
 * import { triggerHaptic } from '@/utils/haptics';
 * 
 * // On button press
 * triggerHaptic(HapticType.Light);
 * 
 * // On successful action
 * triggerHaptic(HapticType.Success);
 * ```
 */
export function triggerHaptic(type: HapticType = HapticType.Medium): void {
  // Haptics are only available on physical devices
  if (Platform.OS === 'web') {
    return;
  }

  try {
    switch (type) {
      case HapticType.Light:
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case HapticType.Medium:
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case HapticType.Heavy:
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case HapticType.Success:
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case HapticType.Warning:
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case HapticType.Error:
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case HapticType.Selection:
        Haptics.selectionAsync();
        break;
      default:
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  } catch (error) {
    // Silently fail if haptics are not available
    console.warn('[Haptics] Failed to trigger haptic feedback:', error);
  }
}

/**
 * Convenience functions for common actions
 */
export const HapticFeedback = {
  /**
   * Button tap / general interaction
   */
  tap: () => triggerHaptic(HapticType.Light),

  /**
   * Important action (confirm, submit)
   */
  action: () => triggerHaptic(HapticType.Medium),

  /**
   * Critical action (delete, confirm dangerous action)
   */
  critical: () => triggerHaptic(HapticType.Heavy),

  /**
   * Success (ride accepted, payment received, operation completed)
   */
  success: () => triggerHaptic(HapticType.Success),

  /**
   * Warning (validation error, confirmation needed)
   */
  warning: () => triggerHaptic(HapticType.Warning),

  /**
   * Error (failed operation, network error)
   */
  error: () => triggerHaptic(HapticType.Error),

  /**
   * Selection (list item, option selected)
   */
  selection: () => triggerHaptic(HapticType.Selection),
};

