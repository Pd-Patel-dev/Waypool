import express from 'express';
import authRoutes from './auth';

const router = express.Router();

// Driver app routes
router.use('/auth', authRoutes);

export default router;

