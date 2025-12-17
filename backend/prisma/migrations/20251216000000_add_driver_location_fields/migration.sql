-- AlterTable
ALTER TABLE "users" ADD COLUMN "lastLocationLatitude" DOUBLE PRECISION,
ADD COLUMN "lastLocationLongitude" DOUBLE PRECISION,
ADD COLUMN "lastLocationUpdate" TIMESTAMP(3);

