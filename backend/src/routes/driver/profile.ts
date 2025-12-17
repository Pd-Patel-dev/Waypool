import express, { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import bcrypt from 'bcrypt';

const router = express.Router();

/**
 * GET /api/driver/profile
 * Get driver profile information
 * Query params: driverId (required)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const driverId = req.query.driverId ? parseInt(req.query.driverId as string) : null;

    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
    }

    const user = await prisma.users.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        photoUrl: true,
        city: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('❌ Error fetching profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/driver/profile
 * Update driver profile information
 * Query params: driverId (required)
 * Body: fullName, email, phoneNumber, photoUrl, city (all optional)
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const driverId = req.query.driverId ? parseInt(req.query.driverId as string) : null;

    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
    }

    // Check if user exists
    const existingUser = await prisma.users.findUnique({
      where: { id: driverId },
    });

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const { fullName, email, phoneNumber, photoUrl, city } = req.body;

    // Validation
    const errors: string[] = [];

    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.push('Invalid email format');
      } else {
        // Check if email is already taken by another user
        const emailUser = await prisma.users.findUnique({
          where: { email: email.trim().toLowerCase() },
        });
        if (emailUser && emailUser.id !== driverId) {
          errors.push('Email is already taken by another user');
        }
      }
    }

    if (phoneNumber && phoneNumber.trim()) {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(phoneNumber.trim()) || phoneNumber.trim().length < 10) {
        errors.push('Invalid phone number format');
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    // Build update data
    const updateData: any = {};
    if (fullName && fullName.trim()) {
      updateData.fullName = fullName.trim();
    }
    if (email && email.trim()) {
      updateData.email = email.trim().toLowerCase();
    }
    if (phoneNumber && phoneNumber.trim()) {
      updateData.phoneNumber = phoneNumber.trim();
    }
    if (photoUrl !== undefined) {
      updateData.photoUrl = photoUrl && photoUrl.trim() ? photoUrl.trim() : null;
    }
    if (city !== undefined) {
      updateData.city = city && city.trim() ? city.trim() : null;
    }

    // Update user
    const updatedUser = await prisma.users.update({
      where: { id: driverId },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        photoUrl: true,
        city: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log(`✅ Profile updated for driver ${driverId}`);

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('❌ Error updating profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/driver/profile/password
 * Update driver password
 * Query params: driverId (required)
 * Body: currentPassword, newPassword (both required)
 */
router.put('/password', async (req: Request, res: Response) => {
  try {
    const driverId = req.query.driverId ? parseInt(req.query.driverId as string) : null;

    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters',
      });
    }

    // Get user with password
    const user = await prisma.users.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        password: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await prisma.users.update({
      where: { id: driverId },
      data: {
        password: hashedPassword,
      },
    });

    console.log(`✅ Password updated for driver ${driverId}`);

    return res.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('❌ Error updating password:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update password',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

