import express from 'express';
import authRoutes from './auth';
import ridesRoutes from './rides';

const router = express.Router();

// Driver app routes
router.use('/auth', authRoutes);
router.use('/rides', ridesRoutes);

export default router;

