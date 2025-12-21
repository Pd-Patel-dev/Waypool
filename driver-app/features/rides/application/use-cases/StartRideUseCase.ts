/**
 * Start Ride Use Case
 * Application layer - orchestrates business rules and data access
 */

import { IRideRepository } from '../../domain/repositories/IRideRepository';
import { RideDomainService } from '../../domain/services/RideDomainService';
import type { RideEntity } from '../../domain/entities/Ride.entity';

export interface StartRideRequest {
  rideId: number;
  driverId: number;
}

export interface StartRideResponse {
  success: boolean;
  ride: RideEntity | null;
  message: string;
}

export class StartRideUseCase {
  constructor(private rideRepository: IRideRepository) {}

  async execute(request: StartRideRequest): Promise<StartRideResponse> {
    // 1. Fetch the ride
    const ride = await this.rideRepository.findById(request.rideId, request.driverId);

    if (!ride) {
      return {
        success: false,
        ride: null,
        message: 'Ride not found',
      };
    }

    // 2. Check business rule: Can this ride be started?
    if (!RideDomainService.canStartRide(ride)) {
      return {
        success: false,
        ride: null,
        message: `Cannot start ride. Status: ${ride.status}, Date: ${ride.departureTime.toDateString()}`,
      };
    }

    // 3. Update ride status to in-progress
    const updatedRide = await this.rideRepository.update(request.rideId, {
      status: 'in-progress',
    });

    return {
      success: true,
      ride: updatedRide,
      message: 'Ride started successfully',
    };
  }
}

