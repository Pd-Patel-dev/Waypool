import express from 'express';
import riderAuthRoutes from './auth';

const router = express.Router();

// Rider app routes
router.use('/auth', riderAuthRoutes);

export default router;

