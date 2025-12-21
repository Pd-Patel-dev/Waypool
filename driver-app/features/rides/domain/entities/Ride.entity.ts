/**
 * Ride Domain Entity
 * Pure business object representing a ride
 * No dependencies on external libraries or frameworks
 */

export interface RideEntity {
  id: number;
  driverId: number;
  fromAddress: string;
  toAddress: string;
  fromLatitude?: number;
  fromLongitude?: number;
  toLatitude?: number;
  toLongitude?: number;
  departureTime: Date;
  pricePerSeat: number;
  totalSeats: number;
  availableSeats: number;
  distance?: number;
  status: RideStatus;
  passengers: PassengerEntity[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PassengerEntity {
  id: number;
  riderId: number;
  rideId: number;
  numberOfSeats: number;
  pickupAddress?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  status: PassengerStatus;
}

export type RideStatus =
  | "scheduled"
  | "in-progress"
  | "completed"
  | "cancelled";
export type PassengerStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled";

/**
 * Domain value objects
 */
export interface Location {
  latitude: number;
  longitude: number;
}

export interface Route {
  origin: Location;
  destination: Location;
  waypoints?: Location[];
}

export interface RideFilters {
  status?: "all" | "scheduled" | "in-progress" | "completed";
  sortBy?: "date" | "distance" | "earnings";
  dateRange?: {
    start: Date;
    end: Date;
  };
}
