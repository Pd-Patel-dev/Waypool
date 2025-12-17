import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { useUser } from './UserContext';
import { realtimeService } from '@/services/realtimeService';
import type {
  BookingAcceptedEvent,
  BookingRejectedEvent,
  BookingStatusChangedEvent,
  RideStartedEvent,
  RideCompletedEvent,
  RideStatusChangedEvent,
  PassengerPickedUpEvent,
  RidePassengerPickedUpEvent,
  DriverLocationEvent,
} from '@/services/realtimeService';

interface RealtimeContextType {
  isConnected: boolean;
  joinRide: (rideId: number) => void;
  leaveRide: (rideId: number) => void;
  sendLocationUpdate: (latitude: number, longitude: number, rideId?: number) => void;
  onBookingAccepted: (callback: (data: BookingAcceptedEvent) => void) => () => void;
  onBookingRejected: (callback: (data: BookingRejectedEvent) => void) => () => void;
  onBookingStatusChanged: (callback: (data: BookingStatusChangedEvent) => void) => () => void;
  onRideStarted: (callback: (data: RideStartedEvent) => void) => () => void;
  onRideCompleted: (callback: (data: RideCompletedEvent) => void) => () => void;
  onRideStatusChanged: (callback: (data: RideStatusChangedEvent) => void) => () => void;
  onPassengerPickedUp: (callback: (data: PassengerPickedUpEvent) => void) => () => void;
  onRidePassengerPickedUp: (callback: (data: RidePassengerPickedUpEvent) => void) => () => void;
  onDriverLocation: (callback: (data: DriverLocationEvent) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextType>({
  isConnected: false,
  joinRide: () => {},
  leaveRide: () => {},
  sendLocationUpdate: () => {},
  onBookingAccepted: () => () => {},
  onBookingRejected: () => () => {},
  onBookingStatusChanged: () => () => {},
  onRideStarted: () => () => {},
  onRideCompleted: () => () => {},
  onRideStatusChanged: () => () => {},
  onPassengerPickedUp: () => () => {},
  onRidePassengerPickedUp: () => () => {},
  onDriverLocation: () => () => {},
});

export const useRealtime = () => useContext(RealtimeContext);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();

  // Initialize real-time service when user logs in
  useEffect(() => {
    if (!user?.id) {
      realtimeService.disconnect();
      return;
    }

    const driverId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
    realtimeService.initialize(driverId);

    return () => {
      realtimeService.disconnect();
    };
  }, [user?.id]);

  const joinRide = useCallback((rideId: number) => {
    realtimeService.joinRide(rideId);
  }, []);

  const leaveRide = useCallback((rideId: number) => {
    realtimeService.leaveRide(rideId);
  }, []);

  const sendLocationUpdate = useCallback((latitude: number, longitude: number, rideId?: number) => {
    realtimeService.sendLocationUpdate(latitude, longitude, rideId);
  }, []);

  // Helper to create subscription functions that return cleanup
  const createSubscription = <T,>(
    subscribeFn: (callback: (data: T) => void) => void,
    unsubscribeFn: (callback: (data: T) => void) => void
  ) => {
    return (callback: (data: T) => void) => {
      subscribeFn(callback);
      return () => unsubscribeFn(callback);
    };
  };

  const value: RealtimeContextType = {
    isConnected: realtimeService.isConnected(),
    joinRide,
    leaveRide,
    sendLocationUpdate,
    onBookingAccepted: createSubscription(
      realtimeService.onBookingAccepted.bind(realtimeService),
      realtimeService.offBookingAccepted.bind(realtimeService)
    ),
    onBookingRejected: createSubscription(
      realtimeService.onBookingRejected.bind(realtimeService),
      realtimeService.offBookingRejected.bind(realtimeService)
    ),
    onBookingStatusChanged: createSubscription(
      realtimeService.onBookingStatusChanged.bind(realtimeService),
      realtimeService.offBookingStatusChanged.bind(realtimeService)
    ),
    onRideStarted: createSubscription(
      realtimeService.onRideStarted.bind(realtimeService),
      realtimeService.offRideStarted.bind(realtimeService)
    ),
    onRideCompleted: createSubscription(
      realtimeService.onRideCompleted.bind(realtimeService),
      realtimeService.offRideCompleted.bind(realtimeService)
    ),
    onRideStatusChanged: createSubscription(
      realtimeService.onRideStatusChanged.bind(realtimeService),
      realtimeService.offRideStatusChanged.bind(realtimeService)
    ),
    onPassengerPickedUp: createSubscription(
      realtimeService.onPassengerPickedUp.bind(realtimeService),
      realtimeService.offPassengerPickedUp.bind(realtimeService)
    ),
    onRidePassengerPickedUp: createSubscription(
      realtimeService.onRidePassengerPickedUp.bind(realtimeService),
      realtimeService.offRidePassengerPickedUp.bind(realtimeService)
    ),
    onDriverLocation: createSubscription(
      realtimeService.onDriverLocation.bind(realtimeService),
      realtimeService.offDriverLocation.bind(realtimeService)
    ),
  };

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

