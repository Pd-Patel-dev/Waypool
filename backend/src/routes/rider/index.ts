import express from 'express';
import riderAuthRoutes from './auth';
import riderRidesRoutes from './rides';
import riderBookingsRoutes from './bookings';

const router = express.Router();

// Rider app routes
router.use('/auth', riderAuthRoutes);
router.use('/rides', riderRidesRoutes);
router.use('/bookings', riderBookingsRoutes);

export default router;

