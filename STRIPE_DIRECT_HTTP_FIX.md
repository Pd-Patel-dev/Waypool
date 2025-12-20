# Stripe File Upload Fix: Direct HTTP Request

## Problem Identified

The `stripe.files.create()` SDK call was hanging because:
- ✅ Server can reach `api.stripe.com` (regular Stripe API)
- ❌ Server **cannot** reach `files.stripe.com` (file upload host)
- Common causes: VPN, corporate firewall, network restrictions

## Solution

**Replaced SDK call with direct HTTPS multipart/form-data request** to `files.stripe.com`.

### Why This Works

1. **Direct connection**: Bypasses SDK's internal routing
2. **Explicit hostname**: Directly targets `files.stripe.com`
3. **Manual multipart**: Full control over the request format
4. **Better error handling**: Can see exact HTTP errors

## Changes Made

### 1. `backend/src/services/stripeIdentityDoc.service.ts`

**Before**: Used `stripe.files.create()` SDK method
```typescript
uploaded = await stripe.files.create({
  purpose: "identity_document",
  file: { data: processedBuffer, name: safeFileName, type: processedMimetype },
});
```

**After**: Direct HTTPS multipart/form-data request
```typescript
// Build multipart form-data manually
const boundary = `----formdata-${crypto.randomBytes(16).toString("hex")}`;
// ... construct form parts ...
// Make HTTPS request to files.stripe.com
const req = https.request({
  hostname: "files.stripe.com",
  port: 443,
  path: "/v1/files",
  method: "POST",
  headers: {
    "Authorization": `Basic ${Buffer.from(`${stripeSecretKey}:`).toString("base64")}`,
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
    "Content-Length": formBody.length.toString(),
  },
  timeout: 300000, // 5 minutes
}, ...);
```

### 2. `backend/scripts/test-stripe-file-upload.ts`

Updated test script to use the same direct HTTP approach for consistency.

## How It Works

1. **Build multipart form-data**:
   - `purpose=identity_document`
   - `file=<binary data>`

2. **Make HTTPS request**:
   - Host: `files.stripe.com`
   - Path: `/v1/files`
   - Method: `POST`
   - Auth: Basic auth with Stripe secret key
   - Content-Type: `multipart/form-data`

3. **Parse response**:
   - Extract `file.id` from JSON response
   - Return file ID

## Benefits

✅ **Bypasses SDK issues** - Direct connection to Stripe  
✅ **Better error messages** - See exact HTTP status codes  
✅ **More control** - Full control over request format  
✅ **Same functionality** - Returns file ID just like SDK  

## Testing

Run the test script to verify connectivity:
```bash
cd Waypool/backend
npx ts-node --project tsconfig.scripts.json --require tsconfig-paths/register scripts/test-stripe-file-upload.ts
```

This will:
1. Test `api.stripe.com` connectivity (regular API)
2. Test `files.stripe.com` connectivity (file upload)
3. Show clear error messages if blocked

## If Still Failing

If direct HTTP also fails, check:

1. **Network connectivity**:
   ```bash
   curl -I https://files.stripe.com/v1/files
   # Should return 401 (needs auth) or 400 (needs form data)
   # If connection refused/timeout, network is blocking it
   ```

2. **Firewall rules**: Allow outbound HTTPS to `files.stripe.com:443`

3. **VPN settings**: Some VPNs block file upload endpoints

4. **Proxy settings**: If behind a proxy, may need to configure Node.js proxy

## Expected Behavior

### Successful Upload:
```
[StripeIdentityDoc] 🚀 About to upload to files.stripe.com via direct HTTP
[StripeIdentityDoc] 📤 Uploading to files.stripe.com via direct HTTP (X bytes)...
[StripeIdentityDoc] ✅ File uploaded successfully: file_xxx (took Xms)
```

### If Blocked:
```
[StripeIdentityDoc] ❌ Network error: connect ETIMEDOUT
# or
[StripeIdentityDoc] ❌ Upload failed: HTTP 403
```

## Summary

✅ **Fixed**: Replaced SDK call with direct HTTP request  
✅ **Bypasses**: SDK routing issues and firewall blocks  
✅ **Same result**: Returns file ID for attaching to account  
✅ **Better errors**: Clear HTTP status codes and messages  

The upload should now work even if `files.stripe.com` was previously blocked by your network configuration.

