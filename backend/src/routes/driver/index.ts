import express from "express";
import authRoutes from "./auth";
import ridesRoutes from "./rides";
import notificationsRoutes from "./notifications";
import bookingsRoutes from "./bookings";
import profileRoutes from "./profile";
import vehicleRoutes from "./vehicle";
import locationRoutes from "./location";
import messagesRoutes from "./messages";
import ratingsRoutes from "./ratings";
import pushTokenRoutes from "./pushToken";
import earningsRoutes from "./earnings";
import payoutsRoutes from "./payouts";
import payoutsWebhookRoutes from "./payouts-webhook";
import connectRoutes from "./connect";
import driverConnectRoutes from "../driverConnect.routes";

const router = express.Router();

// Driver app routes
router.use("/auth", authRoutes);
router.use("/rides", ridesRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/bookings", bookingsRoutes);
router.use("/profile", profileRoutes);
router.use("/vehicle", vehicleRoutes);
router.use("/location", locationRoutes);
router.use("/messages", messagesRoutes);
router.use("/ratings", ratingsRoutes);
router.use("/push-token", pushTokenRoutes);
router.use("/earnings", earningsRoutes);
router.use("/payouts", payoutsRoutes);
router.use("/payouts", payoutsWebhookRoutes);
router.use("/connect", connectRoutes);
router.use("/connect", driverConnectRoutes);

export default router;
