import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import { createServer } from "http";
import { getDatabaseStatus, disconnectDatabase } from "./utils/database";
import { validateAndLogEnvironment } from "./utils/envValidation";
import driverRoutes from "./routes/driver";
import riderRoutes from "./routes/rider";
import stripeWebhookRoutes from "./routes/stripeWebhook.routes";
import { socketService } from "./services/socketService";
import { testModeMiddleware } from "./middleware/testModeAuth";
import { isTestModeEnabled } from "./utils/testMode";

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
app.use(
  cors({
    origin: true, // Allow all origins in development
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// IMPORTANT: Stripe webhook must be mounted BEFORE express.json()
// to receive raw body for signature verification
app.use("/api/webhooks", stripeWebhookRoutes);

app.use(express.json());

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

// Health check route
app.get("/health", async (req: Request, res: Response) => {
  const uptime = Math.floor((Date.now() - serverStartTime) / 1000); // uptime in seconds
  const dbStatus = await getDatabaseStatus();

  const healthStatus = dbStatus.connected ? "ok" : "degraded";

  res.status(dbStatus.connected ? 200 : 503).json({
    status: healthStatus,
    message: "Server is running",
    uptime: uptime,
    timestamp: new Date().toISOString(),
    service: "Waypool Server",
    version: "1.0.0",
    database: {
      connected: dbStatus.connected,
      ...(dbStatus.error && { error: dbStatus.error }),
    },
  });
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
