/**
 * Ride-related types
 * Centralized type definitions for the rides feature
 * 
 * Note: This extends the API Ride type to ensure compatibility
 */

import type { Ride as ApiRide, Passenger as ApiPassenger } from '@/services/api';

// Re-export API types for convenience
export type Ride = ApiRide;
export type Passenger = ApiPassenger;

export interface Passenger {
  id: number;
  riderId: number;
  rideId: number;
  numberOfSeats: number;
  pickupAddress?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  pickupZipCode?: string;
  status?: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt?: string;
}

export type RideStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';

export interface RideFilters {
  status?: 'all' | 'scheduled' | 'in-progress' | 'completed';
  sortBy?: 'date' | 'distance' | 'earnings';
}

