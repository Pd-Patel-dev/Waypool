/**
 * Centralized date formatting utilities
 * Provides safe date parsing and formatting with error handling
 */

/**
 * Safely parse a date string or Date object
 * Returns null if parsing fails
 * 
 * @param dateInput - Date string, Date object, or timestamp
 * @returns Date object or null if parsing fails
 */
export function safeParseDate(dateInput: string | Date | number | null | undefined): Date | null {
  if (!dateInput) return null;

  try {
    // If it's already a Date object, return it
    if (dateInput instanceof Date) {
      // Check if it's a valid date
      if (isNaN(dateInput.getTime())) {
        return null;
      }
      return dateInput;
    }

    // If it's a number, treat it as timestamp
    if (typeof dateInput === 'number') {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date;
    }

    // If it's a string, try to parse it
    if (typeof dateInput === 'string') {
      const date = new Date(dateInput);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Format a date to a readable date string
 * Returns fallback string if parsing fails
 * 
 * @param dateInput - Date string, Date object, or timestamp
 * @param fallback - Fallback string to return if parsing fails (default: "Invalid date")
 * @returns Formatted date string or fallback
 */
export function formatDate(dateInput: string | Date | number | null | undefined, fallback: string = "Invalid date"): string {
  const date = safeParseDate(dateInput);
  if (!date) return fallback;

  try {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    return fallback;
  }
}

/**
 * Format a date to a time string (HH:MM AM/PM)
 * Returns fallback string if parsing fails
 * 
 * @param dateInput - Date string, Date object, or timestamp
 * @param fallback - Fallback string to return if parsing fails (default: "Invalid time")
 * @returns Formatted time string or fallback
 */
export function formatTime(dateInput: string | Date | number | null | undefined, fallback: string = "Invalid time"): string {
  const date = safeParseDate(dateInput);
  if (!date) return fallback;

  try {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch (error) {
    return fallback;
  }
}

/**
 * Format a date to a datetime string (Date + Time)
 * Returns fallback string if parsing fails
 * 
 * @param dateInput - Date string, Date object, or timestamp
 * @param fallback - Fallback string to return if parsing fails (default: "Invalid date/time")
 * @returns Formatted datetime string or fallback
 */
export function formatDateTime(dateInput: string | Date | number | null | undefined, fallback: string = "Invalid date/time"): string {
  const date = safeParseDate(dateInput);
  if (!date) return fallback;

  try {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch (error) {
    return fallback;
  }
}

/**
 * Format a date to a relative time string (e.g., "2 hours ago", "in 3 days")
 * Returns fallback string if parsing fails
 * 
 * @param dateInput - Date string, Date object, or timestamp
 * @param fallback - Fallback string to return if parsing fails (default: "Invalid date")
 * @returns Relative time string or fallback
 */
export function formatRelativeTime(dateInput: string | Date | number | null | undefined, fallback: string = "Invalid date"): string {
  const date = safeParseDate(dateInput);
  if (!date) return fallback;

  try {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (Math.abs(diffDays) > 7) {
      // For dates more than 7 days away, use absolute format
      return formatDate(dateInput);
    } else if (Math.abs(diffDays) > 0) {
      const days = Math.abs(diffDays);
      return diffDays > 0 ? `in ${days} day${days > 1 ? 's' : ''}` : `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (Math.abs(diffHours) > 0) {
      const hours = Math.abs(diffHours);
      return diffHours > 0 ? `in ${hours} hour${hours > 1 ? 's' : ''}` : `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (Math.abs(diffMinutes) > 0) {
      const minutes = Math.abs(diffMinutes);
      return diffMinutes > 0 ? `in ${minutes} minute${minutes > 1 ? 's' : ''}` : `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'now';
    }
  } catch (error) {
    return fallback;
  }
}

