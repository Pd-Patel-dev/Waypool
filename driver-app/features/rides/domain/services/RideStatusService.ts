/**
 * Ride Status Domain Service
 * Handles status-related business logic
 */

import type { RideEntity, RideStatus } from "../entities/Ride.entity";

export interface StatusBadge {
  text: string;
  color: string;
  bgColor: string;
}

export class RideStatusService {
  /**
   * Get status badge information for UI
   */
  static getStatusBadge(ride: RideEntity): StatusBadge {
    switch (ride.status) {
      case "in-progress":
        return {
          text: "IN PROGRESS",
          color: "#4285F4",
          bgColor: "rgba(66, 133, 244, 0.15)",
        };
      case "completed":
        return {
          text: "COMPLETED",
          color: "#34C759",
          bgColor: "rgba(52, 199, 89, 0.15)",
        };
      case "cancelled":
        return {
          text: "CANCELLED",
          color: "#FF3B30",
          bgColor: "rgba(255, 59, 48, 0.15)",
        };
      default:
        return {
          text: "SCHEDULED",
          color: "#FFD60A",
          bgColor: "rgba(255, 214, 10, 0.15)",
        };
    }
  }

  /**
   * Check if status transition is valid
   * Business rule: Status can only transition in specific ways
   */
  static canTransitionTo(
    currentStatus: RideStatus,
    newStatus: RideStatus
  ): boolean {
    const validTransitions: Record<RideStatus, RideStatus[]> = {
      scheduled: ["in-progress", "cancelled"],
      "in-progress": ["completed", "cancelled"],
      completed: [], // Terminal state
      cancelled: [], // Terminal state
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Get next valid statuses
   */
  static getNextValidStatuses(currentStatus: RideStatus): RideStatus[] {
    const validTransitions: Record<RideStatus, RideStatus[]> = {
      scheduled: ["in-progress", "cancelled"],
      "in-progress": ["completed", "cancelled"],
      completed: [],
      cancelled: [],
    };

    return validTransitions[currentStatus] || [];
  }
}
