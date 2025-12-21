/**
 * Ride Domain Service
 * Contains pure business logic and rules
 * No dependencies on external frameworks or APIs
 */

import type { RideEntity, RideFilters } from "../entities/Ride.entity";
import { calculateTotalDistance } from "@/utils/distance";
import { calculateRideEarnings } from "@/utils/price";

export class RideDomainService {
  /**
   * Filter rides by status
   * Business rule: 'scheduled' includes rides with no status
   */
  static filterByStatus(
    rides: RideEntity[],
    status: "all" | "scheduled" | "in-progress" | "completed"
  ): RideEntity[] {
    if (status === "all") return rides;
    if (status === "scheduled") {
      return rides.filter((r) => r.status === "scheduled" || !r.status);
    }
    return rides.filter((r) => r.status === status);
  }

  /**
   * Sort rides by criteria
   * Business rule: 
   * - Date: ascending (soonest first)
   * - Distance: from current location, ascending (closest first)
   * - Earnings: descending (highest first)
   */
  static sortRides(
    rides: RideEntity[],
    sortBy: "date" | "distance" | "earnings",
    currentLocation?: { latitude: number; longitude: number } | null
  ): RideEntity[] {
    // Import calculateDistance locally to avoid circular dependency
    const calculateDistance = (
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number
    ): number => {
      const R = 3959; // Radius of the Earth in miles
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c; // Distance in miles
    };

    return [...rides].sort((a, b) => {
      if (sortBy === "date") {
        return a.departureTime.getTime() - b.departureTime.getTime();
      }
      if (sortBy === "distance") {
        // If current location is available, sort by distance from current location
        if (currentLocation && a.fromLatitude && a.fromLongitude && b.fromLatitude && b.fromLongitude) {
          const distA = calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            a.fromLatitude,
            a.fromLongitude
          );
          const distB = calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            b.fromLatitude,
            b.fromLongitude
          );
          return distA - distB; // Ascending (closest first)
        }
        // Fallback to total ride distance if no current location
        const distA = calculateTotalDistance(a as any);
        const distB = calculateTotalDistance(b as any);
        return distA - distB; // Ascending (shorter rides first)
      }
      if (sortBy === "earnings") {
        const earningsA = calculateRideEarnings(a as any);
        const earningsB = calculateRideEarnings(b as any);
        return earningsB - earningsA; // Descending
      }
      return 0;
    });
  }

  /**
   * Get active ride
   * Business rule: Only one ride can be in-progress at a time
   */
  static getActiveRide(rides: RideEntity[]): RideEntity | null {
    return rides.find((ride) => ride.status === "in-progress") || null;
  }

  /**
   * Separate rides by date
   * Business rule: Today's rides are shown separately from upcoming
   */
  static separateByDate(rides: RideEntity[]): {
    today: RideEntity[];
    upcoming: RideEntity[];
    past: RideEntity[];
  } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return rides.reduce(
      (acc, ride) => {
        const rideDate = new Date(ride.departureTime);
        rideDate.setHours(0, 0, 0, 0);

        if (rideDate.getTime() === today.getTime()) {
          acc.today.push(ride);
        } else if (rideDate > today) {
          acc.upcoming.push(ride);
        } else {
          acc.past.push(ride);
        }

        return acc;
      },
      {
        today: [] as RideEntity[],
        upcoming: [] as RideEntity[],
        past: [] as RideEntity[],
      }
    );
  }

  /**
   * Check if ride can be started
   * Business rule: Only scheduled rides for today can be started
   */
  static canStartRide(ride: RideEntity): boolean {
    if (ride.status !== "scheduled" && ride.status) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rideDate = new Date(ride.departureTime);
    rideDate.setHours(0, 0, 0, 0);

    return rideDate.getTime() === today.getTime();
  }

  /**
   * Check if ride can be edited
   * Business rule: Only scheduled rides can be edited
   */
  static canEditRide(ride: RideEntity): boolean {
    return ride.status === "scheduled" || !ride.status;
  }

  /**
   * Check if ride can be deleted
   * Business rule: Only scheduled rides can be deleted
   */
  static canDeleteRide(ride: RideEntity): boolean {
    return ride.status === "scheduled" || !ride.status;
  }

  /**
   * Calculate total booked seats
   */
  static getTotalBookedSeats(ride: RideEntity): number {
    return ride.passengers.reduce((sum, passenger) => {
      return sum + passenger.numberOfSeats;
    }, 0);
  }

  /**
   * Check if ride is full
   */
  static isRideFull(ride: RideEntity): boolean {
    const bookedSeats = this.getTotalBookedSeats(ride);
    return bookedSeats >= ride.totalSeats;
  }

  /**
   * Get available seats count
   */
  static getAvailableSeats(ride: RideEntity): number {
    const bookedSeats = this.getTotalBookedSeats(ride);
    return Math.max(0, ride.totalSeats - bookedSeats);
  }
}
