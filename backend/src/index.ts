import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { getDatabaseStatus, disconnectDatabase } from './utils/database';
import driverRoutes from './routes/driver';
import riderRoutes from './routes/rider';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Track server start time for uptime calculation
const serverStartTime = Date.now();

// Middleware
app.use(cors()); // Enable CORS for React Native app
app.use(express.json());

// Routes
app.use('/api/driver', driverRoutes);
app.use('/api/rider', riderRoutes);

// Welcome route
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Welcome to Waypool Server' });
});

// Health check route
app.get('/health', async (req: Request, res: Response) => {
  const uptime = Math.floor((Date.now() - serverStartTime) / 1000); // uptime in seconds
  const dbStatus = await getDatabaseStatus();
  
  const healthStatus = dbStatus.connected ? 'ok' : 'degraded';
  
  res.status(dbStatus.connected ? 200 : 503).json({
    status: healthStatus,
    message: 'Server is running',
    uptime: uptime,
    timestamp: new Date().toISOString(),
    service: 'Waypool Server',
    version: '1.0.0',
    database: {
      connected: dbStatus.connected,
      ...(dbStatus.error && { error: dbStatus.error }),
    },
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await disconnectDatabase();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Waypool Server is running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});
