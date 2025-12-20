/**
 * Stripe Identity Document Service
 * Handles uploading identity documents to Stripe Files API
 * and attaching them to connected accounts
 */

import Stripe from "stripe";
import { stripe } from "../lib/stripe";
import { prisma } from "../lib/prisma";
import type { Express } from "express";
import sharp from "sharp";
import * as https from "https";
import * as crypto from "crypto";

export interface ConnectStatus {
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  currentlyDue: string[];
  eventuallyDue: string[];
  pastDue: string[];
  disabledReason: string | null;
}

/**
 * Upload a file to Stripe Files API with purpose: "identity_document"
 * @param file - Express.Multer.File object
 * @returns Stripe file ID
 */
export async function uploadToStripeIdentityFile(
  file: Express.Multer.File
): Promise<string> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  // Log original file metadata
  const originalSize = file.size;
  console.log(
    `[StripeIdentityDoc] Original file: ${file.originalname} (${
      file.mimetype
    }, ${(originalSize / 1024).toFixed(2)} KB)`
  );

  // Compress/resize image to reduce file size before uploading
  // Target: max 500KB, max dimensions 2000x2000px, quality 85%
  let processedBuffer: Buffer;
  let processedMimetype = file.mimetype;

  try {
    console.log(`[StripeIdentityDoc] 🗜️  Compressing/resizing image...`);
    const compressStart = Date.now();

    // Use sharp to fix orientation, resize and compress
    processedBuffer = await sharp(file.buffer)
      .rotate() // ✅ Fixes iPhone EXIF orientation
      .resize(1500, 1500, {
        fit: "inside",
        withoutEnlargement: true, // Don't enlarge if smaller than 1500x1500
      })
      .jpeg({ quality: 80, mozjpeg: true }) // 80% quality for smaller file size
      .toBuffer();

    processedMimetype = "image/jpeg"; // Always output as JPEG for consistency
    const compressDuration = Date.now() - compressStart;
    const compressionRatio = (
      (1 - processedBuffer.length / originalSize) *
      100
    ).toFixed(1);

    console.log(
      `[StripeIdentityDoc] ✅ Image compressed: ${(originalSize / 1024).toFixed(
        2
      )} KB → ${(processedBuffer.length / 1024).toFixed(
        2
      )} KB (${compressionRatio}% reduction, took ${compressDuration}ms)`
    );

    // If compression didn't help much or made it larger, use original
    if (processedBuffer.length >= originalSize) {
      console.log(
        `[StripeIdentityDoc] ⚠️  Compression didn't reduce size, using original`
      );
      processedBuffer = file.buffer;
      processedMimetype = file.mimetype;
    }
  } catch (compressError: any) {
    console.warn(
      `[StripeIdentityDoc] ⚠️  Image compression failed, using original:`,
      compressError?.message
    );
    // If compression fails, use original buffer
    processedBuffer = file.buffer;
    processedMimetype = file.mimetype;
  }

  // Prepare safe filename
  const safeFileName = file.originalname.replace(/\.[^/.]+$/, ".jpg");

  // Add detailed logging before the API call
  const uploadStartTime = Date.now();
  console.log(
    `[StripeIdentityDoc] 🚀 About to upload to files.stripe.com via direct HTTP at ${new Date().toISOString()}`
  );
  console.log(
    `[StripeIdentityDoc] File details: name="${safeFileName}", type="${processedMimetype}", size=${processedBuffer.length} bytes`
  );

  // Call Stripe Files API via direct HTTP request to files.stripe.com
  // This bypasses SDK issues when files.stripe.com is blocked by firewalls/VPNs
  // We use direct HTTPS multipart/form-data request instead of SDK
  try {
    console.log(
      `[StripeIdentityDoc] 📤 Uploading to files.stripe.com via direct HTTP (${processedBuffer.length} bytes)...`
    );

    // Get Stripe secret key
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    // Create multipart form-data boundary
    const boundary = `----formdata-${crypto.randomBytes(16).toString("hex")}`;
    
    // Build multipart form-data body
    const formParts: Buffer[] = [];
    
    // Add purpose field
    formParts.push(Buffer.from(`--${boundary}\r\n`));
    formParts.push(Buffer.from(`Content-Disposition: form-data; name="purpose"\r\n\r\n`));
    formParts.push(Buffer.from(`identity_document\r\n`));
    
    // Add file field
    formParts.push(Buffer.from(`--${boundary}\r\n`));
    formParts.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${safeFileName}"\r\n`));
    formParts.push(Buffer.from(`Content-Type: ${processedMimetype}\r\n\r\n`));
    formParts.push(processedBuffer);
    formParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    
    const formBody = Buffer.concat(formParts);
    
    // Make HTTPS request to files.stripe.com
    const fileId = await new Promise<string>((resolve, reject) => {
      const options = {
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
      };

      const req = https.request(options, (res) => {
        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk.toString();
        });

        res.on("end", () => {
          const uploadDuration = Date.now() - uploadStartTime;
          
          if (res.statusCode !== 200) {
            let errorMessage = `HTTP ${res.statusCode}`;
            try {
              const errorJson = JSON.parse(responseData);
              errorMessage = errorJson.error?.message || errorMessage;
            } catch {
              errorMessage = responseData || errorMessage;
            }
            
            console.error(
              `[StripeIdentityDoc] ❌ Upload failed after ${uploadDuration}ms: ${errorMessage}`
            );
            reject(new Error(`Stripe file upload failed: ${errorMessage}`));
            return;
          }

          try {
            const result = JSON.parse(responseData);
            console.log(
              `[StripeIdentityDoc] ✅ File uploaded successfully: ${result.id} (took ${uploadDuration}ms)`
            );
            resolve(result.id);
          } catch (parseError) {
            console.error(
              `[StripeIdentityDoc] ❌ Failed to parse response after ${uploadDuration}ms:`,
              responseData
            );
            reject(new Error("Failed to parse Stripe response"));
          }
        });
      });

      req.on("error", (error) => {
        const uploadDuration = Date.now() - uploadStartTime;
        console.error(
          `[StripeIdentityDoc] ❌ Network error after ${uploadDuration}ms:`,
          error.message
        );
        reject(error);
      });

      req.on("timeout", () => {
        req.destroy();
        const uploadDuration = Date.now() - uploadStartTime;
        console.error(
          `[StripeIdentityDoc] ❌ Upload timed out after ${uploadDuration}ms`
        );
        reject(new Error("Upload request timed out"));
      });

      // Write form data
      req.write(formBody);
      req.end();
    });

    // Return file ID (we already logged success above)
    return fileId;
  } catch (error: any) {
    const uploadDuration = Date.now() - uploadStartTime;

    // Improved error logging
    console.error(
      `[StripeIdentityDoc] ❌ File upload failed after ${uploadDuration}ms:`,
      {
        message: error?.message,
        code: error?.code,
        name: error?.name,
      }
    );

    throw error;
  }
}

/**
 * Attach identity documents to a connected account
 * @param stripeAccountId - Stripe connected account ID
 * @param frontFileId - Stripe file ID for front of document
 * @param backFileId - Optional Stripe file ID for back of document
 */
export async function attachIdentityDocsToAccount(
  stripeAccountId: string,
  frontFileId: string,
  backFileId?: string
): Promise<void> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  console.log(
    `[StripeIdentityDoc] Attaching documents to account ${stripeAccountId} ` +
      `(front: ${frontFileId}, back: ${backFileId || "none"})`
  );

  // MUST use platform context (no stripeAccount header)
  // Since we're using the platform secret key, we don't need to pass options
  await stripe.accounts.update(stripeAccountId, {
    individual: {
      verification: {
        document: {
          front: frontFileId,
          ...(backFileId && { back: backFileId }),
        },
      },
    },
  });

  console.log(
    `[StripeIdentityDoc] ✅ Documents attached successfully to account ${stripeAccountId}`
  );
}

/**
 * Get connect status for a connected account
 * @param stripeAccountId - Stripe connected account ID
 * @returns Connect status with requirements
 */
export async function getConnectStatus(
  stripeAccountId: string
): Promise<ConnectStatus> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  // Retrieve account details - MUST use platform context
  const account = await stripe.accounts.retrieve(stripeAccountId);

  const requirements = account.requirements;

  return {
    payoutsEnabled: account.payouts_enabled || false, // ✅ Use payouts_enabled, not capabilities.transfers
    chargesEnabled: account.charges_enabled || false,
    currentlyDue: (requirements?.currently_due || []) as string[],
    eventuallyDue: (requirements?.eventually_due || []) as string[],
    pastDue: (requirements?.past_due || []) as string[],
    disabledReason: requirements?.disabled_reason || null,
  };
}

/**
 * Get connect status for a driver user
 * @param driverUserId - Driver user ID
 * @returns Connect status with requirements
 */
export async function getConnectStatusForDriver(
  driverUserId: number
): Promise<ConnectStatus> {
  const user = await prisma.users.findUnique({
    where: { id: driverUserId },
    select: {
      stripeAccountId: true,
    },
  });

  if (!user || !user.stripeAccountId) {
    throw new Error(
      "Stripe account not found. Please create an account first."
    );
  }

  return getConnectStatus(user.stripeAccountId);
}
