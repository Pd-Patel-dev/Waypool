import express from 'express';
import riderAuthRoutes from './auth';
import riderRidesRoutes from './rides';
import riderBookingsRoutes from './bookings';
import trackingRoutes from './tracking';
import paymentRoutes from './payment';
import profileRoutes from './profile';
import savedAddressesRoutes from './savedAddresses';
import notificationsRoutes from './notifications';
import emailVerificationRoutes from './emailVerification';

const router = express.Router();

// Rider app routes
router.use('/auth', riderAuthRoutes);
router.use('/email-verification', emailVerificationRoutes);
router.use('/rides', riderRidesRoutes);
router.use('/bookings', riderBookingsRoutes);
router.use('/tracking', trackingRoutes);
router.use('/payment', paymentRoutes);
router.use('/profile', profileRoutes);
router.use('/saved-addresses', savedAddressesRoutes);
router.use('/notifications', notificationsRoutes);

export default router;

