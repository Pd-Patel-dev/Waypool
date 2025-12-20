# Stripe File Upload Diagnostic Guide

## What I Fixed

### 1. ✅ Removed 30-Second Timeout Override
- **Problem**: Per-request timeout (30s) was overriding global timeout (5min)
- **Fix**: Removed timeout override, now using global 5-minute timeout
- **Location**: `backend/src/services/stripeIdentityDoc.service.ts` line 115-122

### 2. ✅ More Aggressive Compression
- **Changed**: Max dimensions 2000px → 1500px
- **Changed**: Quality 85% → 80%
- **Result**: Smaller files = faster uploads
- **Location**: `backend/src/services/stripeIdentityDoc.service.ts` line 54-58

### 3. ✅ Using Buffer Directly (No Unsafe Streams)
- **Removed**: `new Readable()` with manual `push()`
- **Using**: Buffer directly (most reliable)
- **Location**: `backend/src/services/stripeIdentityDoc.service.ts` line 118

### 4. ✅ Fixed Error Handling
- **Problem**: `sendBadRequest` was called with invalid arguments
- **Fix**: Removed invalid third argument, proper error logging
- **Location**: `backend/src/routes/driverConnect.routes.ts` line 697-710

### 5. ✅ Fixed payoutsEnabled
- **Changed**: `account.capabilities?.transfers === "active"` 
- **To**: `account.payouts_enabled || false`
- **Location**: `backend/src/services/stripeIdentityDoc.service.ts` line 211

### 6. ✅ Added EXIF Orientation Fix
- **Added**: `.rotate()` to fix iPhone photo orientation
- **Location**: `backend/src/services/stripeIdentityDoc.service.ts` line 53

## Current Implementation

### File Upload Flow:
1. **Receive** file via multer (memory storage)
2. **Compress** with sharp (1500px max, 80% quality, fix orientation)
3. **Upload** to Stripe Files API using Buffer directly
4. **Attach** file IDs to connected account
5. **Return** updated status

### Stripe Configuration:
- **Global Timeout**: 5 minutes (300,000ms)
- **Max Network Retries**: 2
- **API Version**: 2025-12-15.clover
- **Context**: Platform only (NO Stripe-Account header)

## How to Test

### 1. Run Diagnostic Script
```bash
cd Waypool/backend
npx ts-node --project tsconfig.scripts.json --require tsconfig-paths/register scripts/test-stripe-file-upload.ts
```

This will:
- Test Stripe API connectivity
- Upload a small test image
- Show if Stripe file upload is working

### 2. Check Backend Logs
When uploading, you should see:
```
[StripeIdentityDoc] Original file: ...
[StripeIdentityDoc] 🗜️ Compressing/resizing image...
[StripeIdentityDoc] ✅ Image compressed: X KB → Y KB (Z% reduction)
[StripeIdentityDoc] 📤 Calling Stripe Files API with Buffer (X bytes)...
[StripeIdentityDoc] ✅ File uploaded successfully: file_xxx (took Xms)
```

### 3. Check for Errors
If upload fails, logs will show:
- Error type (StripeConnectionError, etc.)
- Error message
- Request ID (if available)
- Request log URL (if available)

## Common Issues & Solutions

### Issue 1: Timeout After 30 Seconds
**Status**: ✅ FIXED
- Removed 30-second timeout override
- Now using global 5-minute timeout

### Issue 2: Files Too Large
**Status**: ✅ FIXED
- More aggressive compression (1500px, 80% quality)
- Files should be much smaller now

### Issue 3: Invalid Status Code Error
**Status**: ✅ FIXED
- Fixed `sendBadRequest` calls
- Proper error handling

### Issue 4: Still Timing Out
**Possible Causes**:
1. **Network connectivity** - Check if server can reach `files.stripe.com`
2. **Stripe API key** - Verify key has file upload permissions
3. **File still too large** - Check compression logs
4. **Stripe API slowness** - Check Stripe status page

## Next Steps if Still Failing

### Option 1: Test with Diagnostic Script
Run the test script to isolate the issue:
```bash
cd Waypool/backend
npx ts-node --project tsconfig.scripts.json --require tsconfig-paths/register scripts/test-stripe-file-upload.ts
```

### Option 2: Check Network Connectivity
```bash
curl -I https://files.stripe.com/v1/files
# Should return 401 (expected - needs auth)
```

### Option 3: Verify Stripe API Key
- Check `STRIPE_SECRET_KEY` is set correctly
- Verify it's a test key (`sk_test_...`) or live key (`sk_live_...`)
- Ensure key has file upload permissions

### Option 4: Check File Size After Compression
Look for this log:
```
[StripeIdentityDoc] ✅ Image compressed: X KB → Y KB (Z% reduction)
```

If Y is still > 500KB, compression might need to be more aggressive.

## Expected Behavior

### Successful Upload:
1. File received by backend ✅
2. File compressed (should be < 500KB) ✅
3. Upload to Stripe starts ✅
4. Upload completes within 5 minutes ✅
5. File ID returned ✅
6. Documents attached to account ✅
7. Status returned to frontend ✅

### If Upload Times Out:
- Check compression logs (is file small enough?)
- Check network connectivity
- Check Stripe API status
- Try the diagnostic script

## Files Changed

1. `backend/src/services/stripeIdentityDoc.service.ts`
   - Removed timeout override
   - More aggressive compression
   - Better error logging

2. `backend/src/routes/driverConnect.routes.ts`
   - Fixed error handling
   - Better error messages

3. `backend/src/lib/stripe.ts`
   - Global 5-minute timeout (already set)

## Summary

All known issues have been fixed:
- ✅ Timeout increased to 5 minutes
- ✅ More aggressive compression
- ✅ Using Buffer directly
- ✅ Fixed error handling
- ✅ Fixed payoutsEnabled logic
- ✅ Added EXIF orientation fix

**If uploads still fail, run the diagnostic script to identify the exact issue.**


