# Security Notice: Exposed API Key

## Issue
A Google Maps API key was previously hardcoded in the codebase and committed to git history.

**Exposed Key:** `AIzaSyB3dqyiWNGJLqv_UYA2zQxUdYpiIbmw3k4` (partial)

**Location in History:** `driver-app/screens/AddRideScreen.tsx:188` (commit 7f3de0b)

## Current Status
✅ **FIXED**: The hardcoded key has been removed from the codebase.
✅ **CURRENT CODE**: All API keys now use environment variables (`EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`)

## Required Actions

### 1. Revoke the Exposed API Key (CRITICAL)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" > "Credentials"
3. Find the API key: `AIzaSyB3dqyiWNGJLqv_UYA2zQxUdYpiIbmw3k4`
4. **DELETE or RESTRICT** the key immediately
5. Create a new API key with proper restrictions

### 2. Update Environment Variables
1. Add the new API key to your `.env` file:
   ```
   EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_new_key_here
   ```
2. Ensure `.env` is in `.gitignore` (already configured)

### 3. API Key Restrictions (Recommended)
When creating the new key, apply these restrictions:
- **Application restrictions**: Restrict to your app's bundle ID/package name
- **API restrictions**: Limit to only:
  - Maps JavaScript API
  - Geocoding API
  - Directions API
  - Places API

### 4. Monitor Usage
- Check Google Cloud Console for unusual API usage
- Set up billing alerts
- Monitor for unauthorized access

## Prevention
- ✅ All API keys now use environment variables
- ✅ `.env` files are in `.gitignore`
- ✅ Code review process should catch hardcoded secrets
- ⚠️ Consider using secret scanning tools (GitHub Secret Scanning, GitGuardian, etc.)

## Note
The exposed key is still in git history. For complete removal, consider:
- Using `git filter-branch` or `git filter-repo` (advanced, requires team coordination)
- Or accept that the key is in history but ensure it's revoked and new key is secure
