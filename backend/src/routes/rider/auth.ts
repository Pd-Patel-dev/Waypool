import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import bcrypt from 'bcrypt';

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

// GET /api/rider/auth/check-email?email=user@example.com
router.get('/check-email', async (req: Request, res: Response) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    res.json({
      success: true,
      available: !existingUser,
      message: existingUser
        ? 'Email is already registered'
        : 'Email is available',
    });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

interface SignupBody {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

interface LoginBody {
  email: string;
  password: string;
}

// POST /api/rider/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phoneNumber }: SignupBody = req.body;

    // Validation
    const errors: string[] = [];

    if (!firstName || !firstName.trim()) {
      errors.push('First name is required');
    }

    if (!lastName || !lastName.trim()) {
      errors.push('Last name is required');
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
    } else if (password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    let user;

    if (existingUser) {
      // User exists - verify password matches
      const isPasswordValid = await bcrypt.compare(password, existingUser.password);

      if (!isPasswordValid) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists',
          errors: ['Email already exists with a different password. Please use the correct password or log in.'],
        });
      }

      // Password matches - update user to enable rider flag
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      
      user = await prisma.user.update({
        where: { email: email.trim().toLowerCase() },
        data: {
          isRider: true,
          // Update other fields if they're different
          fullName: fullName !== existingUser.fullName ? fullName : existingUser.fullName,
          phoneNumber: phoneNumber.trim() !== existingUser.phoneNumber ? phoneNumber.trim() : existingUser.phoneNumber,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          isDriver: true,
          isRider: true,
          createdAt: true,
        },
      });
    } else {
      // User doesn't exist - create new user
      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Combine first and last name
      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      // Create user
      user = await prisma.user.create({
        data: {
          fullName,
          email: email.trim().toLowerCase(),
          phoneNumber: phoneNumber.trim(),
          password: hashedPassword,
          isDriver: false,
          isRider: true,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          isDriver: true,
          isRider: true,
          createdAt: true,
        },
      });
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: String(user.id),
        email: user.email,
        role: user.isRider ? 'rider' : 'driver', // Keep for backward compatibility
        isDriver: user.isDriver,
        isRider: user.isRider,
        firstName: user.fullName.split(' ')[0],
        lastName: user.fullName.split(' ').slice(1).join(' '),
        phoneNumber: user.phoneNumber,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /api/rider/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password }: LoginBody = req.body;

    // Validation
    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required',
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Split fullName into firstName and lastName
    const nameParts = user.fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Return user data (without password)
    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: String(user.id),
        email: user.email,
        role: user.isRider ? 'rider' : 'driver', // Keep for backward compatibility
        isDriver: user.isDriver,
        isRider: user.isRider,
        firstName,
        lastName,
        phoneNumber: user.phoneNumber,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// POST /api/rider/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    // For now, just return success
    // In the future, this could invalidate tokens, clear sessions, etc.
    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;

