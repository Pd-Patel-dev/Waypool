/**
 * Common Type Definitions
 * Shared types used throughout the application
 */

/**
 * Google Maps API response types
 */
export interface GoogleMapsRoute {
  routes: Array<{
    legs: Array<{
      steps: Array<{
        polyline: {
          points: string;
        };
        start_location: {
          lat: number;
          lng: number;
        };
        end_location: {
          lat: number;
          lng: number;
        };
      }>;
      distance: {
        value: number; // in meters
        text: string;
      };
      duration: {
        value: number; // in seconds
        text: string;
      };
    }>;
    overview_polyline: {
      points: string;
    };
  }>;
}

export interface GoogleMapsAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface GoogleMapsGeocodeResult {
  address_components: GoogleMapsAddressComponent[];
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

/**
 * Location service types
 */
export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationService {
  requestForegroundPermissionsAsync: () => Promise<{ status: string }>;
  getCurrentPositionAsync: (options?: {
    accuracy?: number;
    timeout?: number;
  }) => Promise<{
    coords: LocationCoordinates;
  }>;
}

/**
 * Event handler types
 */
export type EventHandler<T = unknown> = (data: T) => void;
export type EventHandlerWithArgs = (...args: unknown[]) => void;

/**
 * Generic response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * Pagination types
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

