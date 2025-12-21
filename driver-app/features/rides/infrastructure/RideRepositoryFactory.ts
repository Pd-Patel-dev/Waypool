/**
 * Repository Factory
 * Creates repository instances
 * Follows Dependency Injection pattern
 */

import { RideRepository } from "../data/repositories/RideRepository";
import { IRideRepository } from "../domain/repositories/IRideRepository";

/**
 * Factory function to create RideRepository
 * In a real app, this could use a DI container
 */
export function createRideRepository(): IRideRepository {
  return new RideRepository();
}
