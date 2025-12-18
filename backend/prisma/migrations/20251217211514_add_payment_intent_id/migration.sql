-- AlterTable
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "paymentIntentId" TEXT;
