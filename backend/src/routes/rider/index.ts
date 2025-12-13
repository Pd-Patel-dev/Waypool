import express from 'express';
import riderAuthRoutes from './auth';
import riderRidesRoutes from './rides';

const router = express.Router();

// Rider app routes
router.use('/auth', riderAuthRoutes);
router.use('/rides', riderRidesRoutes);

export default router;

