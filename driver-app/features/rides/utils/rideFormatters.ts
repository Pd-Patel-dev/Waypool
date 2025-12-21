/**
 * Ride formatting utilities
 */

import { formatDate, formatTime } from '@/utils/date';
import type { Ride } from '../types/ride.types';

/**
 * Format ride date and time for display
 */
export function formatRideDateTime(ride: Ride): string {
  return `${formatDate(ride.departureTime)} • ${formatTime(ride.departureTime)}`;
}

/**
 * Format ride date for display
 */
export function formatRideDate(ride: Ride): string {
  return formatDate(ride.departureTime);
}

/**
 * Format ride time for display
 */
export function formatRideTime(ride: Ride): string {
  return formatTime(ride.departureTime);
}

