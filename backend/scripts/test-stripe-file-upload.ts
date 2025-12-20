/**
 * Test Stripe File Upload
 * Diagnostic script to test if Stripe Files API is working
 * Usage: npx ts-node --project tsconfig.scripts.json --require tsconfig-paths/register scripts/test-stripe-file-upload.ts
 */

import "dotenv/config";
import { stripe } from "../src/lib/stripe";
import * as fs from "fs";
import * as path from "path";

async function testStripeFileUpload() {
  if (!stripe) {
    console.error("❌ Stripe is not configured");
    process.exit(1);
  }

  console.log("🧪 Testing Stripe File Upload\n");

  // Test 1: Check Stripe connectivity
  console.log("Test 1: Checking Stripe API connectivity...");
  try {
    const balance = await stripe.balance.retrieve({}, { timeout: 5000 });
    console.log("✅ Stripe API is reachable");
    console.log(
      `   Available: ${balance.available[0]?.amount || 0} ${
        balance.available[0]?.currency || "usd"
      }\n`
    );
  } catch (error: any) {
    console.error("❌ Cannot reach Stripe API:", error.message);
    process.exit(1);
  }

  // Test 2: Create a test image buffer (small test image)
  console.log("Test 2: Creating test image...");
  const testImageBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );
  console.log(`✅ Test image created (${testImageBuffer.length} bytes)\n`);

  // Test 3: Upload to Stripe Files API via direct HTTP
  console.log("Test 3: Uploading to files.stripe.com via direct HTTP...");
  console.log("   Using direct HTTPS multipart/form-data request");
  console.log("   This bypasses SDK issues with blocked file upload hosts");

  const uploadStart = Date.now();
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    // Use direct HTTP request (same as production code)
    const https = require("https");
    const crypto = require("crypto");

    const boundary = `----formdata-${crypto.randomBytes(16).toString("hex")}`;
    const formParts: Buffer[] = [];

    formParts.push(Buffer.from(`--${boundary}\r\n`));
    formParts.push(
      Buffer.from(`Content-Disposition: form-data; name="purpose"\r\n\r\n`)
    );
    formParts.push(Buffer.from(`identity_document\r\n`));

    formParts.push(Buffer.from(`--${boundary}\r\n`));
    formParts.push(
      Buffer.from(
        `Content-Disposition: form-data; name="file"; filename="test-image.png"\r\n`
      )
    );
    formParts.push(Buffer.from(`Content-Type: image/png\r\n\r\n`));
    formParts.push(testImageBuffer);
    formParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const formBody = Buffer.concat(formParts);

    const fileId = await new Promise<string>((resolve, reject) => {
      const options = {
        hostname: "files.stripe.com",
        port: 443,
        path: "/v1/files",
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${stripeSecretKey}:`).toString(
            "base64"
          )}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": formBody.length.toString(),
        },
        timeout: 30000, // 30 seconds for test
      };

      const req = https.request(options, (res) => {
        let responseData = "";

        res.on("data", (chunk) => {
          responseData += chunk.toString();
        });

        res.on("end", () => {
          if (res.statusCode !== 200) {
            let errorMessage = `HTTP ${res.statusCode}`;
            try {
              const errorJson = JSON.parse(responseData);
              errorMessage = errorJson.error?.message || errorMessage;
            } catch {
              errorMessage = responseData || errorMessage;
            }
            reject(new Error(errorMessage));
            return;
          }

          try {
            const result = JSON.parse(responseData);
            resolve(result.id);
          } catch {
            reject(new Error("Failed to parse response"));
          }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timed out"));
      });

      req.write(formBody);
      req.end();
    });

    const uploadDuration = Date.now() - uploadStart;
    console.log(`✅ File uploaded successfully!`);
    console.log(`   File ID: ${fileId}`);
    console.log(`   Duration: ${uploadDuration}ms\n`);

    console.log("✅ All tests passed! Stripe file upload is working.\n");
  } catch (error: any) {
    const uploadDuration = Date.now() - uploadStart;
    console.error(`❌ File upload failed after ${uploadDuration}ms:`);
    console.error(`   Message: ${error?.message}`);
    console.error(`\n   This usually means:`);
    console.error(`   - files.stripe.com is blocked by firewall/VPN`);
    console.error(`   - Network connectivity issue`);
    console.error(`   - Invalid Stripe API key`);
    console.error("\n❌ Stripe file upload is NOT working.\n");
    process.exit(1);
  }
}

// Run the test
testStripeFileUpload().catch((error) => {
  console.error("❌ Test script error:", error);
  process.exit(1);
});
