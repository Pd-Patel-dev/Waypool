# Complete Payout Setup Flow - Detailed Debug Guide

This guide walks through the **entire payout setup process** from scratch, including every API call, database update, and UI interaction. Use this to debug why document upload isn't returning a response.

---

## Table of Contents

1. [Backend Setup](#backend-setup)
2. [Frontend Setup](#frontend-setup)
3. [Complete Flow Step-by-Step](#complete-flow-step-by-step)
4. [Document Upload Flow (Detailed)](#document-upload-flow-detailed)
5. [Debugging Checklist](#debugging-checklist)
6. [Common Issues & Solutions](#common-issues--solutions)

---

## Backend Setup

### 1. Stripe Configuration

**File:** `Waypool/backend/src/lib/stripe.ts`

```typescript
// Stripe is initialized with ONLY platform secret key
// NO stripeAccount header is set (this is critical!)
export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2025-12-15.clover",
    })
  : null;
```

**Check:**

- ✅ `STRIPE_SECRET_KEY` is set in `.env`
- ✅ Key starts with `sk_test_` (test mode) or `sk_live_` (production)
- ✅ Key is the **platform** key, NOT a connected account key

---

### 2. Database Schema

**File:** `Waypool/backend/prisma/schema.prisma`

```prisma
model users {
  id                      Int      @id @default(autoincrement())
  stripeAccountId         String?  // acct_xxxxx
  stripeOnboardingStatus  String?  @default("not_started")
  stripeRequirementsDue   Json?    // Stores requirements from Stripe
  // ... other fields
}
```

**Check:**

- ✅ Run `npx prisma db push` to apply schema
- ✅ Run `npx prisma generate` to update TypeScript types

---

### 3. Upload Middleware

**File:** `Waypool/backend/src/middleware/upload.ts`

**What it does:**

- Configures multer for file uploads
- Stores files in memory (not on disk)
- Validates file types (JPEG, PNG only)
- Limits file size to 10MB

**Key points:**

- Files are available as `req.files.front[0]` and `req.files.back[0]`
- Each file has: `buffer`, `originalname`, `mimetype`, `size`

---

### 4. Stripe Identity Document Service

**File:** `Waypool/backend/src/services/stripeIdentityDoc.service.ts`

**Functions:**

#### A. `uploadToStripeFile(buffer, filename, mimetype)`

```typescript
// Uploads file to Stripe Files API
stripe.files.create({
  purpose: "identity_document",
  file: { data: buffer, name: filename, type: mimetype },
});
// Returns: file.id (e.g., "file_xxxxx")
```

**Important:** Uses platform context (no `stripeAccount` header)

#### B. `attachIdentityDocsToAccount(stripeAccountId, frontFileId, backFileId?)`

```typescript
// Attaches file IDs to connected account
stripe.accounts.update(stripeAccountId, {
  individual: {
    verification: {
      document: {
        front: frontFileId,
        back: backFileId, // optional
      },
    },
  },
});
```

**Important:** Uses platform context (no `stripeAccount` header)

#### C. `getConnectStatus(stripeAccountId)`

```typescript
// Retrieves account status and requirements
const account = await stripe.accounts.retrieve(stripeAccountId);
// Returns: { payoutsEnabled, chargesEnabled, currentlyDue, etc. }
```

---

### 5. Upload Document Route

**File:** `Waypool/backend/src/routes/driverConnect.routes.ts`

**Endpoint:** `POST /api/driver/connect/custom/upload-document`

**Flow:**

1. **Request arrives** → Logged with `[UploadDocument] ===== REQUEST RECEIVED =====`
2. **Multer processes** → Extracts files from `multipart/form-data`
3. **After multer** → Logged with `[UploadDocument] ===== AFTER MULTER =====`
4. **Handler starts** → Logged with `[UploadDocument] ===== HANDLER STARTED =====`
5. **Get driver ID** → From `req.body.driverId` or auth token
6. **Validate Stripe account** → Check if user has `stripeAccountId` in DB
7. **Upload front document** → Call `uploadToStripeFile()` → Get `frontFileId`
8. **Upload back document** (if provided) → Call `uploadToStripeFile()` → Get `backFileId`
9. **Attach documents** → Call `attachIdentityDocsToAccount()`
10. **Get status** → Call `getConnectStatusForDriver()`
11. **Send response** → `res.status(200).json({ success: true, ... })`
12. **Log completion** → `[UploadDocument] Response sent successfully`

**Response Format:**

```json
{
  "success": true,
  "message": "Verification documents uploaded successfully",
  "frontFileId": "file_xxxxx",
  "backFileId": "file_yyyyy", // optional
  "payoutsEnabled": false,
  "chargesEnabled": false,
  "currentlyDue": ["individual.verification.document"],
  "eventuallyDue": [],
  "pastDue": [],
  "disabledReason": null
}
```

---

## Frontend Setup

### 1. API Configuration

**File:** `Waypool/driver-app/config/api.ts`

**What it does:**

- Determines API URL based on platform (iOS/Android/Web)
- For iOS Simulator: `http://localhost:3000`
- For iOS Physical Device: `http://YOUR_IP:3000` (from `.env`)
- For Android Emulator: `http://10.0.2.2:3000`

**Check:**

- ✅ `EXPO_PUBLIC_API_URL_IOS_PHYSICAL` is set if using physical device
- ✅ Backend is accessible from device/simulator

---

### 2. Upload Document API Function

**File:** `Waypool/driver-app/services/api.ts`

**Function:** `uploadVerificationDocument(driverId, frontUri, backUri?)`

**Flow:**

1. **Create FormData**

   ```typescript
   const formData = new FormData();
   formData.append("driverId", driverId.toString());
   formData.append("front", {
     uri: frontUri,
     type: "image/jpeg",
     name: "front.jpg",
   });
   if (backUri) {
     formData.append("back", {
       uri: backUri,
       type: "image/jpeg",
       name: "back.jpg",
     });
   }
   ```

2. **Make fetch request**

   ```typescript
   const response = await fetch(url, {
     method: "POST",
     headers: {
       // Don't set Content-Type - let FormData set it
     },
     body: formData,
     signal: controller.signal, // 5-minute timeout
   });
   ```

3. **Parse response**
   ```typescript
   const result = await response.json();
   // Transform to ConnectRequirements format
   return {
     hasAccount: true,
     payoutsEnabled: result.payoutsEnabled,
     chargesEnabled: result.chargesEnabled,
     currentlyDue: result.currentlyDue || [],
     // ...
   };
   ```

---

### 3. Document Upload Screen

**File:** `Waypool/driver-app/app/payouts/document-upload.tsx`

**Flow:**

1. **User selects images** → `pickImageFromLibrary()` or `takePhotoWithCamera()`
2. **Images stored in state** → `frontImage` and `backImage`
3. **User clicks "Upload Documents"** → `handleUpload()` called
4. **Validation** → Check if `frontImage` exists
5. **Call API** → `uploadVerificationDocument(user.id, frontImage.uri, backImage?.uri)`
6. **On success** → `navigateToNextStep(user.id)`
7. **On error** → Show error message, stop spinner

---

## Complete Flow Step-by-Step

### Step 1: User Opens Payout Setup

**Screen:** `app/payouts/setup.tsx`

1. User clicks "Start Setup"
2. Frontend calls: `POST /api/driver/connect/custom/create`
3. Backend creates Stripe Custom account (if missing)
4. Backend returns: `{ stripeAccountId: "acct_xxxxx" }`
5. Frontend navigates to: `/payouts/personal-info`

**Backend Logs:**

```
[Stripe] Creating Custom connected account for driver X
[Stripe] Account created: acct_xxxxx
```

---

### Step 2: Personal Information

**Screen:** `app/payouts/personal-info.tsx`

1. User fills: First name, Last name, DOB, Phone, Address
2. User clicks "Continue"
3. Frontend calls: `POST /api/driver/connect/custom/update-individual`
4. Backend updates Stripe account with individual info
5. Frontend navigates to: `/payouts/identity`

**Backend Logs:**

```
[Stripe] Updating individual info for account acct_xxxxx
[Stripe] Individual info updated successfully
```

---

### Step 3: Identity Verification

**Screen:** `app/payouts/identity.tsx`

1. User enters: SSN last 4 digits (required), ID number (optional)
2. User clicks "Continue"
3. Frontend calls: `POST /api/driver/connect/custom/update-individual` (with SSN/ID)
4. Backend updates Stripe account with sensitive info
5. Frontend navigates to: `/payouts/bank-account`

**Backend Logs:**

```
[Stripe] Updating individual info (SSN/ID) for account acct_xxxxx
[Stripe] Sensitive info updated successfully
```

---

### Step 4: Bank Account

**Screen:** `app/payouts/bank-account.tsx`

1. User enters: Routing number, Account number, Account holder name
2. User clicks "Continue"
3. Frontend calls: `POST /api/driver/connect/custom/bank-token` → Creates token
4. Frontend calls: `POST /api/driver/connect/custom/attach-bank` → Attaches token
5. Frontend navigates to: `/payouts/document-upload`

**Backend Logs:**

```
[Stripe] Creating bank account token
[Stripe] Token created: tok_xxxxx
[Stripe] Attaching bank account to account acct_xxxxx
[Stripe] Bank account attached successfully
```

---

### Step 5: Document Upload ⚠️ (THIS IS WHERE IT'S FAILING)

**Screen:** `app/payouts/document-upload.tsx`

**Detailed Flow:**

#### 5.1 User Selects Images

1. User clicks "Select Front of ID"
2. `pickImageFromLibrary("front")` or `takePhotoWithCamera("front")` called
3. Image picker opens
4. User selects/captures image
5. Image URI stored in `frontImage` state
6. Preview shown on screen

**Frontend Logs:**

```
[DocumentUpload] pickImageFromLibrary called for front
[DocumentUpload] Selected image URI: file://...
```

#### 5.2 User Clicks "Upload Documents"

1. `handleUpload()` called
2. Validation: Check if `frontImage` exists
3. **API Call Starts:**
   ```typescript
   uploadVerificationDocument(user.id, frontImage.uri, backImage?.uri);
   ```

**Frontend Logs:**

```
[DocumentUpload] handleUpload called
[DocumentUpload] Starting upload process
[DocumentUpload] Calling uploadVerificationDocument
[DocumentUpload] Driver ID: 123
[uploadVerificationDocument] Starting upload for driver: 123
[uploadVerificationDocument] Front URI: file://...
[uploadVerificationDocument] Added front file: front.jpg
[uploadVerificationDocument] Making fetch request to: http://...
```

#### 5.3 Backend Receives Request

**Backend Logs (SHOULD APPEAR IMMEDIATELY):**

```
[UploadDocument] ===== REQUEST RECEIVED =====
[UploadDocument] Method: POST
[UploadDocument] URL: /api/driver/connect/custom/upload-document
[UploadDocument] Content-Type: multipart/form-data; boundary=...
[UploadDocument] Content-Length: 1234567
[UploadDocument] Timestamp: 2024-01-01T12:00:00.000Z
```

#### 5.4 Multer Processes Files

**Backend Logs:**

```
[UploadDocument] ===== AFTER MULTER =====
[UploadDocument] Body keys: ['driverId']
[UploadDocument] Files present: true
[UploadDocument] File fields: ['front', 'back']
[UploadDocument] Front file: front.jpg 1234567 bytes
[UploadDocument] Back file: back.jpg 987654 bytes
```

#### 5.5 Handler Processes Request

**Backend Logs:**

```
[UploadDocument] ===== HANDLER STARTED =====
[UploadDocument] Step 1: Getting driver ID
[UploadDocument] userIdFromRequest: 123
[UploadDocument] Step 2: Validating Stripe account
[UploadDocument] Step 3: Uploading front document to Stripe
[StripeIdentityDoc] Uploading file to Stripe Files API: front.jpg (image/jpeg, 1234567 bytes)
[StripeIdentityDoc] File uploaded successfully: file_xxxxx (took 2345ms)
[UploadDocument] Front document uploaded successfully: file_xxxxx
[UploadDocument] Step 4: Uploading back document to Stripe
[StripeIdentityDoc] Uploading file to Stripe Files API: back.jpg (image/jpeg, 987654 bytes)
[StripeIdentityDoc] File uploaded successfully: file_yyyyy (took 1987ms)
[UploadDocument] Back document uploaded successfully: file_yyyyy
[UploadDocument] Step 5: Attaching documents to Stripe account
[StripeIdentityDoc] Attaching documents to account acct_xxxxx (front: file_xxxxx, back: file_yyyyy)
[StripeIdentityDoc] Documents attached successfully in 1234ms
[UploadDocument] Documents attached to Stripe account successfully
[UploadDocument] Step 6: Retrieving updated connect status
[UploadDocument] Retrieved updated connect status
[UploadDocument] Successfully uploaded documents for driver 123 in 5566ms
[UploadDocument] Sending response: { success: true, frontFileId: 'file_xxxxx', ... }
[UploadDocument] Response sent successfully
```

#### 5.6 Frontend Receives Response

**Frontend Logs (SHOULD APPEAR AFTER BACKEND SENDS):**

```
[uploadVerificationDocument] Fetch completed
[uploadVerificationDocument] Response status: 200
[uploadVerificationDocument] Response ok: true
[uploadVerificationDocument] Response headers: { 'content-type': 'application/json', ... }
[uploadVerificationDocument] Upload successful: { success: true, frontFileId: 'file_xxxxx', ... }
[uploadVerificationDocument] Transformed response: { hasAccount: true, payoutsEnabled: false, ... }
[DocumentUpload] Upload successful, result: { hasAccount: true, ... }
[DocumentUpload] Navigating to next step
[DocumentUpload] Navigation complete
[DocumentUpload] Upload process finished, setting uploading to false
```

---

## Document Upload Flow (Detailed)

### Request Flow Diagram

```
┌─────────────────┐
│  Driver App     │
│  (React Native) │
└────────┬────────┘
         │
         │ 1. User selects images
         │    - frontImage.uri = "file://..."
         │    - backImage.uri = "file://..."
         │
         │ 2. User clicks "Upload Documents"
         │
         │ 3. handleUpload() called
         │    - setUploading(true)
         │    - Creates FormData
         │    - Appends front image
         │    - Appends back image (if exists)
         │
         │ 4. fetch() request
         │    POST /api/driver/connect/custom/upload-document
         │    Content-Type: multipart/form-data
         │    Body: FormData
         │
         ▼
┌─────────────────┐
│  Backend Server │
│  (Express)      │
└────────┬────────┘
         │
         │ 5. Request arrives
         │    - CORS middleware
         │    - express.json() (skipped for multipart)
         │
         │ 6. Multer middleware
         │    - Parses multipart/form-data
         │    - Stores files in memory
         │    - req.files.front[0] = { buffer, originalname, ... }
         │    - req.files.back[0] = { buffer, originalname, ... }
         │    - req.body.driverId = "123"
         │
         │ 7. Route handler
         │    - Get driverId from req.body or auth
         │    - Validate Stripe account exists
         │    - Extract files from req.files
         │
         │ 8. Upload to Stripe Files API
         │    stripe.files.create({
         │      purpose: "identity_document",
         │      file: { data: buffer, name: filename, type: mimetype }
         │    })
         │    Returns: file_xxxxx
         │
         │ 9. Attach to Stripe Account
         │    stripe.accounts.update(acctId, {
         │      individual: {
         │        verification: {
         │          document: {
         │            front: file_xxxxx,
         │            back: file_yyyyy
         │          }
         │        }
         │      }
         │    })
         │
         │ 10. Get updated status
         │     stripe.accounts.retrieve(acctId)
         │     Returns: { payoutsEnabled, chargesEnabled, requirements }
         │
         │ 11. Send response
         │     res.status(200).json({
         │       success: true,
         │       frontFileId: "file_xxxxx",
         │       backFileId: "file_yyyyy",
         │       payoutsEnabled: false,
         │       ...
         │     })
         │
         ▼
┌─────────────────┐
│  Driver App     │
│  (React Native) │
└────────┬────────┘
         │
         │ 12. Response received
         │     - response.status = 200
         │     - response.json() = { success: true, ... }
         │
         │ 13. Transform response
         │     - Convert to ConnectRequirements format
         │
         │ 14. Navigate to next step
         │     - navigateToNextStep(user.id)
         │     - Checks requirements
         │     - Routes to appropriate screen
         │
         │ 15. Stop spinner
         │     - setUploading(false)
```

---

## Debugging Checklist

### ✅ Backend Checks

1. **Is the backend running?**

   ```bash
   cd Waypool/backend
   npm run dev
   ```

   Should see: `🚀 Waypool Server is running on http://0.0.0.0:3000`

2. **Is the route registered?**

   - Check `Waypool/backend/src/routes/driver/index.ts`
   - Should include: `driverConnect.routes.ts`

3. **Are you seeing request logs?**

   - When you upload, you should IMMEDIATELY see:
     ```
     [UploadDocument] ===== REQUEST RECEIVED =====
     ```
   - If you DON'T see this → Request isn't reaching backend (network/URL issue)

4. **Are files being parsed?**

   - Should see:
     ```
     [UploadDocument] ===== AFTER MULTER =====
     [UploadDocument] Files present: true
     ```
   - If files are missing → Multer isn't parsing correctly

5. **Is Stripe configured?**

   - Check `.env` has `STRIPE_SECRET_KEY`
   - Check backend logs for: `[StripeIdentityDoc] Uploading file to Stripe Files API`

6. **Is response being sent?**
   - Should see:
     ```
     [UploadDocument] Response sent successfully
     ```
   - If you see this but frontend times out → Network/CORS issue

---

### ✅ Frontend Checks

1. **Is API URL correct?**

   - Check `Waypool/driver-app/config/api.ts`
   - For iOS Simulator: `http://localhost:3000`
   - For iOS Physical: `http://YOUR_IP:3000`
   - For Android Emulator: `http://10.0.2.2:3000`

2. **Can you reach the backend?**

   - Open browser on device/simulator
   - Navigate to: `http://YOUR_API_URL/health`
   - Should see: `{ "status": "ok", ... }`

3. **Are you seeing fetch logs?**

   - Should see:
     ```
     [uploadVerificationDocument] Making fetch request to: ...
     [uploadVerificationDocument] Fetch completed
     ```
   - If you DON'T see "Fetch completed" → Request is hanging

4. **What's the response status?**

   - Check logs for: `[uploadVerificationDocument] Response status: XXX`
   - 200 = Success
   - 400/500 = Error (check error message)

5. **Is the spinner stopping?**
   - Should see: `[DocumentUpload] Upload process finished, setting uploading to false`
   - If spinner never stops → Error isn't being caught

---

## Common Issues & Solutions

### Issue 1: Request Never Reaches Backend

**Symptoms:**

- No backend logs appear
- Frontend times out after 5 minutes
- No `[UploadDocument] ===== REQUEST RECEIVED =====` in backend

**Solutions:**

1. Check API URL in `config/api.ts`
2. Verify backend is running: `curl http://localhost:3000/health`
3. Check network connectivity (device on same network as computer)
4. For physical device: Use computer's IP address, not `localhost`

---

### Issue 2: Multer Not Parsing Files

**Symptoms:**

- Backend logs show: `[UploadDocument] Files present: false`
- Error: "Front document is required"

**Solutions:**

1. Check `Content-Type` header (should be `multipart/form-data`)
2. Verify FormData is created correctly in frontend
3. Check multer configuration in `middleware/upload.ts`
4. Ensure file size is under 10MB

---

### Issue 3: Stripe API Calls Failing

**Symptoms:**

- Backend logs show: `[StripeIdentityDoc] Error uploading file`
- Error: `oauth_not_supported` or `StripePermissionError`

**Solutions:**

1. Verify `STRIPE_SECRET_KEY` is platform key (starts with `sk_test_` or `sk_live_`)
2. Ensure NO `stripeAccount` header is set in Stripe client
3. Check Stripe API version matches: `2025-12-15.clover`
4. Verify account type is "custom" (not "express")

---

### Issue 4: Response Sent But Frontend Times Out

**Symptoms:**

- Backend logs show: `[UploadDocument] Response sent successfully`
- Frontend still times out
- No response received in frontend

**Solutions:**

1. Check CORS configuration in `backend/src/index.ts`
2. Verify response headers are being sent
3. Check network tab in React Native debugger
4. Try increasing timeout in frontend (already set to 5 minutes)
5. Check if response is too large (shouldn't be for this endpoint)

---

### Issue 5: Response Format Mismatch

**Symptoms:**

- Response received but frontend throws error
- Error: "Cannot read property X of undefined"

**Solutions:**

1. Check response format matches `ConnectRequirements` interface
2. Verify transformation in `uploadVerificationDocument()` function
3. Check backend response includes all required fields
4. Ensure arrays are never `undefined` (use `|| []`)

---

## Step-by-Step Debug Process

### When Document Upload Fails:

1. **Check Backend Logs First**

   ```
   Look for: [UploadDocument] ===== REQUEST RECEIVED =====
   ```

   - ✅ If you see this → Request reached backend, continue to step 2
   - ❌ If you DON'T see this → Network/URL issue, fix API URL

2. **Check Multer Processing**

   ```
   Look for: [UploadDocument] ===== AFTER MULTER =====
   Look for: [UploadDocument] Files present: true
   ```

   - ✅ If files present → Continue to step 3
   - ❌ If files missing → Multer issue, check FormData format

3. **Check Stripe Upload**

   ```
   Look for: [StripeIdentityDoc] Uploading file to Stripe Files API
   Look for: [StripeIdentityDoc] File uploaded successfully
   ```

   - ✅ If uploaded → Continue to step 4
   - ❌ If error → Stripe configuration issue

4. **Check Document Attachment**

   ```
   Look for: [StripeIdentityDoc] Attaching documents to account
   Look for: [StripeIdentityDoc] Documents attached successfully
   ```

   - ✅ If attached → Continue to step 5
   - ❌ If error → Stripe API issue

5. **Check Response Sent**

   ```
   Look for: [UploadDocument] Response sent successfully
   ```

   - ✅ If sent → Check frontend logs
   - ❌ If not sent → Error in response building

6. **Check Frontend Receives**
   ```
   Look for: [uploadVerificationDocument] Fetch completed
   Look for: [uploadVerificationDocument] Response status: 200
   ```
   - ✅ If received → Check response parsing
   - ❌ If timeout → Network/CORS issue

---

## Quick Test Commands

### Test Backend Endpoint Directly

```bash
# Test with curl (replace with your actual values)
curl -X POST http://localhost:3000/api/driver/connect/custom/upload-document \
  -F "driverId=123" \
  -F "front=@/path/to/front.jpg" \
  -F "back=@/path/to/back.jpg" \
  -H "Content-Type: multipart/form-data"
```

### Check Backend Health

```bash
curl http://localhost:3000/health
```

### Check Stripe Configuration

```bash
# In backend directory
node -e "require('dotenv').config(); console.log(process.env.STRIPE_SECRET_KEY ? 'Stripe key found' : 'Stripe key missing')"
```

---

## Expected Log Sequence (Success Case)

### Backend:

```
[UploadDocument] ===== REQUEST RECEIVED =====
[UploadDocument] ===== AFTER MULTER =====
[UploadDocument] ===== HANDLER STARTED =====
[StripeIdentityDoc] Uploading file to Stripe Files API: front.jpg
[StripeIdentityDoc] File uploaded successfully: file_xxxxx
[StripeIdentityDoc] Uploading file to Stripe Files API: back.jpg
[StripeIdentityDoc] File uploaded successfully: file_yyyyy
[StripeIdentityDoc] Attaching documents to account acct_xxxxx
[StripeIdentityDoc] Documents attached successfully
[UploadDocument] Response sent successfully
```

### Frontend:

```
[uploadVerificationDocument] Making fetch request to: ...
[uploadVerificationDocument] Fetch completed
[uploadVerificationDocument] Response status: 200
[uploadVerificationDocument] Upload successful: {...}
[DocumentUpload] Upload successful, result: {...}
[DocumentUpload] Navigating to next step
```

---

## Next Steps

1. **Try uploading again** and copy ALL logs from both backend and frontend
2. **Compare your logs** to the expected sequence above
3. **Identify where it stops** - that's where the issue is
4. **Share the logs** and I can help pinpoint the exact problem

The logs will tell us exactly where the flow is breaking!
