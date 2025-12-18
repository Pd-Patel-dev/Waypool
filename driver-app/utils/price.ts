/**
 * Centralized price calculation utilities
 * Provides a single source of truth for price and earnings calculations
 */

import { Ride } from '@/services/api';

/**
 * Calculate earnings for a ride based on booked seats
 * Standardizes the calculation logic across the entire app
 * 
 * @param ride - Ride object with price information
 * @param bookedSeats - Number of booked seats (optional, will calculate if not provided)
 * @returns Total earnings for the ride
 */
export function calculateRideEarnings(ride: Ride, bookedSeats?: number): number {
  // If bookedSeats is not provided, calculate it
  if (bookedSeats === undefined) {
    if (ride.passengers && ride.passengers.length > 0) {
      // Sum up all booked seats from passengers
      bookedSeats = ride.passengers.reduce((sum, passenger) => {
        return sum + (passenger.numberOfSeats || 1);
      }, 0);
    } else {
      // Fallback: calculate from totalSeats and availableSeats
      const totalSeats = ride.totalSeats || 0;
      const availableSeats = ride.availableSeats || 0;
      bookedSeats = Math.max(0, totalSeats - availableSeats);
    }
  }

  // Use pricePerSeat if available, otherwise fall back to price
  const pricePerSeat = ride.pricePerSeat ?? ride.price ?? 0;

  // Calculate total earnings: booked seats * price per seat
  return bookedSeats * pricePerSeat;
}

/**
 * Get price per seat for a ride
 * Standardizes how we extract the price per seat value
 * 
 * @param ride - Ride object with price information
 * @returns Price per seat (or 0 if not available)
 */
export function getPricePerSeat(ride: Ride): number {
  return ride.pricePerSeat ?? ride.price ?? 0;
}

/**
 * Calculate total earnings from an array of rides
 * 
 * @param rides - Array of Ride objects
 * @returns Total earnings across all rides
 */
export function calculateTotalEarnings(rides: Ride[]): number {
  return rides.reduce((total, ride) => {
    return total + calculateRideEarnings(ride);
  }, 0);
}

