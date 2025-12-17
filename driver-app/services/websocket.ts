import io, { Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/config/api';

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(driverId: number) {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
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
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
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

