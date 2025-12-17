-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "pickupStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "pickedUpAt" TIMESTAMP(3),
ADD COLUMN "pickupPinHash" TEXT,
ADD COLUMN "pickupPinEncrypted" TEXT,
ADD COLUMN "pickupPinExpiresAt" TIMESTAMP(3),
ADD COLUMN "pickupPinAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pickupPinLockedUntil" TIMESTAMP(3);

