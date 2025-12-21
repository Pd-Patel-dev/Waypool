/**
 * Ride Formatter Service
 * Handles formatting and presentation logic for rides
 * Separates formatting concerns from business logic
 */

import type { RideEntity } from '../entities/Ride.entity';
import { formatDate, formatTime, safeParseDate } from '@/utils/date';

export class RideFormatterService {
  /**
   * Format date with relative terms (Today, Tomorrow)
   */
  static formatDateWithRelative(ride: RideEntity): string {
    const date = ride.departureTime;
    if (!date) return formatDate(date.toISOString());

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);

      if (dateOnly.getTime() === today.getTime()) {
        return 'Today';
      } else if (dateOnly.getTime() === tomorrow.getTime()) {
        return 'Tomorrow';
      } else {
        return formatDate(date.toISOString());
      }
    } catch (error) {
      return formatDate(date.toISOString());
    }
  }

  /**
   * Format date and time for display
   */
  static formatDateTime(ride: RideEntity): string {
    return `${this.formatDate(ride)} • ${this.formatTime(ride)}`;
  }

  /**
   * Format date for display
   */
  static formatDate(ride: RideEntity): string {
    return formatDate(ride.departureTime.toISOString());
  }

  /**
   * Format time for display
   */
  static formatTime(ride: RideEntity): string {
    return formatTime(ride.departureTime.toISOString());
  }

  /**
   * Check if ride is today
   */
  static isToday(ride: RideEntity): boolean {
    const date = new Date(ride.departureTime);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  /**
   * Get status badge for UI
   */
  static getStatusBadge(ride: RideEntity) {
    return RideStatusService.getStatusBadge(ride);
  }
}

