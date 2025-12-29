import io, { Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/config/api';
import { getValidAccessToken } from '@/utils/tokenRefresh';

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventHandlers: Map<string, Set<(...args: any[]) => void>> = new Map();

  async connect(driverId: number) {
    if (this.socket?.connected) {
      return;
    }

    // Clean up existing socket if any
    if (this.socket) {
      this.disconnect();
    }

    // Get valid JWT access token for authentication (refreshes if expired)
    const token = await getValidAccessToken();
    
    if (!token) {
      console.error('❌ Cannot connect WebSocket: No valid access token found. Please log in first.');
      return;
    }

    this.socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
      auth: {
        token: token, // JWT token for authentication
      },
      // Keep query params for backward compatibility in test mode
      query: {
        driverId: driverId.toString(),
        role: 'driver',
      },
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', () => {
      // WebSocket disconnected
    });

    this.socket.on('error', () => {
      // WebSocket error occurred
    });

    this.socket.on('reconnect_attempt', () => {
      this.reconnectAttempts++;
    });

    this.socket.on('reconnect_failed', () => {
      // Failed to reconnect
      this.reconnectAttempts = 0; // Reset for next connection attempt
    });
  }

  disconnect() {
    if (this.socket) {
      // Remove all event listeners to prevent memory leaks
      this.eventHandlers.forEach((handlers, event) => {
        handlers.forEach((handler) => {
          this.socket?.off(event, handler);
        });
      });
      this.eventHandlers.clear();

      // Disconnect socket
      this.socket.disconnect();
      this.socket = null;
      this.reconnectAttempts = 0;
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      // Track handlers for cleanup
      if (!this.eventHandlers.has(event)) {
        this.eventHandlers.set(event, new Set());
      }
      this.eventHandlers.get(event)?.add(callback);

      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
        // Remove from tracked handlers
        this.eventHandlers.get(event)?.delete(callback);
        if (this.eventHandlers.get(event)?.size === 0) {
          this.eventHandlers.delete(event);
        }
      } else {
        // Remove all handlers for this event
        this.socket.off(event);
        this.eventHandlers.delete(event);
      }
    }
  }

  emit(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const websocketService = new WebSocketService();

