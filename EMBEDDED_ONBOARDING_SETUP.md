# Stripe Connect Embedded Onboarding Setup Guide

This guide explains how to set up and use the Stripe Connect embedded onboarding feature that replaces the hosted onboarding link.

## Overview

The embedded onboarding allows drivers to complete Stripe Connect setup directly within a web page (opened from the mobile app) instead of being redirected to Stripe's hosted pages.

## Architecture

1. **Backend** (`/backend`): Provides AccountSession API endpoints
2. **Web App** (`/web`): Next.js app hosting the embedded onboarding component
3. **Driver App** (`/driver-app`): Opens web page and handles deep links

## Setup Instructions

### 1. Backend Setup

The backend endpoints are already implemented. Ensure you have:

```env
STRIPE_SECRET_KEY=sk_test_...
FRONTEND_URL=http://localhost:3002  # Web app URL
```

### 2. Web App Setup

1. **Navigate to web directory:**

   ```bash
   cd Waypool/web
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Create environment file:**

   ```bash
   cp .env.example .env.local
   ```

4. **Configure environment variables:**

   ```env
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   NEXT_PUBLIC_API_URL=http://localhost:3000  # Backend URL
   NEXT_PUBLIC_DRIVER_APP_SCHEME=waypooldriver
   ```

5. **Start development server:**

   ```bash
   npm run dev
   ```

   The web app will run on `http://localhost:3002` (or the port specified by PORT env var)

### 3. Driver App Setup

1. **Add environment variable:**

   ```env
   EXPO_PUBLIC_WEB_APP_URL=http://YOUR_IP:3002
   ```

   For local development:

   - iOS Simulator: `http://localhost:3002`
   - Android Emulator: `http://10.0.2.2:3002`
   - Physical Device: `http://YOUR_COMPUTER_IP:3002`

2. **Deep link scheme is already configured** in `app.json` as `waypooldriver`

### 4. CORS Configuration

The backend already has CORS enabled for all origins in development. For production:

- Update `backend/src/index.ts` CORS configuration
- Ensure web app domain is allowed
- Configure proper headers for Stripe Connect embedded components

## Usage Flow

1. **Driver taps "Setup Payouts"** in the driver app
2. **App opens web page** in external browser: `http://YOUR_WEB_URL/driver/onboarding?driverId=123`
3. **Web page loads Stripe Connect embedded component**:
   - Fetches AccountSession from backend
   - Initializes Connect.js
   - Mounts account_onboarding component
4. **Driver completes onboarding** in the embedded form
5. **On completion**, driver clicks "Back to App"
6. **Deep link opens app**: `waypooldriver://onboarding/complete?driverId=123`
7. **App checks status** and shows success/pending message

## API Endpoints

### POST /api/driver/connect/account-session

Creates an AccountSession for embedded onboarding.

**Request:**

```json
{
  "driverId": 123
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "clientSecret": "acs_client_secret_..."
  }
}
```

### GET /api/driver/connect/status

Gets the current status of the Stripe Connect account.

**Query Parameters:**

- `driverId`: Driver ID

**Response:**

```json
{
  "success": true,
  "data": {
    "hasAccount": true,
    "stripeAccountId": "acct_...",
    "payoutsEnabled": true,
    "chargesEnabled": true,
    "currentlyDue": [],
    "detailsSubmitted": true
  }
}
```

## Key Features

### Prefilled Account Information

The backend automatically prefills known driver information:

- Email
- Full name (split into first/last)
- Phone number (formatted to E.164)

This reduces the number of questions during onboarding.

### Session Refresh

Connect.js automatically handles session refresh by calling `fetchClientSecret` when needed. The web page provides this function to the Connect.js library.

### Deep Linking

The web page includes a "Back to App" button that uses the deep link scheme:

```
waypooldriver://onboarding/complete?driverId=123
```

The driver app handles this deep link and shows the completion screen.

## Testing

1. **Start backend:**

   ```bash
   cd Waypool/backend
   npm run dev
   ```

2. **Start web app:**

   ```bash
   cd Waypool/web
   npm run dev
   ```

3. **Run driver app:**

   ```bash
   cd Waypool/driver-app
   npx expo start
   ```

4. **Test flow:**
   - Login as driver
   - Go to Payouts screen
   - Tap "Setup Payouts"
   - Complete onboarding in browser
   - Return to app

## Production Deployment

### Web App

Deploy the Next.js app to:

- Vercel (recommended)
- Netlify
- Your own server

Update `NEXT_PUBLIC_API_URL` to point to your production backend.

### Driver App

Update `EXPO_PUBLIC_WEB_APP_URL` to your production web app URL.

### Backend

Ensure CORS allows your web app domain:

```typescript
cors({
  origin: ["https://your-web-app.com"],
  credentials: true,
});
```

## Troubleshooting

### "Failed to create account session"

- Check backend is running
- Verify `STRIPE_SECRET_KEY` is set
- Ensure Stripe Connect is enabled in Stripe Dashboard

### "Unable to open onboarding page"

- Check `EXPO_PUBLIC_WEB_APP_URL` is set correctly
- Verify web app is running
- For physical devices, use computer's IP address

### Deep link not working

- Verify `scheme` in `app.json` is `waypooldriver`
- Check deep link format: `waypooldriver://onboarding/complete?driverId=123`
- On iOS, may need to configure URL schemes in Xcode

### CORS errors

- Backend CORS should allow web app origin
- Check browser console for specific CORS error
- Verify `NEXT_PUBLIC_API_URL` matches backend URL

## Security Notes

- Never expose `STRIPE_SECRET_KEY` in frontend code
- Use environment variables for all sensitive keys
- In production, restrict CORS to specific domains
- Validate `driverId` on backend (already implemented)

## Additional Resources

- [Stripe Connect Embedded Components Docs](https://stripe.com/docs/connect/embedded-components)
- [AccountSession API Reference](https://stripe.com/docs/api/account_sessions)
- [Next.js Documentation](https://nextjs.org/docs)
