/**
 * Centralized price calculation utilities
 * Provides a single source of truth for price and earnings calculations
 */

import { Ride } from '@/services/api';

// Platform fee constants (matching backend)
const PROCESSING_FEE_PERCENTAGE = 0.029; // 2.9%
const PROCESSING_FEE_FIXED = 0.30; // $0.30
const COMMISSION_PER_RIDE = 2.00; // $2.00 per ride

/**
 * Calculate gross earnings for a ride based on booked seats
 * Standardizes the calculation logic across the entire app
 * 
 * @param ride - Ride object with price information
 * @param bookedSeats - Number of booked seats (optional, will calculate if not provided)
 * @returns Gross earnings for the ride (before fees)
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

  // Calculate gross earnings: booked seats * price per seat
  return bookedSeats * pricePerSeat;
}

/**
 * Calculate net earnings for a ride (after processing fee and commission)
 * This matches the backend calculation logic
 * 
 * @param ride - Ride object with price information
 * @returns Net earnings for the ride (after all fees)
 */
export function calculateNetEarnings(ride: Ride): number {
  // Calculate gross earnings
  const grossEarnings = calculateRideEarnings(ride);
  
  // Calculate processing fee
  const processingFee = (grossEarnings * PROCESSING_FEE_PERCENTAGE) + PROCESSING_FEE_FIXED;
  
  // Commission is per ride
  const commission = COMMISSION_PER_RIDE;
  
  // Total fees
  const totalFees = processingFee + commission;
  
  // Net earnings (after all fees)
  const netEarnings = Math.max(0, grossEarnings - totalFees);
  
  return parseFloat(netEarnings.toFixed(2));
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

