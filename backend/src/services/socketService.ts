import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { verifyToken, JWTPayload } from '../utils/jwt';

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
    // In production, restrict to specific origins for security
    const isProduction = process.env.NODE_ENV === 'production';
    const allowedOrigins = isProduction
      ? (process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [])
      : true; // Allow all origins in development

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    if (isProduction && allowedOrigins === true) {
      console.warn('⚠️  WARNING: Socket.IO CORS is allowing all origins in production! Set ALLOWED_ORIGINS environment variable.');
    }

    this.setupMiddleware();
    this.setupEventHandlers();

  }

  private setupMiddleware() {
    if (!this.io) return;

    // JWT-based authentication middleware (with test mode support)
    this.io.use((socket: Socket, next) => {
      const { isTestModeEnabled, logTestModeUsage } = require('../utils/testMode');
      
      // In test mode, allow query param authentication for backward compatibility
      if (isTestModeEnabled()) {
        const driverId = socket.handshake.query.driverId;
        const riderId = socket.handshake.query.riderId;
        const role = socket.handshake.query.role;

        if (role && (role === 'driver' || role === 'rider')) {
          const userId = role === 'driver' 
            ? (driverId ? parseInt(driverId as string) : null)
            : (riderId ? parseInt(riderId as string) : null);

          if (userId && !isNaN(userId)) {
            logTestModeUsage('Socket connection (test mode - query params)', { 
              role, 
              userId,
              socketId: socket.id 
            });
            
            this.socketToUser.set(socket.id, {
              userId,
              role: role as 'driver' | 'rider',
              socketId: socket.id,
              testMode: true,
            });
            
            return next();
          }
        }
      }

      // JWT-based authentication (production and normal development)
      // Token can be in auth.token (handshake.auth) or query.token
      const token = 
        (socket.handshake.auth?.token as string) || 
        (socket.handshake.query?.token as string) ||
        (socket.handshake.headers?.authorization?.replace('Bearer ', ''));

      if (!token) {
        console.error(`❌ WebSocket authentication failed for socket ${socket.id}: No token provided`, {
          hasAuthToken: !!socket.handshake.auth?.token,
          hasQueryToken: !!socket.handshake.query?.token,
          hasAuthHeader: !!socket.handshake.headers?.authorization,
          authKeys: Object.keys(socket.handshake.auth || {}),
          queryKeys: Object.keys(socket.handshake.query || {}),
        });
        return next(new Error('Authentication token is required. Provide token in handshake.auth.token, query.token, or Authorization header.'));
      }

      // Log token presence (without logging the actual token for security)
      console.log(`🔐 WebSocket authentication attempt for socket ${socket.id}:`, {
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 20) + '...',
        hasAuthToken: !!socket.handshake.auth?.token,
        hasQueryToken: !!socket.handshake.query?.token,
        hasAuthHeader: !!socket.handshake.headers?.authorization,
      });

      try {
        // Verify JWT token
        const payload: JWTPayload = verifyToken(token);
        
        // Verify role matches (driver or rider)
        if (payload.role !== 'driver' && payload.role !== 'rider') {
          console.error(`❌ WebSocket authentication failed for socket ${socket.id}: Invalid role in token`, {
            role: payload.role,
            userId: payload.userId,
          });
          return next(new Error('Invalid user role in token'));
        }

        // Store user info from JWT token
        this.socketToUser.set(socket.id, {
          userId: payload.userId,
          role: payload.role,
          socketId: socket.id,
          testMode: false,
        });

        console.log(`✅ WebSocket authentication successful for socket ${socket.id}:`, {
          userId: payload.userId,
          role: payload.role,
          email: payload.email,
        });

        next();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Token verification failed';
        const errorDetails: any = {
          error: errorMessage,
          tokenLength: token.length,
          tokenPrefix: token.substring(0, 20) + '...',
        };
        
        // Add more details for specific error types
        if (error instanceof Error) {
          if (error.message.includes('expired')) {
            errorDetails.errorType = 'Token expired';
          } else if (error.message.includes('invalid')) {
            errorDetails.errorType = 'Invalid token format';
          } else if (error.message.includes('secret')) {
            errorDetails.errorType = 'JWT secret mismatch';
          }
        }
        
        console.error(`❌ WebSocket authentication failed for socket ${socket.id}:`, errorDetails);
        return next(new Error(`Authentication failed: ${errorMessage}`));
      }
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

