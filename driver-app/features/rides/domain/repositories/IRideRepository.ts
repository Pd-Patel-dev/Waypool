/**
 * Ride Repository Interface
 * Defines the contract for data access operations
 * Follows Repository Pattern for testability and abstraction
 */

import type { RideEntity, RideFilters } from '../entities/Ride.entity';

export interface IRideRepository {
  /**
   * Find all rides for a driver
   */
  findByDriverId(driverId: number): Promise<RideEntity[]>;

  /**
   * Find a ride by ID
   */
  findById(rideId: number, driverId: number): Promise<RideEntity | null>;

  /**
   * Find rides matching filters
   */
  findWithFilters(driverId: number, filters: RideFilters): Promise<RideEntity[]>;

  /**
   * Create a new ride
   */
  create(ride: Partial<RideEntity>): Promise<RideEntity>;

  /**
   * Update an existing ride
   */
  update(rideId: number, updates: Partial<RideEntity>, driverId?: number): Promise<RideEntity>;

  /**
   * Delete a ride
   */
  delete(rideId: number, driverId: number): Promise<void>;

  /**
   * Check if a ride exists
   */
  exists(rideId: number): Promise<boolean>;
}

