import express, { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate, requireRider } from '../../middleware/auth';
import {
  sendSuccess,
  sendBadRequest,
  sendNotFound,
  sendValidationError,
  sendInternalError,
} from '../../utils/apiResponse';

const router = express.Router();

/**
 * GET /api/rider/profile
 * Get rider profile information
 * Requires: JWT token in Authorization header
 */
router.get('/', authenticate, requireRider, async (req: Request, res: Response) => {
  try {
    // Get user ID from JWT token (already verified by middleware)
    const riderId = req.user!.userId;

    const user = await prisma.users.findUnique({
      where: { id: riderId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        emailVerified: true,
        photoUrl: true,
        city: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return sendNotFound(res, 'User');
    }

    // Split fullName into firstName and lastName for frontend compatibility
    const nameParts = user.fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return sendSuccess(res, 'Profile retrieved successfully', {
      user: {
        ...user,
        firstName,
        lastName,
      },
    });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to fetch profile');
  }
});

/**
 * PUT /api/rider/profile
 * Update rider profile information
 * Requires: JWT token in Authorization header
 * Body: fullName (or firstName/lastName), email, phoneNumber, photoUrl, city (all optional)
 */
router.put('/', authenticate, requireRider, async (req: Request, res: Response) => {
  try {
    // Get user ID from JWT token (already verified by middleware)
    const riderId = req.user!.userId;

    // Check if user exists
    const existingUser = await prisma.users.findUnique({
      where: { id: riderId },
    });

    if (!existingUser) {
      return sendNotFound(res, 'User');
    }

    const { fullName, firstName: firstNameInput, lastName: lastNameInput, email, phoneNumber, photoUrl, city } = req.body;

    // Validation
    const errors: string[] = [];

    // Handle name - support both fullName and firstName/lastName
    let finalFullName = fullName;
    if (!finalFullName && (firstNameInput || lastNameInput)) {
      const first = firstNameInput?.trim() || '';
      const last = lastNameInput?.trim() || '';
      finalFullName = `${first} ${last}`.trim();
    }

    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        errors.push('Invalid email format');
      } else {
        // Check if email is already taken by another user
        const emailUser = await prisma.users.findUnique({
          where: { email: email.trim().toLowerCase() },
        });
        if (emailUser && emailUser.id !== riderId) {
          errors.push('Email is already taken by another user');
        }
      }
    }

    if (phoneNumber && phoneNumber.trim()) {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(phoneNumber.trim()) || phoneNumber.trim().replace(/\D/g, '').length < 10) {
        errors.push('Invalid phone number format');
      }
    }

    if (errors.length > 0) {
      return sendValidationError(res, 'Validation failed', errors);
    }

    // Build update data
    const updateData: any = {};
    if (finalFullName && finalFullName.trim()) {
      updateData.fullName = finalFullName.trim();
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
      where: { id: riderId },
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

    // Split fullName into firstName and lastName for frontend compatibility
    const nameParts = updatedUser.fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return sendSuccess(res, 'Profile updated successfully', {
      user: {
        ...updatedUser,
        firstName,
        lastName,
      },
    });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to update profile');
  }
});

/**
 * PUT /api/rider/profile/photo
 * Update rider profile photo
 * Requires: JWT token in Authorization header
 * Body: photoUrl (required) - URL or base64 data URL
 */
router.put('/photo', authenticate, requireRider, async (req: Request, res: Response) => {
  try {
    const riderId = req.user!.userId;
    const { photoUrl } = req.body;

    if (!photoUrl || !photoUrl.trim()) {
      return sendBadRequest(res, 'Photo URL is required');
    }

    // Validate URL format (accepts http/https URLs or data URLs)
    const isValidUrl =
      photoUrl.startsWith('http://') ||
      photoUrl.startsWith('https://') ||
      photoUrl.startsWith('data:image/');

    if (!isValidUrl) {
      return sendBadRequest(res, 'Invalid photo URL format. Must be a valid URL or base64 data URL');
    }

    // Check if user exists
    const user = await prisma.users.findUnique({
      where: { id: riderId },
    });

    if (!user) {
      return sendNotFound(res, 'User');
    }

    // Update photo
    const updatedUser = await prisma.users.update({
      where: { id: riderId },
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

    // Split fullName into firstName and lastName for frontend compatibility
    const nameParts = updatedUser.fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return sendSuccess(res, 'Profile photo updated successfully', {
      user: {
        ...updatedUser,
        firstName,
        lastName,
      },
    });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to update profile photo');
  }
});

export default router;

