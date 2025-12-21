import jwt, { SignOptions } from 'jsonwebtoken';

// JWT secret - should be in environment variables
const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d'; // 7 days
const JWT_REFRESH_EXPIRES_IN: string = process.env.JWT_REFRESH_EXPIRES_IN || '30d'; // 30 days

export interface JWTPayload {
  userId: number;
  email: string;
  role: 'driver' | 'rider';
  emailVerified: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Generate access token (short-lived)
 */
export function generateAccessToken(payload: JWTPayload): string {
  const tokenPayload = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    emailVerified: payload.emailVerified,
    type: 'access',
  };

  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'waypool',
    audience: 'waypool-app',
  } as SignOptions;

  return jwt.sign(tokenPayload, JWT_SECRET, options);
}

/**
 * Generate refresh token (long-lived)
 */
export function generateRefreshToken(payload: JWTPayload): string {
  const tokenPayload = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    type: 'refresh',
  };

  const options: SignOptions = {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'waypool',
    audience: 'waypool-app',
  } as SignOptions;

  return jwt.sign(tokenPayload, JWT_SECRET, options);
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(payload: JWTPayload): TokenPair {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'waypool',
      audience: 'waypool-app',
    }) as jwt.JwtPayload;

    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }

    return {
      userId: decoded.userId as number,
      email: decoded.email as string,
      role: decoded.role as 'driver' | 'rider',
      emailVerified: decoded.emailVerified as boolean,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): { userId: number; email: string; role: 'driver' | 'rider' } {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'waypool',
      audience: 'waypool-app',
    }) as jwt.JwtPayload;

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return {
      userId: decoded.userId as number,
      email: decoded.email as string,
      role: decoded.role as 'driver' | 'rider',
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
}

