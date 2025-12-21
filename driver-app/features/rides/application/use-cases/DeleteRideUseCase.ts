/**
 * Delete Ride Use Case
 * Application layer - orchestrates business rules and data access
 */

import { IRideRepository } from '../../domain/repositories/IRideRepository';
import { RideDomainService } from '../../domain/services/RideDomainService';
import type { RideEntity } from '../../domain/entities/Ride.entity';

export interface DeleteRideRequest {
  rideId: number;
  driverId: number;
}

export interface DeleteRideResponse {
  success: boolean;
  message: string;
}

export class DeleteRideUseCase {
  constructor(private rideRepository: IRideRepository) {}

  async execute(request: DeleteRideRequest): Promise<DeleteRideResponse> {
    // 1. Fetch the ride to check business rules
    const ride = await this.rideRepository.findById(request.rideId, request.driverId);

    if (!ride) {
      return {
        success: false,
        message: 'Ride not found',
      };
    }

    // 2. Check business rule: Can this ride be deleted?
    if (!RideDomainService.canDeleteRide(ride)) {
      return {
        success: false,
        message: `Cannot delete ride with status: ${ride.status}`,
      };
    }

    // 3. Perform deletion
    await this.rideRepository.delete(request.rideId, request.driverId);

    return {
      success: true,
      message: 'Ride deleted successfully',
    };
  }
}

