# Quick Debug Checklist - Document Upload

Use this checklist to quickly identify where the upload is failing.

## ✅ Pre-Flight Checks

- [ ] Backend server is running (`npm run dev` in `Waypool/backend`)
- [ ] Backend shows: `🚀 Waypool Server is running on http://0.0.0.0:3000`
- [ ] `STRIPE_SECRET_KEY` is set in `.env` file
- [ ] Stripe key starts with `sk_test_` (test mode)
- [ ] Database migrations are up to date (`npx prisma db push`)

## 🔍 When You Click "Upload Documents"

### Step 1: Check Frontend Logs (React Native Console)

Look for these logs IN ORDER:

- [ ] `[DocumentUpload] handleUpload called`
- [ ] `[uploadVerificationDocument] Starting upload for driver: X`
- [ ] `[uploadVerificationDocument] Making fetch request to: http://...`
- [ ] `[uploadVerificationDocument] Fetch completed` ← **IF YOU DON'T SEE THIS, REQUEST IS HANGING**

### Step 2: Check Backend Logs (Terminal where backend is running)

Look for these logs IN ORDER:

- [ ] `[UploadDocument] ===== REQUEST RECEIVED =====` ← **IF YOU DON'T SEE THIS, REQUEST ISN'T REACHING BACKEND**
- [ ] `[UploadDocument] ===== AFTER MULTER =====`
- [ ] `[UploadDocument] Files present: true` ← **IF FALSE, MULTER ISSUE**
- [ ] `[UploadDocument] ===== HANDLER STARTED =====`
- [ ] `[StripeIdentityDoc] Uploading file to Stripe Files API`
- [ ] `[StripeIdentityDoc] File uploaded successfully: file_xxxxx`
- [ ] `[StripeIdentityDoc] Attaching documents to account`
- [ ] `[StripeIdentityDoc] Documents attached successfully`
- [ ] `[UploadDocument] Response sent successfully` ← **IF YOU SEE THIS BUT FRONTEND TIMES OUT, IT'S A NETWORK/CORS ISSUE**

### Step 3: Check Response

If backend shows "Response sent successfully":

- [ ] Check frontend logs for: `[uploadVerificationDocument] Response status: 200`
- [ ] If status is NOT 200, check error message
- [ ] If status is 200 but still times out, check CORS headers

## 🐛 Common Failure Points

### Failure Point 1: No Backend Logs at All
**Problem:** Request never reaches backend
**Fix:**
- Check API URL in `driver-app/config/api.ts`
- For physical device: Use your computer's IP (not localhost)
- Test: Open `http://YOUR_API_URL/health` in device browser

### Failure Point 2: "Files present: false"
**Problem:** Multer isn't parsing files
**Fix:**
- Check FormData is created correctly
- Verify Content-Type header (should be multipart/form-data)
- Check file size is under 10MB

### Failure Point 3: Stripe Upload Fails
**Problem:** Stripe API error
**Fix:**
- Verify STRIPE_SECRET_KEY is platform key
- Check Stripe dashboard for errors
- Verify account type is "custom"

### Failure Point 4: Response Sent But Frontend Times Out
**Problem:** Network/CORS issue
**Fix:**
- Check CORS configuration in `backend/src/index.ts`
- Verify response headers are sent
- Check network tab in React Native debugger

## 📋 What to Share When Asking for Help

1. **Backend logs** (copy from terminal)
2. **Frontend logs** (copy from React Native console)
3. **API URL** you're using
4. **Platform** (iOS Simulator, iOS Physical, Android Emulator)
5. **Where it stops** (which log is the last one you see)

## 🎯 Quick Test

Run this to test if backend is reachable:

```bash
# From your computer
curl http://localhost:3000/health

# Should return: {"status":"ok",...}
```

If this works but app doesn't, it's a network/URL configuration issue.


