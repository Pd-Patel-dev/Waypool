/*
  Warnings:

  - Made the column `city` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `photoUrl` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `carColor` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `carMake` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `carModel` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `carYear` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- Update existing NULL values with default values
UPDATE "users" SET 
  "photoUrl" = COALESCE("photoUrl", ''),
  "city" = COALESCE("city", ''),
  "carMake" = COALESCE("carMake", ''),
  "carModel" = COALESCE("carModel", ''),
  "carYear" = COALESCE("carYear", 2000),
  "carColor" = COALESCE("carColor", '')
WHERE "photoUrl" IS NULL OR "city" IS NULL OR "carMake" IS NULL OR "carModel" IS NULL OR "carYear" IS NULL OR "carColor" IS NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "city" SET NOT NULL,
ALTER COLUMN "photoUrl" SET NOT NULL,
ALTER COLUMN "carColor" SET NOT NULL,
ALTER COLUMN "carMake" SET NOT NULL,
ALTER COLUMN "carModel" SET NOT NULL,
ALTER COLUMN "carYear" SET NOT NULL;
