/**
 * Ride Repository Implementation
 * Handles data access operations (API calls)
 * Implements IRideRepository interface
 */

import { IRideRepository } from '../../domain/repositories/IRideRepository';
import { RideEntity, PassengerEntity, RideStatus, PassengerStatus } from '../../domain/entities/Ride.entity';
import { getUpcomingRides, getRideById, createRide, updateRide, deleteRide, type Ride as ApiRide, type Passenger as ApiPassenger } from '@/services/api';

/**
 * Maps API Ride to Domain Entity
 */
function mapApiRideToEntity(apiRide: ApiRide): RideEntity {
  return {
    id: apiRide.id,
    driverId: apiRide.driverId || 0,
    fromAddress: apiRide.fromAddress,
    toAddress: apiRide.toAddress,
    fromLatitude: apiRide.fromLatitude,
    fromLongitude: apiRide.fromLongitude,
    toLatitude: apiRide.toLatitude,
    toLongitude: apiRide.toLongitude,
    departureTime: new Date(apiRide.departureTime),
    pricePerSeat: apiRide.pricePerSeat || apiRide.price || 0,
    totalSeats: apiRide.totalSeats,
    availableSeats: apiRide.availableSeats,
    distance: apiRide.distance,
    status: (apiRide.status || 'scheduled') as RideStatus,
    passengers: (apiRide.passengers || []).map(mapApiPassengerToEntity),
    createdAt: apiRide.createdAt ? new Date(apiRide.createdAt) : undefined,
    updatedAt: apiRide.updatedAt ? new Date(apiRide.updatedAt) : undefined,
  };
}

/**
 * Maps API Passenger to Domain Entity
 */
function mapApiPassengerToEntity(apiPassenger: ApiPassenger): PassengerEntity {
  return {
    id: apiPassenger.id,
    riderId: apiPassenger.riderId || 0,
    rideId: apiPassenger.rideId || 0,
    numberOfSeats: apiPassenger.numberOfSeats || 1,
    pickupAddress: apiPassenger.pickupAddress,
    pickupLatitude: apiPassenger.pickupLatitude,
    pickupLongitude: apiPassenger.pickupLongitude,
    status: (apiPassenger.status || 'pending') as PassengerStatus,
  };
}

/**
 * Maps Domain Entity to API Ride (for create/update)
 * Note: driverId is now obtained from JWT token - not included in request
 */
function mapEntityToApiRide(entity: Partial<RideEntity>): Partial<ApiRide> {
  return {
    // driverId removed - backend gets it from JWT token
    fromAddress: entity.fromAddress,
    toAddress: entity.toAddress,
    fromLatitude: entity.fromLatitude,
    fromLongitude: entity.fromLongitude,
    toLatitude: entity.toLatitude,
    toLongitude: entity.toLongitude,
    departureTime: entity.departureTime?.toISOString(),
    pricePerSeat: entity.pricePerSeat,
    totalSeats: entity.totalSeats,
    availableSeats: entity.availableSeats,
    distance: entity.distance,
    status: entity.status,
  };
}

export class RideRepository implements IRideRepository {
  async findByDriverId(driverId: number): Promise<RideEntity[]> {
    try {
      // driverId parameter kept for interface compatibility, but not sent to API (JWT handles auth)
      const apiRides = await getUpcomingRides();
      return apiRides.map(mapApiRideToEntity);
    } catch (error) {
      // Provide more detailed error information
      const errorMessage = error instanceof Error 
        ? error.message 
        : (error && typeof error === 'object' && 'message' in error)
          ? String(error.message)
          : 'Unknown error';
      
      console.error('RideRepository.findByDriverId error:', error);
      
      // Check if it's an authentication error that requires login
      if (error && typeof error === 'object' && 'requiresLogin' in error && error.requiresLogin) {
        // Preserve the authentication error message
        throw new Error(errorMessage);
      }
      
      throw new Error(`Failed to fetch rides: ${errorMessage}`);
    }
  }

  async findById(rideId: number, driverId: number): Promise<RideEntity | null> {
    try {
      // driverId parameter kept for interface compatibility, but not sent to API (JWT handles auth)
      const apiRide = await getRideById(rideId);
      return apiRide ? mapApiRideToEntity(apiRide) : null;
    } catch (error) {
      throw new Error(`Failed to fetch ride: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async findWithFilters(driverId: number, filters: any): Promise<RideEntity[]> {
    // For now, fetch all and filter in memory
    // In production, this could be optimized with backend filtering
    const allRides = await this.findByDriverId(driverId);
    return this.applyFilters(allRides, filters);
  }

  private applyFilters(rides: RideEntity[], filters: any): RideEntity[] {
    let filtered = [...rides];

    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(r => r.status === filters.status);
    }

    if (filters.dateRange) {
      filtered = filtered.filter(r => {
        const rideDate = r.departureTime;
        return rideDate >= filters.dateRange.start && rideDate <= filters.dateRange.end;
      });
    }

    return filtered;
  }

  async create(ride: Partial<RideEntity>): Promise<RideEntity> {
    try {
      const apiRide = mapEntityToApiRide(ride);
      const response = await createRide(apiRide as any);
      if (!response.ride) {
        throw new Error('Failed to create ride: No ride returned');
      }
      return mapApiRideToEntity(response.ride);
    } catch (error) {
      throw new Error(`Failed to create ride: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async update(rideId: number, updates: Partial<RideEntity>, driverId?: number): Promise<RideEntity> {
    try {
      // driverId parameter kept for interface compatibility, but not sent to API (JWT handles auth)
      const apiUpdates = mapEntityToApiRide(updates);
      const response = await updateRide(rideId, apiUpdates as any);
      if (!response.ride) {
        throw new Error('Failed to update ride: No ride returned');
      }
      return mapApiRideToEntity(response.ride);
    } catch (error) {
      throw new Error(`Failed to update ride: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async delete(rideId: number, driverId: number): Promise<void> {
    try {
      // driverId parameter kept for interface compatibility, but not sent to API (JWT handles auth)
      await deleteRide(rideId);
    } catch (error) {
      throw new Error(`Failed to delete ride: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async exists(rideId: number): Promise<boolean> {
    try {
      // This would need a backend endpoint to check existence
      // For now, try to fetch and check if it exists
      const ride = await getRideById(rideId); // driverId not needed - JWT handles auth
      return ride !== null;
    } catch {
      return false;
    }
  }
}

