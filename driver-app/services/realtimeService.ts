import { websocketService } from './websocket';

export interface BookingAcceptedEvent {
  bookingId: number;
  rideId: number;
  driverName: string;
  pickupPIN: string;
  message: string;
}

export interface BookingRejectedEvent {
  bookingId: number;
  rideId: number;
  driverName: string;
  message: string;
}

export interface BookingStatusChangedEvent {
  bookingId: number;
  rideId: number;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';
  availableSeats?: number;
}

export interface RideStartedEvent {
  rideId: number;
  driverName: string;
  fromAddress: string;
  toAddress: string;
  message: string;
}

export interface RideCompletedEvent {
  rideId: number;
  fromAddress: string;
  toAddress: string;
  totalEarnings: number;
  message: string;
}

export interface RideStatusChangedEvent {
  rideId: number;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  startedAt?: string;
  completedAt?: string;
  totalEarnings?: number;
}

export interface PassengerPickedUpEvent {
  bookingId: number;
  rideId: number;
  message: string;
}

export interface RidePassengerPickedUpEvent {
  bookingId: number;
  passengerName: string;
  pickedUpAt: string;
}

export interface DriverLocationEvent {
  driverId: number;
  latitude: number;
  longitude: number;
  timestamp: number;
}

type EventCallback<T> = (data: T) => void;

class RealtimeService {
  private callbacks: Map<string, Set<EventCallback<any>>> = new Map();

  /**
   * Initialize real-time service for a driver
   */
  initialize(driverId: number) {
    websocketService.connect(driverId);

    // Set up all event listeners
    this.setupEventListeners();
  }

  /**
   * Disconnect from real-time service
   */
  disconnect() {
    // Remove all listeners
    this.callbacks.forEach((_, event) => {
      websocketService.off(event);
    });
    this.callbacks.clear();

    websocketService.disconnect();
  }

  /**
   * Join a ride room for real-time updates
   */
  joinRide(rideId: number) {
    if (websocketService.isConnected()) {
      websocketService.emit('ride:join', rideId);
    }
  }

  /**
   * Leave a ride room
   */
  leaveRide(rideId: number) {
    if (websocketService.isConnected()) {
      websocketService.emit('ride:leave', rideId);
    }
  }

  /**
   * Send driver location update
   */
  sendLocationUpdate(latitude: number, longitude: number, rideId?: number) {
    if (websocketService.isConnected()) {
      websocketService.emit('location:update', {
        latitude,
        longitude,
        rideId,
      });
    }
  }

  /**
   * Subscribe to booking accepted events
   */
  onBookingAccepted(callback: EventCallback<BookingAcceptedEvent>) {
    this.subscribe('booking:accepted', callback);
  }

  /**
   * Unsubscribe from booking accepted events
   */
  offBookingAccepted(callback: EventCallback<BookingAcceptedEvent>) {
    this.unsubscribe('booking:accepted', callback);
  }

  /**
   * Subscribe to booking rejected events
   */
  onBookingRejected(callback: EventCallback<BookingRejectedEvent>) {
    this.subscribe('booking:rejected', callback);
  }

  /**
   * Unsubscribe from booking rejected events
   */
  offBookingRejected(callback: EventCallback<BookingRejectedEvent>) {
    this.unsubscribe('booking:rejected', callback);
  }

  /**
   * Subscribe to booking status changed events
   */
  onBookingStatusChanged(callback: EventCallback<BookingStatusChangedEvent>) {
    this.subscribe('booking:status_changed', callback);
  }

  /**
   * Unsubscribe from booking status changed events
   */
  offBookingStatusChanged(callback: EventCallback<BookingStatusChangedEvent>) {
    this.unsubscribe('booking:status_changed', callback);
  }

  /**
   * Subscribe to ride started events
   */
  onRideStarted(callback: EventCallback<RideStartedEvent>) {
    this.subscribe('ride:started', callback);
  }

  /**
   * Unsubscribe from ride started events
   */
  offRideStarted(callback: EventCallback<RideStartedEvent>) {
    this.unsubscribe('ride:started', callback);
  }

  /**
   * Subscribe to ride completed events
   */
  onRideCompleted(callback: EventCallback<RideCompletedEvent>) {
    this.subscribe('ride:completed', callback);
  }

  /**
   * Unsubscribe from ride completed events
   */
  offRideCompleted(callback: EventCallback<RideCompletedEvent>) {
    this.unsubscribe('ride:completed', callback);
  }

  /**
   * Subscribe to ride status changed events
   */
  onRideStatusChanged(callback: EventCallback<RideStatusChangedEvent>) {
    this.subscribe('ride:status_changed', callback);
  }

  /**
   * Unsubscribe from ride status changed events
   */
  offRideStatusChanged(callback: EventCallback<RideStatusChangedEvent>) {
    this.unsubscribe('ride:status_changed', callback);
  }

  /**
   * Subscribe to passenger picked up events
   */
  onPassengerPickedUp(callback: EventCallback<PassengerPickedUpEvent>) {
    this.subscribe('passenger:picked_up', callback);
  }

  /**
   * Unsubscribe from passenger picked up events
   */
  offPassengerPickedUp(callback: EventCallback<PassengerPickedUpEvent>) {
    this.unsubscribe('passenger:picked_up', callback);
  }

  /**
   * Subscribe to ride passenger picked up events (broadcast to all in ride)
   */
  onRidePassengerPickedUp(callback: EventCallback<RidePassengerPickedUpEvent>) {
    this.subscribe('ride:passenger_picked_up', callback);
  }

  /**
   * Unsubscribe from ride passenger picked up events
   */
  offRidePassengerPickedUp(callback: EventCallback<RidePassengerPickedUpEvent>) {
    this.unsubscribe('ride:passenger_picked_up', callback);
  }

  /**
   * Subscribe to driver location updates
   */
  onDriverLocation(callback: EventCallback<DriverLocationEvent>) {
    this.subscribe('location:driver', callback);
  }

  /**
   * Unsubscribe from driver location updates
   */
  offDriverLocation(callback: EventCallback<DriverLocationEvent>) {
    this.unsubscribe('location:driver', callback);
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return websocketService.isConnected();
  }

  // Private helper methods
  private subscribe<T>(event: string, callback: EventCallback<T>) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, new Set());
    }
    this.callbacks.get(event)!.add(callback);

    // Set up WebSocket listener if this is the first callback for this event
    if (this.callbacks.get(event)!.size === 1) {
      websocketService.on(event, (data: T) => {
        this.callbacks.get(event)?.forEach((cb) => {
          try {
            cb(data);
          } catch {
            // Silently handle errors in callbacks
          }
        });
      });
    }
  }

  private unsubscribe<T>(event: string, callback: EventCallback<T>) {
    const callbacks = this.callbacks.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.callbacks.delete(event);
        websocketService.off(event);
      }
    }
  }

  private setupEventListeners() {
    // Handle connection events - these are internal handlers for the service
    // Individual components should not need to listen to these directly
    // Connection state is managed through isConnected() method
  }
}

export const realtimeService = new RealtimeService();

