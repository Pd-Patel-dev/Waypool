/**
 * Earnings Calculation Utilities
 *
 * Platform fees are charged to riders, not deducted from driver earnings.
 * Drivers receive the full booking amount.
 *
 * Fee calculation utilities:
 * - Processing fee (configurable percentage or fixed amount)
 * - Commission ($2 per booking)
 */

/**
 * Platform fee configuration
 * These can be moved to environment variables if needed
 */
export const PLATFORM_FEES = {
  // Processing fee: typically 2.9% + $0.30 for Stripe, but can be customized
  PROCESSING_FEE_PERCENTAGE: 0.029, // 2.9%
  PROCESSING_FEE_FIXED: 0.3, // $0.30

  // Platform commission per ride
  COMMISSION_PER_RIDE: 2.0, // $2.00 per ride
} as const;

/**
 * Calculate processing fee for a given amount (standard calculation)
 * @param amount - Gross amount before fees
 * @returns Processing fee amount
 */
export function calculateProcessingFee(amount: number): number {
  const percentageFee = amount * PLATFORM_FEES.PROCESSING_FEE_PERCENTAGE;
  const fixedFee = PLATFORM_FEES.PROCESSING_FEE_FIXED;
  return percentageFee + fixedFee;
}

/**
 * Calculate processing fee using gross-up formula
 * The processing fee is calculated on the total amount (including the fee itself)
 * Formula: total = (subtotal + fixed_fee + commission) / (1 - percentage)
 * Then: processing_fee = (total * percentage) + fixed_fee
 * @param subtotal - Subtotal amount (price per seat × number of seats)
 * @param commission - Platform commission amount
 * @returns Processing fee amount calculated using gross-up
 */
export function calculateProcessingFeeGrossUp(
  subtotal: number,
  commission: number
): number {
  // Gross-up formula: total = (subtotal + fixed_fee + commission) / (1 - percentage)
  // This ensures the processing fee percentage is applied to the total amount
  const fixedFee = PLATFORM_FEES.PROCESSING_FEE_FIXED;
  const percentage = PLATFORM_FEES.PROCESSING_FEE_PERCENTAGE;

  // Calculate total using gross-up formula
  const total = (subtotal + fixedFee + commission) / (1 - percentage);

  // Calculate processing fee on the total amount
  const processingFee = total * percentage + fixedFee;

  return processingFee;
}

/**
 * Calculate rider total with platform fees using gross-up formula
 * Fees are charged to riders, not deducted from driver earnings
 * Processing fee is calculated using gross-up formula (fee calculated on total amount)
 * @param subtotal - Subtotal amount (price per seat × number of seats)
 * @returns Object with subtotal, fees breakdown, and total amount rider pays
 */
export function calculateRiderTotal(subtotal: number): {
  subtotal: number;
  processingFee: number;
  commission: number;
  totalFees: number;
  total: number;
} {
  // Commission is per booking
  const commission = PLATFORM_FEES.COMMISSION_PER_RIDE;

  // Calculate processing fee using gross-up formula
  // This ensures the processing fee percentage is applied to the total amount
  const processingFee = calculateProcessingFeeGrossUp(subtotal, commission);

  // Total fees
  const totalFees = processingFee + commission;

  // Total amount rider pays (subtotal + fees)
  const total = subtotal + totalFees;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    processingFee: parseFloat(processingFee.toFixed(2)),
    commission: parseFloat(commission.toFixed(2)),
    totalFees: parseFloat(totalFees.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
}

/**
 * Calculate driver earnings (full amount, no fees deducted)
 * Platform fees are charged to riders, so drivers receive the full booking amount
 * @param grossEarnings - Gross earnings (sum of pricePerSeat * numberOfSeats for all bookings)
 * @returns Object with driver earnings (same as gross, no fees deducted)
 */
export function calculateDriverEarnings(grossEarnings: number): {
  grossEarnings: number;
  netEarnings: number;
} {
  // Drivers receive full amount (fees are charged to riders)
  const netEarnings = grossEarnings;

  return {
    grossEarnings: parseFloat(grossEarnings.toFixed(2)),
    netEarnings: parseFloat(netEarnings.toFixed(2)),
  };
}

/**
 * Calculate earnings for a single ride
 * Drivers receive full booking amounts (fees are charged to riders)
 * @param pricePerSeat - Fallback price per seat for the ride (used if booking doesn't have pricePerSeat)
 * @param bookings - Array of bookings with numberOfSeats and pricePerSeat (locked in at booking time)
 * @returns Earnings breakdown for the ride (drivers get full amount)
 */
export function calculateRideEarnings(
  pricePerSeat: number,
  bookings: Array<{
    numberOfSeats?: number | null;
    pricePerSeat?: number | null;
  }>
): {
  grossEarnings: number;
  netEarnings: number;
} {
  // Calculate gross earnings: sum of (numberOfSeats * pricePerSeat) for all bookings
  // Use booking.pricePerSeat (locked in at booking time) instead of current ride price
  const grossEarnings = bookings.reduce((sum, booking) => {
    const seats = booking.numberOfSeats || 1;
    // Use booking's locked-in price if available, otherwise fallback to ride price
    const bookingPrice = booking.pricePerSeat ?? pricePerSeat;
    return sum + seats * bookingPrice;
  }, 0);

  return calculateDriverEarnings(grossEarnings);
}
