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

/**
 * PUT /api/driver/profile/photo
 * Update driver profile photo
 * Query params: driverId (required)
 * Body: photoUrl (required - base64 data URL or external URL)
 */
router.put('/photo', async (req: Request, res: Response) => {
  try {
    const driverId = req.query.driverId ? parseInt(req.query.driverId as string) : null;

    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
    }

    const { photoUrl } = req.body;

    if (!photoUrl || !photoUrl.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Photo URL is required',
      });
    }

    // Validate URL format (can be http(s):// or data:image)
    const isValidUrl = photoUrl.startsWith('http://') || 
                       photoUrl.startsWith('https://') || 
                       photoUrl.startsWith('data:image/');

    if (!isValidUrl) {
      return res.status(400).json({
        success: false,
        message: 'Invalid photo URL format. Must be a valid URL or base64 data URL',
      });
    }

    // Check if user exists
    const user = await prisma.users.findUnique({
      where: { id: driverId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update photo
    const updatedUser = await prisma.users.update({
      where: { id: driverId },
      data: {
        photoUrl: photoUrl.trim(),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        photoUrl: true,
        city: true,
      },
    });

    console.log(`✅ Profile photo updated for driver ${driverId}`);

    return res.json({
      success: true,
      message: 'Profile photo updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('❌ Error updating profile photo:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update profile photo',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/driver/profile/preferences
 * Get notification and privacy preferences
 * Query params: driverId (required)
 */
router.get('/preferences', async (req: Request, res: Response) => {
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
        notifyBookings: true,
        notifyMessages: true,
        notifyRideUpdates: true,
        notifyPromotions: true,
        shareLocationEnabled: true,
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
      preferences: {
        notifyBookings: user.notifyBookings ?? true,
        notifyMessages: user.notifyMessages ?? true,
        notifyRideUpdates: user.notifyRideUpdates ?? true,
        notifyPromotions: user.notifyPromotions ?? true,
        shareLocationEnabled: user.shareLocationEnabled ?? true,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching preferences:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch preferences',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/driver/profile/preferences
 * Update notification and privacy preferences
 * Query params: driverId (required)
 * Body: notifyBookings, notifyMessages, notifyRideUpdates, notifyPromotions, shareLocationEnabled (all optional booleans)
 */
router.put('/preferences', async (req: Request, res: Response) => {
  try {
    const driverId = req.query.driverId ? parseInt(req.query.driverId as string) : null;

    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
    }

    const { 
      notifyBookings, 
      notifyMessages, 
      notifyRideUpdates, 
      notifyPromotions, 
      shareLocationEnabled 
    } = req.body;

    // Check if user exists
    const user = await prisma.users.findUnique({
      where: { id: driverId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Build update data - only include provided fields
    const updateData: any = {};
    
    if (typeof notifyBookings === 'boolean') {
      updateData.notifyBookings = notifyBookings;
    }
    if (typeof notifyMessages === 'boolean') {
      updateData.notifyMessages = notifyMessages;
    }
    if (typeof notifyRideUpdates === 'boolean') {
      updateData.notifyRideUpdates = notifyRideUpdates;
    }
    if (typeof notifyPromotions === 'boolean') {
      updateData.notifyPromotions = notifyPromotions;
    }
    if (typeof shareLocationEnabled === 'boolean') {
      updateData.shareLocationEnabled = shareLocationEnabled;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid preferences provided to update',
      });
    }

    // Update preferences
    const updatedUser = await prisma.users.update({
      where: { id: driverId },
      data: updateData,
      select: {
        id: true,
        notifyBookings: true,
        notifyMessages: true,
        notifyRideUpdates: true,
        notifyPromotions: true,
        shareLocationEnabled: true,
      },
    });

    console.log(`✅ Preferences updated for driver ${driverId}`);

    return res.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: {
        notifyBookings: updatedUser.notifyBookings ?? true,
        notifyMessages: updatedUser.notifyMessages ?? true,
        notifyRideUpdates: updatedUser.notifyRideUpdates ?? true,
        notifyPromotions: updatedUser.notifyPromotions ?? true,
        shareLocationEnabled: updatedUser.shareLocationEnabled ?? true,
      },
    });
  } catch (error) {
    console.error('❌ Error updating preferences:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update preferences',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/driver/profile
 * Delete driver account permanently
 * Query params: driverId (required)
 * Body: password (required for confirmation), reason (optional)
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    const driverId = req.query.driverId ? parseInt(req.query.driverId as string) : null;

    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({
        success: false,
        message: 'Driver ID is required',
      });
    }

    const { password, reason } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password confirmation is required to delete account',
      });
    }

    // Get user with password
    const user = await prisma.users.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        email: true,
        fullName: true,
        password: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Password is incorrect. Account deletion cancelled.',
      });
    }

    // Check for active rides
    const activeRides = await prisma.rides.count({
      where: {
        driverId: driverId,
        status: {
          in: ['scheduled', 'in-progress'],
        },
      },
    });

    if (activeRides > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete account with ${activeRides} active ride(s). Please complete or cancel all active rides first.`,
        activeRidesCount: activeRides,
      });
    }

    // Check for pending bookings on completed rides
    const pendingBookings = await prisma.bookings.count({
      where: {
        rides: {
          driverId: driverId,
        },
        status: 'pending',
      },
    });

    if (pendingBookings > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete account with ${pendingBookings} pending booking(s). Please resolve all bookings first.`,
        pendingBookingsCount: pendingBookings,
      });
    }

    // Log deletion reason if provided
    if (reason) {
      console.log(`📝 Account deletion reason for user ${user.email}: ${reason}`);
    }

    // Delete user (cascades will handle related data)
    await prisma.users.delete({
      where: { id: driverId },
    });

    console.log(`✅ Account deleted for driver ${driverId} (${user.email})`);

    return res.json({
      success: true,
      message: 'Account deleted successfully. We\'re sorry to see you go.',
    });
  } catch (error) {
    console.error('❌ Error deleting account:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

