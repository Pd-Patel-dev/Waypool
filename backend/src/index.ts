import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import { createServer } from "http";
import {
  getDatabaseStatus,
  disconnectDatabase,
  checkMigrationStatus,
} from "./utils/database";
import { validateAndLogEnvironment } from "./utils/envValidation";
import { checkAllServices } from "./utils/serviceStatus";
import driverRoutes from "./routes/driver";
import riderRoutes from "./routes/rider";
import stripeWebhookRoutes from "./routes/stripeWebhook.routes";
import { socketService } from "./services/socketService";
import { testModeMiddleware } from "./middleware/testModeAuth";
import { isTestModeEnabled } from "./utils/testMode";
import { initializeWeeklyPayoutScheduler } from "./services/weeklyPayoutService";
import { apiRateLimiter } from "./middleware/rateLimiter";
import { requestLogger } from "./middleware/requestLogger";

// Validate environment variables at startup (before initializing services)
validateAndLogEnvironment();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Initialize Socket.IO
socketService.initialize(httpServer);

// Track server start time for uptime calculation
const serverStartTime = Date.now();

// Middleware - Enhanced CORS for React Native
// In production, restrict to specific origins for security
const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = isProduction
  ? process.env.ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()) || []
  : true; // Allow all origins in development

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "X-Requested-With",
    ],
    exposedHeaders: ["Content-Length", "Content-Type"],
  })
);

if (isProduction && allowedOrigins === true) {
  console.warn(
    "⚠️  WARNING: CORS is allowing all origins in production! Set ALLOWED_ORIGINS environment variable."
  );
}

// IMPORTANT: Stripe webhook must be mounted BEFORE express.json()
// to receive raw body for signature verification
app.use("/api/webhooks", stripeWebhookRoutes);

app.use(express.json());

// Request logging middleware (after body parsing)
app.use(requestLogger);

// Apply general API rate limiting to all routes (except webhooks)
// Note: Specific endpoints (auth, email) have stricter rate limits applied directly
// Webhooks are excluded as they need to handle Stripe's rate requirements
app.use((req, res, next) => {
  // Skip rate limiting for webhook routes
  if (req.path.startsWith("/api/webhooks")) {
    return next();
  }
  // Apply general rate limiting to all other API routes
  if (req.path.startsWith("/api")) {
    return apiRateLimiter(req, res, next);
  }
  next();
});

// Test Mode Middleware (only active in development when enabled)
if (isTestModeEnabled()) {
  console.log("🧪 TEST MODE ENABLED - Security checks will be bypassed");
  console.log("⚠️  WARNING: This should NEVER be enabled in production!");
  app.use(testModeMiddleware);
}

// Routes
app.use("/api/driver", driverRoutes);
app.use("/api/rider", riderRoutes);

// Welcome route
app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Welcome to Waypool Server" });
});

// Health check route - Enhanced with service status checks
app.get("/health", async (req: Request, res: Response) => {
  try {
    const uptime = Math.floor((Date.now() - serverStartTime) / 1000); // uptime in seconds
    const dbStatus = await getDatabaseStatus();
    const migrationStatus = await checkMigrationStatus();
    const services = await checkAllServices();

    // Determine overall health status
    const hasCriticalFailure = !dbStatus.connected;
    const hasDegradedService = services.some((s) => s.status === "degraded");
    const hasDownService = services.some((s) => s.status === "down");

    let healthStatus: "ok" | "degraded" | "down" = "ok";
    if (hasCriticalFailure || hasDownService) {
      healthStatus = "down";
    } else if (hasDegradedService || !migrationStatus.isUpToDate) {
      healthStatus = "degraded";
    }

    const statusCode =
      healthStatus === "down" ? 503 : healthStatus === "degraded" ? 200 : 200;

    res.status(statusCode).json({
      status: healthStatus,
      message:
        healthStatus === "ok"
          ? "All systems operational"
          : healthStatus === "degraded"
          ? "Some services are degraded"
          : "Service unavailable",
      uptime: uptime,
      timestamp: new Date().toISOString(),
      service: "Waypool Server",
      version: process.env.APP_VERSION || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      database: {
        connected: dbStatus.connected,
        migrations: {
          upToDate: migrationStatus.isUpToDate,
          ...(migrationStatus.pendingMigrations && {
            pending: migrationStatus.pendingMigrations.length,
          }),
        },
        ...(dbStatus.error && { error: dbStatus.error }),
      },
      services: services.reduce((acc, service) => {
        acc[service.name.toLowerCase().replace(/\s+/g, "_")] = {
          status: service.status,
          message: service.message,
          ...(service.details && { details: service.details }),
        };
        return acc;
      }, {} as Record<string, any>),
    });
  } catch (error) {
    console.error("❌ Error in health check:", error);
    res.status(503).json({
      status: "down",
      message: "Health check failed",
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    });
  }
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await disconnectDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await disconnectDatabase();
  process.exit(0);
});

// Start server - Listen on ALL interfaces (0.0.0.0) not just localhost
httpServer.listen(PORT, "0.0.0.0", async () => {
  const os = require("os");
  const networkInterfaces = os.networkInterfaces();
  let localIP = "localhost";

  // Find local IP address
  for (const interfaceName in networkInterfaces) {
    const addresses = networkInterfaces[interfaceName];
    for (const addr of addresses) {
      if (addr.family === "IPv4" && !addr.internal) {
        localIP = addr.address;
        break;
      }
    }
    if (localIP !== "localhost") break;
  }

  console.log(`🚀 Waypool Server is running on http://0.0.0.0:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);

  // Initialize weekly payout scheduler
  initializeWeeklyPayoutScheduler();

  // Check database migration status
  try {
    const { checkMigrationStatus } = await import("./utils/database");
    const migrationStatus = await checkMigrationStatus();

    if (!migrationStatus.isUpToDate) {
      console.warn("⚠️  Database Migration Warning:");
      if (
        migrationStatus.pendingMigrations &&
        migrationStatus.pendingMigrations.length > 0
      ) {
        console.warn("   Pending migrations detected:");
        migrationStatus.pendingMigrations.forEach((migration) => {
          console.warn(`   - ${migration}`);
        });
        console.warn("   Run: npm run prisma:migrate");
      }
      if (migrationStatus.error) {
        console.warn(`   Error: ${migrationStatus.error}`);
      }
      console.warn("");
    } else {
      console.log("✅ Database migrations are up to date\n");
    }
  } catch (error) {
    console.warn("⚠️  Could not check migration status:", error);
    console.warn("");
  }
});
