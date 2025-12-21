// Hooks (Presentation Layer)
export { useRides } from './hooks/useRides';
export type { UseRidesOptions, UseRidesReturn } from './hooks/useRides';

// Application Layer
export * from './application';

// Domain Layer
export * from './domain';

// Infrastructure Layer
export * from './infrastructure';

// Data Layer
export * from './data';

// Legacy Services (for backward compatibility)
export { RideService } from './services/rideService';
export { LocationService } from './services/locationService';
export type { LocationCoords, LocationInfo } from './services/locationService';

// Types (re-exported from domain)
export type { RideEntity as Ride, PassengerEntity as Passenger, RideStatus, RideFilters } from './domain/entities/Ride.entity';

// Utils
export { calculateRideEarnings, calculateNetEarnings, getPricePerSeat, calculateTotalEarnings } from './utils/rideCalculations';
export { calculateTotalDistance, calculateDistance, calculateDistanceMeters } from './utils/rideCalculations';
export { formatRideDateTime, formatRideDate, formatRideTime } from './utils/rideFormatters';

