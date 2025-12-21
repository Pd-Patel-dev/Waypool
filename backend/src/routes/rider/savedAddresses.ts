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
 * GET /api/rider/saved-addresses
 * Get all saved addresses for the authenticated rider
 * Requires: JWT token in Authorization header
 */
router.get('/', authenticate, requireRider, async (req: Request, res: Response) => {
  try {
    const riderId = req.user!.userId;

    const addresses = await prisma.savedAddresses.findMany({
      where: { riderId },
      orderBy: [
        { isDefault: 'desc' },
        { label: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return sendSuccess(res, 'Saved addresses retrieved successfully', { addresses });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to fetch saved addresses');
  }
});

/**
 * POST /api/rider/saved-addresses
 * Create a new saved address
 * Requires: JWT token in Authorization header
 * Body: label, address, city, state, zipCode, latitude, longitude, isDefault (optional)
 */
router.post('/', authenticate, requireRider, async (req: Request, res: Response) => {
  try {
    const riderId = req.user!.userId;
    const { label, address, city, state, zipCode, latitude, longitude, isDefault } = req.body;

    // Validation
    const errors: string[] = [];

    if (!label || !label.trim()) {
      errors.push('Label is required');
    }

    if (!address || !address.trim()) {
      errors.push('Address is required');
    }

    if (latitude === undefined || longitude === undefined) {
      errors.push('Latitude and longitude are required');
    } else if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      errors.push('Latitude and longitude must be numbers');
    }

    if (errors.length > 0) {
      return sendValidationError(res, 'Validation failed', errors);
    }

    // If setting as default, unset other default addresses
    if (isDefault) {
      await prisma.savedAddresses.updateMany({
        where: { riderId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Check if address with same label already exists
    const existingAddress = await prisma.savedAddresses.findFirst({
      where: {
        riderId,
        label: label.trim().toLowerCase(),
      },
    });

    if (existingAddress) {
      return sendBadRequest(res, `An address with label "${label}" already exists`);
    }

    // Create the saved address (latitude and longitude are validated as numbers above)
    const savedAddress = await prisma.savedAddresses.create({
      data: {
        riderId,
        label: label.trim().toLowerCase(),
        address: address.trim(),
        city: city?.trim() || null,
        state: state?.trim() || null,
        zipCode: zipCode?.trim() || null,
        latitude: latitude as number, // Already validated as number
        longitude: longitude as number, // Already validated as number
        isDefault: isDefault || false,
      },
    });

    return sendSuccess(res, 'Address saved successfully', { address: savedAddress }, 201);
  } catch (error) {
    return sendInternalError(res, error, 'Failed to save address');
  }
});

/**
 * PUT /api/rider/saved-addresses/:id
 * Update a saved address
 * Requires: JWT token in Authorization header
 * Body: label, address, city, state, zipCode, latitude, longitude, isDefault (all optional)
 */
router.put('/:id', authenticate, requireRider, async (req: Request, res: Response) => {
  try {
    const riderId = req.user!.userId;
    const addressIdParam = req.params.id;
    if (!addressIdParam) {
      return sendBadRequest(res, 'Address ID is required');
    }
    const addressId = parseInt(addressIdParam);

    if (isNaN(addressId)) {
      return sendBadRequest(res, 'Invalid address ID');
    }

    // Check if address exists and belongs to this rider
    const existingAddress = await prisma.savedAddresses.findUnique({
      where: { id: addressId },
    });

    if (!existingAddress) {
      return sendNotFound(res, 'Address');
    }

    if (existingAddress.riderId !== riderId) {
      return sendBadRequest(res, 'You do not have permission to update this address');
    }

    const { label, address, city, state, zipCode, latitude, longitude, isDefault } = req.body;

    // Build update data
    const updateData: any = {};

    if (label !== undefined && label.trim()) {
      // Check if another address with this label exists
      const labelConflict = await prisma.savedAddresses.findFirst({
        where: {
          riderId,
          label: label.trim().toLowerCase(),
          id: { not: addressId },
        },
      });

      if (labelConflict) {
        return sendBadRequest(res, `An address with label "${label}" already exists`);
      }

      updateData.label = label.trim().toLowerCase();
    }

    if (address !== undefined) {
      updateData.address = address.trim();
    }

    if (city !== undefined) {
      updateData.city = city?.trim() || null;
    }

    if (state !== undefined) {
      updateData.state = state?.trim() || null;
    }

    if (zipCode !== undefined) {
      updateData.zipCode = zipCode?.trim() || null;
    }

    if (latitude !== undefined && longitude !== undefined) {
      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return sendValidationError(res, 'Latitude and longitude must be numbers', []);
      }
      updateData.latitude = latitude;
      updateData.longitude = longitude;
    }

    // If setting as default, unset other default addresses
    if (isDefault === true) {
      await prisma.savedAddresses.updateMany({
        where: { riderId, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      });
      updateData.isDefault = true;
    } else if (isDefault === false) {
      updateData.isDefault = false;
    }

    // Update the address
    const updatedAddress = await prisma.savedAddresses.update({
      where: { id: addressId },
      data: updateData,
    });

    return sendSuccess(res, 'Address updated successfully', { address: updatedAddress });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to update address');
  }
});

/**
 * DELETE /api/rider/saved-addresses/:id
 * Delete a saved address
 * Requires: JWT token in Authorization header
 */
router.delete('/:id', authenticate, requireRider, async (req: Request, res: Response) => {
  try {
    const riderId = req.user!.userId;
    const addressIdParam = req.params.id;
    if (!addressIdParam) {
      return sendBadRequest(res, 'Address ID is required');
    }
    const addressId = parseInt(addressIdParam);

    if (isNaN(addressId)) {
      return sendBadRequest(res, 'Invalid address ID');
    }

    // Check if address exists and belongs to this rider
    const existingAddress = await prisma.savedAddresses.findUnique({
      where: { id: addressId },
    });

    if (!existingAddress) {
      return sendNotFound(res, 'Address');
    }

    if (existingAddress.riderId !== riderId) {
      return sendBadRequest(res, 'You do not have permission to delete this address');
    }

    // Delete the address
    await prisma.savedAddresses.delete({
      where: { id: addressId },
    });

    return sendSuccess(res, 'Address deleted successfully');
  } catch (error) {
    return sendInternalError(res, error, 'Failed to delete address');
  }
});

export default router;

