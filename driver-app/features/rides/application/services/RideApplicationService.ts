/**
 * Ride Application Service
 * High-level service that coordinates use cases
 * Provides a simplified interface for the presentation layer
 */

import { IRideRepository } from '../../domain/repositories/IRideRepository';
import { GetRidesUseCase, DeleteRideUseCase, StartRideUseCase } from '../use-cases';
import type { RideEntity, RideFilters } from '../../domain/entities/Ride.entity';

export class RideApplicationService {
  private getRidesUseCase: GetRidesUseCase;
  private deleteRideUseCase: DeleteRideUseCase;
  private startRideUseCase: StartRideUseCase;

  constructor(repository: IRideRepository) {
    this.getRidesUseCase = new GetRidesUseCase(repository);
    this.deleteRideUseCase = new DeleteRideUseCase(repository);
    this.startRideUseCase = new StartRideUseCase(repository);
  }

  /**
   * Get all rides for a driver with optional filters
   */
  async getRides(driverId: number, filters?: RideFilters) {
    return this.getRidesUseCase.execute({ driverId, filters });
  }

  /**
   * Delete a ride (with business rule validation)
   */
  async deleteRide(rideId: number, driverId: number) {
    return this.deleteRideUseCase.execute({ rideId, driverId });
  }

  /**
   * Start a ride (with business rule validation)
   */
  async startRide(rideId: number, driverId: number) {
    return this.startRideUseCase.execute({ rideId, driverId });
  }
}

