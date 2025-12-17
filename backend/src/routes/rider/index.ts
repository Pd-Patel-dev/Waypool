import express from 'express';
import riderAuthRoutes from './auth';
import riderRidesRoutes from './rides';
import riderBookingsRoutes from './bookings';
import trackingRoutes from './tracking';

const router = express.Router();

// Rider app routes
router.use('/auth', riderAuthRoutes);
router.use('/rides', riderRidesRoutes);
router.use('/bookings', riderBookingsRoutes);
router.use('/tracking', trackingRoutes);

export default router;

