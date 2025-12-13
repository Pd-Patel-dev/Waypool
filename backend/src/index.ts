import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import { getDatabaseStatus, disconnectDatabase } from "./utils/database";
import driverRoutes from "./routes/driver";
import riderRoutes from "./routes/rider";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

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
app.use(express.json());

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
app.listen(PORT, "0.0.0.0", () => {
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
  console.log(`💻 Accessible from browser at: http://localhost:${PORT}`);
  console.log(`🌐 Accessible from local network at: http://${localIP}:${PORT}`);
  console.log(
    `📱 Accessible from Android emulator at: http://10.0.2.2:${PORT}`
  );
  console.log(`\n⚠️  Make sure your Mac firewall allows connections on port ${PORT}`);
  console.log(`   Test from iPhone Safari: http://${localIP}:${PORT}/health\n`);
});
