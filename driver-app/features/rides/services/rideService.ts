/**
 * Ride Service (Legacy)
 * @deprecated Use RideApplicationService instead
 * Kept for backward compatibility during migration
 */

import { RideApplicationService } from "../application/services/RideApplicationService";
import { createRideRepository } from "../infrastructure/RideRepositoryFactory";
import { RideDomainService } from "../domain/services/RideDomainService";
import type { Ride } from "@/services/api";

// Create singleton instance
const rideRepository = createRideRepository();
const rideApplicationService = new RideApplicationService(rideRepository);

/**
 * Legacy static service methods
 * These delegate to the new application service
 */
export class RideService {
  /**
   * Fetch all rides for a driver
   * @deprecated Use RideApplicationService.getRides() instead
   */
  static async fetchRides(driverId: number): Promise<Ride[]> {
    try {
      const response = await rideApplicationService.getRides(driverId);
      // Convert domain entities back to API format for backward compatibility
      return response.rides.map(entityToApiRide);
    } catch (error) {
      throw new Error(
        `Failed to fetch rides: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete a ride
   * @deprecated Use RideApplicationService.deleteRide() instead
   */
  static async deleteRide(rideId: number, driverId: number): Promise<void> {
    try {
      const response = await rideApplicationService.deleteRide(
        rideId,
        driverId
      );
      if (!response.success) {
        throw new Error(response.message);
      }
    } catch (error) {
      throw new Error(
        `Failed to delete ride: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Filter rides by status
   * @deprecated Use RideDomainService.filterByStatus() instead
   */
  static filterRidesByStatus(
    rides: Ride[],
    status: "all" | "scheduled" | "in-progress" | "completed"
  ): Ride[] {
    const entities = rides.map(apiRideToEntity);
    const filtered = RideDomainService.filterByStatus(entities, status);
    return filtered.map(entityToApiRide);
  }

  /**
   * Sort rides by criteria
   * @deprecated Use RideDomainService.sortRides() instead
   */
  static sortRides(
    rides: Ride[],
    sortBy: "date" | "distance" | "earnings"
  ): Ride[] {
    const entities = rides.map(apiRideToEntity);
    const sorted = RideDomainService.sortRides(entities, sortBy);
    return sorted.map(entityToApiRide);
  }

  /**
   * Get active ride
   * @deprecated Use RideDomainService.getActiveRide() instead
   */
  static getActiveRide(rides: Ride[]): Ride | null {
    const entities = rides.map(apiRideToEntity);
    const active = RideDomainService.getActiveRide(entities);
    return active ? entityToApiRide(active) : null;
  }

  /**
   * Separate rides by date
   * @deprecated Use RideDomainService.separateByDate() instead
   */
  static separateRidesByDate(rides: Ride[]): {
    today: Ride[];
    upcoming: Ride[];
  } {
    const entities = rides.map(apiRideToEntity);
    const separated = RideDomainService.separateByDate(entities);
    return {
      today: separated.today.map(entityToApiRide),
      upcoming: separated.upcoming.map(entityToApiRide),
    };
  }
}

// Helper functions for backward compatibility
function apiRideToEntity(ride: Ride): any {
  return {
    ...ride,
    departureTime: new Date(ride.departureTime),
    status: ride.status || "scheduled",
  };
}

function entityToApiRide(entity: any): Ride {
  return {
    ...entity,
    departureTime:
      entity.departureTime instanceof Date
        ? entity.departureTime.toISOString()
        : entity.departureTime,
  } as Ride;
}
