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

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    return sendSuccess(res, existingUser ? 'Email is already registered' : 'Email is available', {
      available: !existingUser,
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
}

interface LoginBody {
  email: string;
  password: string;
}

// POST /api/driver/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { fullName, email, phoneNumber, password, photoUrl, city, carMake, carModel, carYear, carColor }: SignupBody = req.body;

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

    if (errors.length > 0) {
      return sendValidationError(res, 'Validation failed', errors);
    }

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

    return sendSuccess(res, 'User created successfully', { user }, 201);
  } catch (error) {
    return sendInternalError(res, error, 'Failed to create user account');
  }
});

// POST /api/driver/auth/login
router.post('/login', async (req: Request, res: Response) => {
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

    // Return user data (without password)
    return sendSuccess(res, 'Login successful', {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        isDriver: user.isDriver,
        isRider: user.isRider,
        photoUrl: user.photoUrl,
        city: user.city,
        carMake: user.carMake,
        carModel: user.carModel,
        carYear: user.carYear,
        carColor: user.carColor,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
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
    return sendSuccess(res, 'Logout successful');
  } catch (error) {
    return sendInternalError(res, error, 'Failed to logout');
  }
});

export default router;

