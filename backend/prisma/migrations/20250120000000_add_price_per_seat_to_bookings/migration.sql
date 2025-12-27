-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "pricePerSeat" DOUBLE PRECISION;

-- Update existing bookings with the current ride price as a fallback
-- This ensures existing bookings have a price set
UPDATE "bookings" b
SET "pricePerSeat" = r."pricePerSeat"
FROM "rides" r
WHERE b."rideId" = r.id AND b."pricePerSeat" IS NULL;



