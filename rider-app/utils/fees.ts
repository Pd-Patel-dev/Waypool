/**
 * Platform fee calculation utilities for riders
 * Fees are charged to riders and added to the subtotal
 */

// Platform fee constants (matching backend)
const PROCESSING_FEE_PERCENTAGE = 0.029; // 2.9%
const PROCESSING_FEE_FIXED = 0.30; // $0.30
const COMMISSION_PER_BOOKING = 2.00; // $2.00 per booking

/**
 * Calculate processing fee for a given amount (standard calculation)
 * @param amount - Subtotal amount
 * @returns Processing fee amount
 */
export function calculateProcessingFee(amount: number): number {
  const percentageFee = amount * PROCESSING_FEE_PERCENTAGE;
  const fixedFee = PROCESSING_FEE_FIXED;
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
export function calculateProcessingFeeGrossUp(subtotal: number, commission: number): number {
  // Gross-up formula: total = (subtotal + fixed_fee + commission) / (1 - percentage)
  // This ensures the processing fee percentage is applied to the total amount
  const fixedFee = PROCESSING_FEE_FIXED;
  const percentage = PROCESSING_FEE_PERCENTAGE;
  
  // Calculate total using gross-up formula
  const total = (subtotal + fixedFee + commission) / (1 - percentage);
  
  // Calculate processing fee on the total amount
  const processingFee = (total * percentage) + fixedFee;
  
  return processingFee;
}

/**
 * Calculate rider total with platform fees using gross-up formula
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
  const commission = COMMISSION_PER_BOOKING;
  
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

