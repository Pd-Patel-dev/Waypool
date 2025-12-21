/**
 * Get Rides Use Case
 * Application layer - orchestrates domain services and repositories
 * Implements specific business use cases
 */

import { IRideRepository } from '../../domain/repositories/IRideRepository';
import { RideDomainService } from '../../domain/services/RideDomainService';
import type { RideEntity, RideFilters } from '../../domain/entities/Ride.entity';

export interface GetRidesRequest {
  driverId: number;
  filters?: RideFilters;
}

export interface GetRidesResponse {
  rides: RideEntity[];
  activeRide: RideEntity | null;
  todaysRides: RideEntity[];
  upcomingRides: RideEntity[];
  pastRides: RideEntity[];
}

export class GetRidesUseCase {
  constructor(private rideRepository: IRideRepository) {}

  async execute(request: GetRidesRequest): Promise<GetRidesResponse> {
    // 1. Fetch rides from repository
    let rides: RideEntity[];
    if (request.filters) {
      rides = await this.rideRepository.findWithFilters(request.driverId, request.filters);
    } else {
      rides = await this.rideRepository.findByDriverId(request.driverId);
    }

    // 2. Apply business logic filters
    if (request.filters?.status) {
      rides = RideDomainService.filterByStatus(rides, request.filters.status);
    }

    // 3. Apply sorting
    if (request.filters?.sortBy) {
      rides = RideDomainService.sortRides(rides, request.filters.sortBy);
    }

    // 4. Separate by date using domain service
    const { today, upcoming, past } = RideDomainService.separateByDate(rides);

    // 5. Get active ride
    const activeRide = RideDomainService.getActiveRide(rides);

    return {
      rides,
      activeRide,
      todaysRides: today,
      upcomingRides: upcoming,
      pastRides: past,
    };
  }
}

