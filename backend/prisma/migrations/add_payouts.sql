-- Add Stripe Connect fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS "stripeAccountId" TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS "stripeAccountStatus" TEXT,
ADD COLUMN IF NOT EXISTS "bankAccountId" TEXT,
ADD COLUMN IF NOT EXISTS "bankAccountLast4" TEXT,
ADD COLUMN IF NOT EXISTS "bankAccountType" TEXT,
ADD COLUMN IF NOT EXISTS "bankAccountStatus" TEXT,
ADD COLUMN IF NOT EXISTS "payoutsEnabled" BOOLEAN DEFAULT false;

-- Create payouts table
CREATE TABLE IF NOT EXISTS payouts (
  id SERIAL PRIMARY KEY,
  "driverId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "stripePayoutId" TEXT UNIQUE,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL,
  "payoutMethod" TEXT DEFAULT 'bank_account',
  description TEXT,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "arrivalDate" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payouts_driverId ON payouts("driverId");
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_createdAt ON payouts("createdAt");
