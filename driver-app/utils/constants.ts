/**
 * Application-wide constants
 * Centralized location for magic numbers and configuration values
 */

// Time constants (in milliseconds)
export const TIME = {
  /** Location update interval - how often to update location tracking */
  LOCATION_UPDATE_INTERVAL: 5000, // 5 seconds
  
  /** Minimum time between location backend updates to rate limit API calls */
  LOCATION_BACKEND_UPDATE_INTERVAL: 5000, // 5 seconds
  
  /** Navigation location update interval */
  NAVIGATION_UPDATE_INTERVAL: 3000, // 3 seconds
  
  /** Notification badge refresh interval (fallback when WebSocket is disconnected) */
  NOTIFICATION_REFRESH_INTERVAL: 60000, // 60 seconds
  
  /** Tab layout notification refresh interval */
  TAB_NOTIFICATION_REFRESH_INTERVAL: 30000, // 30 seconds
  
  /** Ride data auto-refresh interval */
  RIDE_DATA_REFRESH_INTERVAL: 30000, // 30 seconds
  
  /** Location update failure warning threshold - show warning after this many milliseconds of failures */
  LOCATION_UPDATE_FAILURE_THRESHOLD: 30000, // 30 seconds
} as const;

// Distance constants (in meters)
export const DISTANCE = {
  /** Minimum distance for location tracking updates */
  LOCATION_UPDATE_DISTANCE: 10, // 10 meters
  
  /** Navigation step distance threshold */
  NAVIGATION_STEP_DISTANCE: 10, // 10 meters
  
  /** Arrival threshold - considered "arrived" when within this distance */
  ARRIVAL_THRESHOLD: 50, // 50 meters (0.05 miles)
  
  /** Near threshold - considered "near" when within this distance */
  NEAR_THRESHOLD: 120, // 120 meters (0.12 miles)
  
  /** Navigation step completion threshold - move to next step when within this distance */
  NAVIGATION_STEP_COMPLETION_THRESHOLD: 50, // 50 meters (0.05 miles)
} as const;

// Distance conversion constants
export const DISTANCE_CONVERSION = {
  /** Earth's radius in miles (for Haversine formula) */
  EARTH_RADIUS_MILES: 3959,
  
  /** Earth's radius in kilometers (for Haversine formula) */
  EARTH_RADIUS_KILOMETERS: 6371,
  
  /** Meters to miles conversion factor */
  METERS_TO_MILES: 0.000621371,
  
  /** Miles to meters conversion factor */
  MILES_TO_METERS: 1609.34,
} as const;

// API retry constants
export const API_RETRY = {
  /** Maximum number of retry attempts */
  MAX_RETRIES: 3,
  
  /** Initial delay before first retry (milliseconds) */
  INITIAL_DELAY: 1000, // 1 second
  
  /** Maximum delay between retries (milliseconds) */
  MAX_DELAY: 10000, // 10 seconds
  
  /** Backoff multiplier for exponential backoff */
  BACKOFF_MULTIPLIER: 2,
  
  /** HTTP status codes that should trigger a retry */
  RETRYABLE_STATUS_CODES: [408, 429, 500, 502, 503, 504],
} as const;
