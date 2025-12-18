/**
 * Earnings Calculation Utilities
 * 
 * Calculates driver earnings after deducting platform fees:
 * - Processing fee (configurable percentage or fixed amount)
 * - Commission ($2 per ride)
 */

/**
 * Platform fee configuration
 * These can be moved to environment variables if needed
 */
export const PLATFORM_FEES = {
  // Processing fee: typically 2.9% + $0.30 for Stripe, but can be customized
  PROCESSING_FEE_PERCENTAGE: 0.029, // 2.9%
  PROCESSING_FEE_FIXED: 0.30, // $0.30
  
  // Platform commission per ride
  COMMISSION_PER_RIDE: 2.00, // $2.00 per ride
} as const;

/**
 * Calculate processing fee for a given amount
 * @param amount - Gross amount before fees
 * @returns Processing fee amount
 */
export function calculateProcessingFee(amount: number): number {
  const percentageFee = amount * PLATFORM_FEES.PROCESSING_FEE_PERCENTAGE;
  const fixedFee = PLATFORM_FEES.PROCESSING_FEE_FIXED;
  return percentageFee + fixedFee;
}

/**
 * Calculate driver earnings after deducting platform fees
 * @param grossEarnings - Gross earnings (sum of pricePerSeat * numberOfSeats for all bookings)
 * @returns Object with gross earnings, fees breakdown, and net driver earnings
 */
export function calculateDriverEarnings(grossEarnings: number): {
  grossEarnings: number;
  processingFee: number;
  commission: number;
  totalFees: number;
  netEarnings: number;
} {
  // Calculate processing fee
  const processingFee = calculateProcessingFee(grossEarnings);
  
  // Commission is per ride (not per booking)
  const commission = PLATFORM_FEES.COMMISSION_PER_RIDE;
  
  // Total fees
  const totalFees = processingFee + commission;
  
  // Net earnings for driver (after all fees)
  const netEarnings = Math.max(0, grossEarnings - totalFees);
  
  return {
    grossEarnings: parseFloat(grossEarnings.toFixed(2)),
    processingFee: parseFloat(processingFee.toFixed(2)),
    commission: parseFloat(commission.toFixed(2)),
    totalFees: parseFloat(totalFees.toFixed(2)),
    netEarnings: parseFloat(netEarnings.toFixed(2)),
  };
}

/**
 * Calculate earnings for a single ride
 * @param pricePerSeat - Price per seat for the ride
 * @param bookings - Array of bookings with numberOfSeats
 * @returns Earnings breakdown for the ride
 */
export function calculateRideEarnings(
  pricePerSeat: number,
  bookings: Array<{ numberOfSeats?: number | null }>
): {
  grossEarnings: number;
  processingFee: number;
  commission: number;
  totalFees: number;
  netEarnings: number;
} {
  // Calculate gross earnings: sum of (numberOfSeats * pricePerSeat) for all bookings
  const grossEarnings = bookings.reduce((sum, booking) => {
    const seats = booking.numberOfSeats || 1;
    return sum + (seats * pricePerSeat);
  }, 0);
  
  return calculateDriverEarnings(grossEarnings);
}

