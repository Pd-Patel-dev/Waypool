import express from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { sendOTPEmail } from '../../services/emailService';
import {
  sendSuccess,
  sendBadRequest,
  sendInternalError,
} from '../../utils/apiResponse';
import { emailRateLimiter } from '../../middleware/rateLimiter';

const router = express.Router();

// Generate a 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/rider/email-verification/send
router.post('/send', emailRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, fullName } = req.body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return sendBadRequest(res, 'Email is required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return sendBadRequest(res, 'Invalid email format');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Upsert verification code (update if exists, create if not)
    await prisma.emailVerificationCodes.upsert({
      where: { email: normalizedEmail },
      update: {
        code,
        expiresAt,
        updatedAt: new Date(),
      },
      create: {
        email: normalizedEmail,
        code,
        expiresAt,
      },
    });

    // Send OTP email
    try {
      await sendOTPEmail({
        email: normalizedEmail,
        code,
        fullName: fullName?.trim(),
      });
    } catch (error) {
      console.error('Error sending OTP email:', error);
      // Don't fail the request if email sending fails in development
      if (process.env.NODE_ENV === 'production') {
        return sendInternalError(res, error, 'Failed to send verification email');
      }
    }

    return sendSuccess(res, 'Verification code sent to your email', {
      email: normalizedEmail,
      expiresIn: 600, // 10 minutes in seconds
    });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to send verification code');
  }
});

// POST /api/rider/email-verification/verify
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return sendBadRequest(res, 'Email is required');
    }

    if (!code || typeof code !== 'string' || !code.trim()) {
      return sendBadRequest(res, 'Verification code is required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    // Find verification code
    const verificationCode = await prisma.emailVerificationCodes.findUnique({
      where: { email: normalizedEmail },
    });

    if (!verificationCode) {
      return sendBadRequest(res, 'No verification code found for this email. Please request a new code.');
    }

    // Check if code has expired
    if (new Date() > verificationCode.expiresAt) {
      // Delete expired code
      await prisma.emailVerificationCodes.delete({
        where: { email: normalizedEmail },
      });
      return sendBadRequest(res, 'Verification code has expired. Please request a new code.');
    }

    // Verify code
    if (verificationCode.code !== normalizedCode) {
      return sendBadRequest(res, 'Invalid verification code. Please try again.');
    }

    // Code is valid - delete it (one-time use)
    await prisma.emailVerificationCodes.delete({
      where: { email: normalizedEmail },
    });

    return sendSuccess(res, 'Email verified successfully', {
      email: normalizedEmail,
      verified: true,
    });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to verify email');
  }
});

// POST /api/rider/email-verification/resend
router.post('/resend', emailRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, fullName } = req.body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return sendBadRequest(res, 'Email is required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Upsert verification code
    await prisma.emailVerificationCodes.upsert({
      where: { email: normalizedEmail },
      update: {
        code,
        expiresAt,
        updatedAt: new Date(),
      },
      create: {
        email: normalizedEmail,
        code,
        expiresAt,
      },
    });

    // Send OTP email
    try {
      await sendOTPEmail({
        email: normalizedEmail,
        code,
        fullName: fullName?.trim(),
      });
    } catch (error) {
      console.error('Error sending OTP email:', error);
      if (process.env.NODE_ENV === 'production') {
        return sendInternalError(res, error, 'Failed to send verification email');
      }
    }

    return sendSuccess(res, 'Verification code resent to your email', {
      email: normalizedEmail,
      expiresIn: 600, // 10 minutes in seconds
    });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to resend verification code');
  }
});

export default router;

