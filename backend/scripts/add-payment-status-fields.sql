-- Migration: Add payment status tracking fields to bookings table
-- Run this migration to add payment status tracking

-- Add payment status fields
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS payment_currency VARCHAR(10) DEFAULT 'usd',
ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP;

-- Add index on payment_status for faster queries
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);

-- Add index on payment_intent_id for webhook lookups
CREATE INDEX IF NOT EXISTS idx_bookings_payment_intent_id ON bookings(payment_intent_id) WHERE payment_intent_id IS NOT NULL;

-- Update existing bookings with payment status based on payment_intent_id
-- Note: This assumes existing bookings with payment_intent_id are authorized
UPDATE bookings 
SET payment_status = 'authorized' 
WHERE payment_intent_id IS NOT NULL 
  AND payment_status IS NULL;

COMMENT ON COLUMN bookings.payment_status IS 'Payment status: pending, authorized, captured, failed, refunded, partially_refunded';
COMMENT ON COLUMN bookings.payment_amount IS 'Total amount charged in dollars';
COMMENT ON COLUMN bookings.payment_currency IS 'Currency code (e.g., usd)';
COMMENT ON COLUMN bookings.refund_amount IS 'Amount refunded in dollars';
COMMENT ON COLUMN bookings.refunded_at IS 'Timestamp when refund was processed';

