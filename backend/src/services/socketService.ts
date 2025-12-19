import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';

interface SocketUser {
  userId: number;
  role: 'driver' | 'rider';
  socketId: string;
  testMode?: boolean;
}

class SocketService {
  private io: SocketIOServer | null = null;
  private connectedUsers: Map<number, Set<string>> = new Map(); // userId -> Set of socketIds
  private socketToUser: Map<string, SocketUser> = new Map(); // socketId -> user info

  initialize(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: true, // Allow all origins in development
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupMiddleware();
    this.setupEventHandlers();

  }

  private setupMiddleware() {
    if (!this.io) return;

    // Authentication middleware (with test mode support)
    this.io.use((socket: Socket, next) => {
      const { isTestModeEnabled, logTestModeUsage } = require('../utils/testMode');
      
      const driverId = socket.handshake.query.driverId;
      const riderId = socket.handshake.query.riderId;
      const role = socket.handshake.query.role;

      // Validate connection
      if (!role || (role !== 'driver' && role !== 'rider')) {
        return next(new Error('Invalid role'));
      }

      const userId = role === 'driver' 
        ? (driverId ? parseInt(driverId as string) : null)
        : (riderId ? parseInt(riderId as string) : null);

      if (!userId || isNaN(userId)) {
        return next(new Error('User ID is required'));
      }

      // In test mode, bypass authentication but still use the actual user ID
      if (isTestModeEnabled()) {
        logTestModeUsage('Socket connection (test mode)', { 
          role, 
          userId,
          socketId: socket.id 
        });
      }

      // Store user info in Map (type-safe, no assertions needed)
      this.socketToUser.set(socket.id, {
        userId,
        role: role as 'driver' | 'rider',
        socketId: socket.id,
        testMode: isTestModeEnabled(),
      });

      next();
    });
  }

  private setupEventHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      // Get user info from Map (type-safe, no assertions needed)
      const userInfo = this.socketToUser.get(socket.id);
      
      if (!userInfo) {
        console.error(`❌ No user info found for socket ${socket.id}. Connection rejected.`);
        socket.disconnect();
        return;
      }
      
      const { userId, role } = userInfo;

      // Track connected user
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(socket.id);

      // Join user-specific room
      socket.join(`user:${userId}`);
      if (role === 'driver') {
        socket.join(`driver:${userId}`);
      } else {
        socket.join(`rider:${userId}`);
      }

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        const disconnectedUserInfo = this.socketToUser.get(socket.id);
        if (disconnectedUserInfo) {
          const { userId: disconnectedUserId, role: disconnectedRole } = disconnectedUserInfo;
          
          // Remove from tracking
          const userSockets = this.connectedUsers.get(disconnectedUserId);
          if (userSockets) {
            userSockets.delete(socket.id);
            if (userSockets.size === 0) {
              this.connectedUsers.delete(disconnectedUserId);
            }
          }
        }
        this.socketToUser.delete(socket.id);
      });

      // Handle location updates (for real-time tracking)
      socket.on('location:update', (data: { latitude: number; longitude: number; rideId?: number }) => {
        const locationUserInfo = this.socketToUser.get(socket.id);
        if (locationUserInfo && locationUserInfo.role === 'driver' && data.rideId) {
          // Broadcast driver location to passengers in the ride
          socket.to(`ride:${data.rideId}`).emit('location:driver', {
            driverId: locationUserInfo.userId,
            latitude: data.latitude,
            longitude: data.longitude,
            timestamp: Date.now(),
          });
        }
      });

      // Handle join ride room (for real-time ride updates)
      socket.on('ride:join', (rideId: number) => {
        const joinUserInfo = this.socketToUser.get(socket.id);
        if (joinUserInfo) {
          socket.join(`ride:${rideId}`);
        }
      });

      // Handle leave ride room
      socket.on('ride:leave', (rideId: number) => {
        const leaveUserInfo = this.socketToUser.get(socket.id);
        if (leaveUserInfo) {
          socket.leave(`ride:${rideId}`);
        }
      });
    });
  }

  // Emit event to specific driver
  emitToDriver(driverId: number, event: string, data: any) {
    if (!this.io) return;
    this.io.to(`driver:${driverId}`).emit(event, data);
  }

  // Emit event to specific rider
  emitToRider(riderId: number, event: string, data: any) {
    if (!this.io) return;
    this.io.to(`rider:${riderId}`).emit(event, data);
  }

  // Emit event to all users in a ride
  emitToRide(rideId: number, event: string, data: any) {
    if (!this.io) return;
    this.io.to(`ride:${rideId}`).emit(event, data);
  }

  // Emit event to specific user (driver or rider)
  emitToUser(userId: number, event: string, data: any) {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit(event, data);
  }

  // Check if user is connected
  isUserConnected(userId: number): boolean {
    return this.connectedUsers.has(userId) && this.connectedUsers.get(userId)!.size > 0;
  }

  // Get all connected users
  getConnectedUsers(): number[] {
    return Array.from(this.connectedUsers.keys());
  }
}

export const socketService = new SocketService();

