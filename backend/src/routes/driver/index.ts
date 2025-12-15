import express from 'express';
import authRoutes from './auth';
import ridesRoutes from './rides';
import notificationsRoutes from './notifications';
import bookingsRoutes from './bookings';

const router = express.Router();

// Driver app routes
router.use('/auth', authRoutes);
router.use('/rides', ridesRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/bookings', bookingsRoutes);

export default router;

