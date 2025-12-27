import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import bcrypt from 'bcrypt';
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendUnauthorized,
  sendConflict,
  sendBadRequest,
  sendInternalError,
} from '../../utils/apiResponse';
import { generateTokenPair } from '../../utils/jwt';
import { authRateLimiter } from '../../middleware/rateLimiter';

const router = express.Router();

// Validation helpers
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhoneNumber = (phone: string): boolean => {
  // Remove spaces, dashes, and parentheses for validation
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return cleaned.length >= 10 && /^\d+$/.test(cleaned);
};

// GET /api/driver/auth/check-email?email=user@example.com
router.get('/check-email', async (req: Request, res: Response) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return sendBadRequest(res, 'Email is required');
    }

    if (!validateEmail(email)) {
      return sendBadRequest(res, 'Invalid email format');
    }

    // Check if user already exists and is already a driver
    // If user exists but is only a rider, email is still available for driver signup
    const existingUser = await prisma.users.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { isDriver: true },
    });

    // Email is only unavailable if user exists AND is already a driver
    const isAlreadyDriver = existingUser?.isDriver ?? false;

    return sendSuccess(res, isAlreadyDriver ? 'Email is already registered as a driver' : 'Email is available', {
      available: !isAlreadyDriver,
    });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to check email availability');
  }
});

interface SignupBody {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  photoUrl: string;
  city: string;
  carMake: string;
  carModel: string;
  carYear: number;
  carColor: string;
  verificationCode: string;
}

interface LoginBody {
  email: string;
  password: string;
}

// POST /api/driver/auth/signup
router.post('/signup', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { fullName, email, phoneNumber, password, photoUrl, city, carMake, carModel, carYear, carColor, verificationCode }: SignupBody = req.body;

    // Validation
    const errors: string[] = [];

    if (!fullName || !fullName.trim()) {
      errors.push('Full name is required');
    }

    if (!email || !email.trim()) {
      errors.push('Email is required');
    } else if (!validateEmail(email)) {
      errors.push('Invalid email format');
    }

    if (!phoneNumber || !phoneNumber.trim()) {
      errors.push('Phone number is required');
    } else if (!validatePhoneNumber(phoneNumber)) {
      errors.push('Invalid phone number');
    }

    if (!password) {
      errors.push('Password is required');
    } else if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }

    if (!photoUrl || !photoUrl.trim()) {
      errors.push('Photo URL is required');
    }

    if (!city || !city.trim()) {
      errors.push('City is required');
    }

    if (!carMake || !carMake.trim()) {
      errors.push('Car make is required');
    }

    if (!carModel || !carModel.trim()) {
      errors.push('Car model is required');
    }

    if (!carYear) {
      errors.push('Car year is required');
    } else if (typeof carYear !== 'number' || carYear < 1900 || carYear > new Date().getFullYear() + 1) {
      errors.push('Car year must be a valid year');
    }

    if (!carColor || !carColor.trim()) {
      errors.push('Car color is required');
    }

    if (!verificationCode || !verificationCode.trim()) {
      errors.push('Verification code is required');
    }

    if (errors.length > 0) {
      return sendValidationError(res, 'Validation failed', errors);
    }

    // Verify email verification code
    const normalizedEmail = email.trim().toLowerCase();
    const verificationRecord = await prisma.emailVerificationCodes.findUnique({
      where: { email: normalizedEmail },
    });

    if (!verificationRecord) {
      return sendBadRequest(res, 'No verification code found for this email. Please verify your email first.');
    }

    // Check if code has expired
    if (new Date() > verificationRecord.expiresAt) {
      await prisma.emailVerificationCodes.delete({
        where: { email: normalizedEmail },
      });
      return sendBadRequest(res, 'Verification code has expired. Please request a new code.');
    }

    // Verify code
    if (verificationRecord.code !== verificationCode.trim()) {
      return sendBadRequest(res, 'Invalid verification code. Please try again.');
    }

    // Code is valid - delete it (one-time use)
    await prisma.emailVerificationCodes.delete({
      where: { email: normalizedEmail },
    });

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    let user;

    if (existingUser) {
      // User exists - verify password matches
      const isPasswordValid = await bcrypt.compare(password, existingUser.password);

      if (!isPasswordValid) {
        return sendValidationError(
          res,
          'User with this email already exists',
          ['Email already exists with a different password. Please use the correct password or log in.']
        );
      }

      // Password matches - update user to enable driver flag and update driver-specific fields
      user = await prisma.users.update({
        where: { email: email.trim().toLowerCase() },
        data: {
          isDriver: true,
          emailVerified: true,
          // Update driver-specific fields
          fullName: fullName.trim() !== existingUser.fullName ? fullName.trim() : existingUser.fullName,
          phoneNumber: phoneNumber.trim() !== existingUser.phoneNumber ? phoneNumber.trim() : existingUser.phoneNumber,
          photoUrl: photoUrl.trim(),
          city: city.trim(),
          carMake: carMake.trim(),
          carModel: carModel.trim(),
          carYear: typeof carYear === 'number' ? carYear : parseInt(String(carYear), 10),
          carColor: carColor.trim(),
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          isDriver: true,
          isRider: true,
          emailVerified: true,
          photoUrl: true,
          city: true,
          carMake: true,
          carModel: true,
          carYear: true,
          carColor: true,
          createdAt: true,
        },
      });
    } else {
      // User doesn't exist - create new user
      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      user = await prisma.users.create({
        data: {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phoneNumber: phoneNumber.trim(),
          password: hashedPassword,
          isDriver: true,
          isRider: false,
          emailVerified: true,
          photoUrl: photoUrl.trim(),
          city: city.trim(),
          carMake: carMake.trim(),
          carModel: carModel.trim(),
          carYear: typeof carYear === 'number' ? carYear : parseInt(String(carYear), 10),
          carColor: carColor.trim(),
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          isDriver: true,
          isRider: true,
          emailVerified: true,
          photoUrl: true,
          city: true,
          carMake: true,
          carModel: true,
          carYear: true,
          carColor: true,
          createdAt: true,
        },
      });
    }

    // Generate JWT tokens for new/updated driver
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: 'driver',
      emailVerified: user.emailVerified || false,
    });

    return sendSuccess(res, 'User created successfully', { user, tokens }, 201);
  } catch (error) {
    return sendInternalError(res, error, 'Failed to create user account');
  }
});

// POST /api/driver/auth/login
router.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginBody = req.body;

    // Validation
    if (!email || !email.trim()) {
      return sendBadRequest(res, 'Email is required');
    }

    if (!password) {
      return sendBadRequest(res, 'Password is required');
    }

    // Find user by email
    const user = await prisma.users.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return sendUnauthorized(res, 'Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return sendUnauthorized(res, 'Invalid email or password');
    }

    // Verify user is a driver
    if (!user.isDriver) {
      return sendUnauthorized(res, 'This account is not registered as a driver');
    }

    // Generate JWT tokens
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: 'driver',
      emailVerified: user.emailVerified || false,
    });

    // Return user data (without password) and tokens
    return sendSuccess(res, 'Login successful', {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        isDriver: user.isDriver,
        isRider: user.isRider,
        emailVerified: user.emailVerified,
        photoUrl: user.photoUrl,
        city: user.city,
        carMake: user.carMake,
        carModel: user.carModel,
        carYear: user.carYear,
        carColor: user.carColor,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      tokens,
    });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to authenticate user');
  }
});

// POST /api/driver/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    // For now, just return success
    // In the future, this could invalidate tokens, clear sessions, etc.
    // Note: JWT tokens are stateless, so we can't invalidate them server-side
    // Frontend should delete tokens from storage
    return sendSuccess(res, 'Logout successful');
  } catch (error) {
    return sendInternalError(res, error, 'Failed to logout');
  }
});

// POST /api/driver/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken || typeof refreshToken !== 'string') {
      return sendBadRequest(res, 'Refresh token is required');
    }

    // Verify refresh token
    try {
      const { verifyRefreshToken, generateTokenPair } = await import('../../utils/jwt');
      const payload = verifyRefreshToken(refreshToken);

      // Get fresh user data from database
      const user = await prisma.users.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          isDriver: true,
          isRider: true,
          emailVerified: true,
        },
      });

      if (!user || !user.isDriver) {
        return sendUnauthorized(res, 'Invalid refresh token');
      }

      // Generate new token pair
      const tokens = generateTokenPair({
        userId: user.id,
        email: user.email,
        role: 'driver',
        emailVerified: user.emailVerified || false,
      });

      return sendSuccess(res, 'Token refreshed successfully', { tokens });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid refresh token';
      return sendUnauthorized(res, message);
    }
  } catch (error) {
    return sendInternalError(res, error, 'Failed to refresh token');
  }
});

export default router;

