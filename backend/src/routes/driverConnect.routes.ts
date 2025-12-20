/**
 * Stripe Connect Custom Account Routes
 * API-based onboarding for driver payouts
 */

import express, { Request, Response } from "express";
import {
  sendSuccess,
  sendBadRequest,
  sendUnauthorized,
  sendInternalError,
} from "../utils/apiResponse";
import { getUserIdFromRequest } from "../middleware/testModeAuth";
import { getValidatedUserId } from "../utils/testMode";
import {
  getOrCreateCustomConnectedAccount,
  retrieveConnectStatus,
  updateIndividualInfo,
  createBankAccountToken,
  attachExternalBankAccount,
  clearBusinessProfile,
  type IndividualInfoPayload,
  type BankAccountTokenPayload,
} from "../services/stripeConnectCustom.service";
import {
  uploadIdDocs,
  type MulterRequest,
} from "../middleware/upload";
import {
  uploadToStripeIdentityFile,
  attachIdentityDocsToAccount,
  getConnectStatus,
} from "../services/stripeIdentityDoc.service";
import { prisma } from "../lib/prisma";

const router = express.Router();

/**
 * POST /api/driver/connect/custom/create
 * Creates Custom connected account if missing
 */
router.post("/custom/create", async (req: Request, res: Response) => {
  try {
    const userIdFromRequest = getUserIdFromRequest(req);
    const driverId = getValidatedUserId(
      req.body.driverId
        ? parseInt(req.body.driverId as string)
        : userIdFromRequest,
      "driver"
    );

    if (!driverId) {
      return sendUnauthorized(res, "Driver authentication required");
    }

    // Get client IP for TOS acceptance
    const requestIp = req.ip || req.socket.remoteAddress || "127.0.0.1";

    const stripeAccountId = await getOrCreateCustomConnectedAccount(
      driverId,
      requestIp
    );

    return sendSuccess(res, "Stripe Connect Custom account created", {
      stripeAccountId,
    });
  } catch (error: any) {
    console.error("Error creating Custom account:", error);
    return sendInternalError(
      res,
      error as Error,
      "Failed to create Stripe account"
    );
  }
});

/**
 * GET /api/driver/connect/requirements
 * Returns account status and requirements
 */
router.get("/requirements", async (req: Request, res: Response) => {
  try {
    const userIdFromRequest = getUserIdFromRequest(req);
    const driverId = getValidatedUserId(
      req.query.driverId
        ? parseInt(req.query.driverId as string)
        : userIdFromRequest,
      "driver"
    );

    if (!driverId) {
      return sendUnauthorized(res, "Driver authentication required");
    }

    const status = await retrieveConnectStatus(driverId);

    return sendSuccess(res, "Requirements retrieved", {
      hasAccount: status.hasAccount,
      stripeAccountId: status.stripeAccountId,
      payoutsEnabled: status.payoutsEnabled,
      chargesEnabled: status.chargesEnabled,
      currentlyDue: status.currentlyDue,
      eventuallyDue: status.eventuallyDue,
      pastDue: status.pastDue,
      disabledReason: status.disabledReason,
    });
  } catch (error: any) {
    console.error("Error retrieving requirements:", error);
    return sendInternalError(
      res,
      error as Error,
      "Failed to retrieve requirements"
    );
  }
});

/**
 * GET /api/driver/connect/account-details
 * Returns detailed account information including Stripe Dashboard URL
 */
router.get("/account-details", async (req: Request, res: Response) => {
  try {
    const userIdFromRequest = getUserIdFromRequest(req);
    const driverId = getValidatedUserId(
      req.query.driverId
        ? parseInt(req.query.driverId as string)
        : userIdFromRequest,
      "driver"
    );

    if (!driverId) {
      return sendUnauthorized(res, "Driver authentication required");
    }

    const { getOrCreateCustomConnectedAccount } = await import(
      "../services/stripeConnectCustom.service"
    );
    const { stripe } = await import("../lib/stripe");
    const { prisma } = await import("../lib/prisma");

    // Get or create account
    const requestIp = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const stripeAccountId = await getOrCreateCustomConnectedAccount(
      driverId,
      requestIp
    );

    if (!stripe || !stripeAccountId) {
      return sendBadRequest(res, "Stripe account not found");
    }

    // Retrieve full account details from Stripe
    const account = await stripe.accounts.retrieve(stripeAccountId);

    // Get user email for reference
    const user = await prisma.users.findUnique({
      where: { id: driverId },
      select: { email: true },
    });

    // Determine Stripe Dashboard URL based on mode
    const isTestMode = process.env.STRIPE_SECRET_KEY?.includes("sk_test");
    const dashboardBaseUrl = isTestMode
      ? "https://dashboard.stripe.com/test"
      : "https://dashboard.stripe.com";
    const dashboardUrl = `${dashboardBaseUrl}/connect/accounts/${stripeAccountId}`;

    return sendSuccess(res, "Account details retrieved", {
      stripeAccountId: account.id,
      email: account.email || user?.email,
      type: account.type,
      country: account.country,
      businessType: account.business_type,
      payoutsEnabled: account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      capabilities: account.capabilities,
      requirements: {
        currentlyDue: account.requirements?.currently_due || [],
        pastDue: account.requirements?.past_due || [],
        eventuallyDue: account.requirements?.eventually_due || [],
        disabledReason: account.requirements?.disabled_reason,
      },
      dashboardUrl, // Direct link to view account in Stripe Dashboard
      createdAt: account.created,
      metadata: account.metadata,
    });
  } catch (error: any) {
    console.error("Error retrieving account details:", error);
    return sendInternalError(
      res,
      error as Error,
      "Failed to retrieve account details"
    );
  }
});

/**
 * POST /api/driver/connect/custom/update-individual
 * Updates individual information on connected account
 */
router.post(
  "/custom/update-individual",
  async (req: Request, res: Response) => {
    try {
      const userIdFromRequest = getUserIdFromRequest(req);
      const driverId = getValidatedUserId(
        req.body.driverId
          ? parseInt(req.body.driverId as string)
          : userIdFromRequest,
        "driver"
      );

      if (!driverId) {
        return sendUnauthorized(res, "Driver authentication required");
      }

      // Validate required fields
      const { firstName, lastName, phone, dob, address, ssnLast4, idNumber } =
        req.body;

      if (!firstName || !lastName || !phone || !dob || !address) {
        return sendBadRequest(
          res,
          "Missing required fields: firstName, lastName, phone, dob, address"
        );
      }

      if (!dob.day || !dob.month || !dob.year) {
        return sendBadRequest(res, "DOB must include day, month, and year");
      }

      if (
        !address.line1 ||
        !address.city ||
        !address.state ||
        !address.postalCode
      ) {
        return sendBadRequest(
          res,
          "Address must include line1, city, state, and postalCode"
        );
      }

      const payload: IndividualInfoPayload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        dob: {
          day: parseInt(dob.day),
          month: parseInt(dob.month),
          year: parseInt(dob.year),
        },
        address: {
          line1: address.line1.trim(),
          line2: address.line2?.trim(),
          city: address.city.trim(),
          state: address.state.trim(),
          postalCode: address.postalCode.trim(),
        },
        ssnLast4: ssnLast4?.trim(),
        idNumber: idNumber?.trim(),
      };

      // Validate SSN last 4 if provided
      if (payload.ssnLast4 && !/^\d{4}$/.test(payload.ssnLast4)) {
        return sendBadRequest(res, "SSN last 4 must be exactly 4 digits");
      }

      const status = await updateIndividualInfo(driverId, payload);

      return sendSuccess(res, "Individual information updated", {
        payoutsEnabled: status.payoutsEnabled,
        chargesEnabled: status.chargesEnabled,
        currentlyDue: status.currentlyDue,
        eventuallyDue: status.eventuallyDue,
        pastDue: status.pastDue,
        disabledReason: status.disabledReason,
      });
    } catch (error: any) {
      console.error("Error updating individual info:", error);

      // Handle Stripe permission errors with clear message
      if (
        error.code === "oauth_not_supported" ||
        error.type === "StripePermissionError" ||
        error.message?.includes("Stripe onboarding call was made with connected account context")
      ) {
        return sendBadRequest(
          res,
          "Stripe onboarding call was made with connected account context. " +
          "Ensure platform key is used and Stripe-Account header is not set."
        );
      }

      // Don't log sensitive data
      if (
        error.message?.includes("SSN") ||
        error.message?.includes("account")
      ) {
        return sendBadRequest(
          res,
          "Verification failed. Please check your information and try again."
        );
      }

      return sendInternalError(
        res,
        error as Error,
        "Failed to update individual information"
      );
    }
  }
);

/**
 * POST /api/driver/connect/custom/bank-token
 * Creates a bank account token (does not store sensitive data)
 */
router.post("/custom/bank-token", async (req: Request, res: Response) => {
  try {
    const userIdFromRequest = getUserIdFromRequest(req);
    const driverId = getValidatedUserId(
      req.body.driverId
        ? parseInt(req.body.driverId as string)
        : userIdFromRequest,
      "driver"
    );

    if (!driverId) {
      return sendUnauthorized(res, "Driver authentication required");
    }

    const { routingNumber, accountNumber, accountHolderName } = req.body;

    // Validate required fields
    if (!routingNumber || !accountNumber || !accountHolderName) {
      return sendBadRequest(
        res,
        "Missing required fields: routingNumber, accountNumber, accountHolderName"
      );
    }

    // Validate routing number (9 digits)
    if (!/^\d{9}$/.test(routingNumber.trim())) {
      return sendBadRequest(res, "Routing number must be exactly 9 digits");
    }

    // Validate account number (minimum 4 digits)
    if (!/^\d{4,}$/.test(accountNumber.trim())) {
      return sendBadRequest(res, "Account number must be at least 4 digits");
    }

    const payload: BankAccountTokenPayload = {
      routingNumber: routingNumber.trim(),
      accountNumber: accountNumber.trim(),
      accountHolderName: accountHolderName.trim(),
    };

    // Create token (sensitive data never stored in DB)
    const { tokenId } = await createBankAccountToken(payload);

    return sendSuccess(res, "Bank account token created", {
      tokenId,
    });
  } catch (error: any) {
    console.error("Error creating bank token:", error);

    // Handle Stripe permission errors
    if (
      error.code === "oauth_not_supported" ||
      error.type === "StripePermissionError" ||
      error.message?.includes("Stripe onboarding call was made with connected account context")
    ) {
      return sendBadRequest(
        res,
        "Stripe onboarding call was made with connected account context. " +
        "Ensure platform key is used and Stripe-Account header is not set."
      );
    }

    // User-friendly error messages
    if (
      error.message?.includes("routing_number") ||
      error.message?.includes("invalid")
    ) {
      return sendBadRequest(
        res,
        "Bank account invalid. Please check your routing and account numbers."
      );
    }

    return sendInternalError(
      res,
      error as Error,
      "Failed to create bank account token"
    );
  }
});

/**
 * POST /api/driver/connect/custom/attach-bank
 * Attaches bank account to connected account
 */
router.post("/custom/attach-bank", async (req: Request, res: Response) => {
  try {
    const userIdFromRequest = getUserIdFromRequest(req);
    const driverId = getValidatedUserId(
      req.body.driverId
        ? parseInt(req.body.driverId as string)
        : userIdFromRequest,
      "driver"
    );

    if (!driverId) {
      return sendUnauthorized(res, "Driver authentication required");
    }

    const { tokenId } = req.body;

    if (!tokenId) {
      return sendBadRequest(res, "tokenId is required");
    }

    const status = await attachExternalBankAccount(driverId, tokenId);

    return sendSuccess(res, "Bank account attached", {
      payoutsEnabled: status.payoutsEnabled,
      chargesEnabled: status.chargesEnabled,
      currentlyDue: status.currentlyDue,
      eventuallyDue: status.eventuallyDue,
      pastDue: status.pastDue,
      disabledReason: status.disabledReason,
    });
  } catch (error: any) {
    console.error("Error attaching bank account:", error);

    // Handle Stripe permission errors
    if (
      error.code === "oauth_not_supported" ||
      error.type === "StripePermissionError" ||
      error.message?.includes("Stripe onboarding call was made with connected account context")
    ) {
      return sendBadRequest(
        res,
        "Stripe onboarding call was made with connected account context. " +
        "Ensure platform key is used and Stripe-Account header is not set."
      );
    }

    if (error.message?.includes("invalid") || error.message?.includes("bank")) {
      return sendBadRequest(
        res,
        "Bank account invalid. Please verify your account information."
      );
    }

    return sendInternalError(
      res,
      error as Error,
      "Failed to attach bank account"
    );
  }
});

/**
 * POST /api/driver/connect/custom/upload-document
 * Uploads verification documents (multipart/form-data)
 * 
 * Body (multipart/form-data):
 * - front: File (required) - Front of identity document
 * - back: File (optional) - Back of identity document
 * - driverId: string (optional) - Driver ID (if not in auth token)
 * 
 * Returns:
 * {
 *   success: true,
 *   frontFileId: string,
 *   backFileId?: string,
 *   payoutsEnabled: boolean,
 *   chargesEnabled: boolean,
 *   currentlyDue: string[],
 *   eventuallyDue: string[],
 *   pastDue: string[],
 *   disabledReason?: string | null
 * }
 */
router.post(
  "/custom/upload-document",
  // Log before multer processes
  (req: Request, res: Response, next: express.NextFunction) => {
    console.log("[UploadDocument] ===== REQUEST RECEIVED =====");
    console.log("[UploadDocument] Method:", req.method);
    console.log("[UploadDocument] URL:", req.url);
    console.log("[UploadDocument] Content-Type:", req.headers["content-type"]);
    console.log("[UploadDocument] Content-Length:", req.headers["content-length"]);
    console.log("[UploadDocument] Timestamp:", new Date().toISOString());
    next();
  },
  uploadIdDocs,
  // Log after multer processes
  (req: Request, res: Response, next: express.NextFunction) => {
    console.log("[UploadDocument] ===== AFTER MULTER =====");
    console.log("[UploadDocument] Body keys:", Object.keys(req.body || {}));
    console.log("[UploadDocument] Files present:", !!(req as any).files);
    if ((req as any).files) {
      const files = (req as any).files;
      if (!Array.isArray(files)) {
        console.log("[UploadDocument] File fields:", Object.keys(files));
        if (files.front) console.log("[UploadDocument] Front file:", files.front[0]?.originalname, files.front[0]?.size, "bytes");
        if (files.back) console.log("[UploadDocument] Back file:", files.back[0]?.originalname, files.back[0]?.size, "bytes");
      }
    }
    next();
  },
  async (req: MulterRequest, res: Response) => {
    const startTime = Date.now();
    console.log("[UploadDocument] ===== HANDLER STARTED =====");
    
    // Set timeout for file uploads
    req.setTimeout(600000); // 10 minutes
    res.setTimeout(600000);
    
    try {
      // Step 1: Get driver ID from auth or body (multer has parsed body by now)
      console.log("[UploadDocument] Step 1: Getting driver ID");
      console.log("[UploadDocument] Body keys after multer:", Object.keys(req.body || {}));
      console.log("[UploadDocument] Body driverId:", req.body.driverId);
      
      // Try to get from auth first, then fall back to body (for test mode)
      let userIdFromRequest: number | null = null;
      try {
        userIdFromRequest = getUserIdFromRequest(req);
      } catch (authError) {
        // If auth fails, try to get from body (multer has parsed it)
        console.log("[UploadDocument] Auth failed, trying body driverId");
        if (req.body.driverId) {
          userIdFromRequest = parseInt(req.body.driverId as string);
        }
      }
      
      const driverId = getValidatedUserId(userIdFromRequest, "driver");

      if (!driverId) {
        return sendUnauthorized(res, "Driver authentication required. Please provide driverId in request body or authentication header.");
      }

      // Step 2: Fetch users.stripeAccountId via Prisma
      console.log("[UploadDocument] Step 2: Fetching Stripe account ID");
      const user = await prisma.users.findUnique({
        where: { id: driverId },
        select: {
          stripeAccountId: true,
        },
      });

      if (!user || !user.stripeAccountId) {
        return sendBadRequest(
          res,
          "Driver has no Stripe account. Please create an account first."
        );
      }

      const stripeAccountId = user.stripeAccountId;

      // Step 3: Extract files
      console.log("[UploadDocument] Step 3: Extracting files");
      const files = req.files as
        | { [fieldname: string]: Express.Multer.File[] }
        | undefined;

      if (!files || Array.isArray(files)) {
        return sendBadRequest(res, "Front document is required");
      }

      const front = files.front?.[0];
      const back = files.back?.[0];

      // Step 4: Validate
      console.log("[UploadDocument] Step 4: Validating files");
      if (!front) {
        return sendBadRequest(res, "Front document is required");
      }

      const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png"];
      if (!allowedMimeTypes.includes(front.mimetype)) {
        return sendBadRequest(
          res,
          `Invalid file type. Only ${allowedMimeTypes.join(", ")} are allowed.`
        );
      }

      if (front.size > 10 * 1024 * 1024) {
        return sendBadRequest(res, "Front document exceeds 10MB size limit");
      }

      if (back) {
        if (!allowedMimeTypes.includes(back.mimetype)) {
          return sendBadRequest(
            res,
            `Invalid back file type. Only ${allowedMimeTypes.join(", ")} are allowed.`
          );
        }
        if (back.size > 10 * 1024 * 1024) {
          return sendBadRequest(res, "Back document exceeds 10MB size limit");
        }
      }

      // Step 5: Upload to Stripe
      console.log("[UploadDocument] Step 5: Uploading files to Stripe");
      console.log(
        `[UploadDocument] Before Stripe upload - front: ${front.originalname} (${front.size} bytes)`
      );
      const frontFileId = await uploadToStripeIdentityFile(front);
      console.log(
        `[UploadDocument] After Stripe upload - frontFileId: ${frontFileId}`
      );

      let backFileId: string | undefined;
      if (back) {
        console.log(
          `[UploadDocument] Before Stripe upload - back: ${back.originalname} (${back.size} bytes)`
        );
        backFileId = await uploadToStripeIdentityFile(back);
        console.log(
          `[UploadDocument] After Stripe upload - backFileId: ${backFileId}`
        );
      }

      // Step 6: Attach docs
      console.log("[UploadDocument] Step 6: Attaching documents to account");
      console.log(
        `[UploadDocument] Before attachIdentityDocsToAccount - account: ${stripeAccountId}`
      );
      await attachIdentityDocsToAccount(stripeAccountId, frontFileId, backFileId);
      console.log(`[UploadDocument] After attachIdentityDocsToAccount`);

      // Step 7: Get updated status
      console.log("[UploadDocument] Step 7: Getting updated connect status");
      console.log(`[UploadDocument] Before getConnectStatus - account: ${stripeAccountId}`);
      const status = await getConnectStatus(stripeAccountId);
      console.log(`[UploadDocument] After getConnectStatus`);

      // Step 8: Return JSON response
      const totalTime = Date.now() - startTime;
      console.log(
        `[UploadDocument] ✅ Successfully completed in ${totalTime}ms`
      );

      res.status(200).json({
        success: true,
        message: "Verification documents uploaded successfully",
        frontFileId,
        backFileId: backFileId ?? null,
        payoutsEnabled: status.payoutsEnabled,
        chargesEnabled: status.chargesEnabled,
        currentlyDue: status.currentlyDue,
        eventuallyDue: status.eventuallyDue,
        pastDue: status.pastDue,
        disabledReason: status.disabledReason,
      });
      return;
    } catch (error: any) {
      const totalTime = Date.now() - startTime;
      
      // Log error details (but not sensitive data)
      console.error(`[UploadDocument] Error after ${totalTime}ms:`, {
        message: error?.message,
        code: error?.code,
        type: error?.type,
        name: error?.name,
        ...(error?.requestId && { stripeRequestId: error.requestId }),
        ...(error?.request_log_url && { 
          stripeRequestLogUrl: error.request_log_url 
        }),
      });

      // Check if response was already sent
      if (res.headersSent) {
        console.error(`[UploadDocument] Response already sent, cannot send error response`);
        return;
      }

      // Handle Stripe-specific errors
      if (
        error.code === "oauth_not_supported" ||
        error.type === "StripePermissionError" ||
        error.message?.includes("Stripe onboarding call was made with connected account context")
      ) {
        return sendBadRequest(
          res,
          "Stripe onboarding call was made with connected account context. " +
          "Ensure platform key is used and Stripe-Account header is not set."
        );
      }

      // Handle Stripe connection/timeout errors
      if (error.type === "StripeConnectionError" || error.code === "ETIMEDOUT") {
        console.error(
          `[UploadDocument] Stripe connection timeout - file may be too large or network is slow`
        );
        const timeoutMessage =
          "File upload to Stripe timed out after 30 seconds. " +
          "This may be due to network issues or Stripe API slowness. " +
          "Please try again - the file has been compressed and should upload faster on retry.";
        
        if (error.requestId) {
          console.error(`[UploadDocument] Stripe Request ID: ${error.requestId}`);
        }
        
        return sendBadRequest(res, timeoutMessage);
      }

      // Handle Stripe API errors
      if (
        error.type === "StripeInvalidRequestError" ||
        error.type === "StripeAPIError"
      ) {
        if (error.requestId) {
          console.error(`[UploadDocument] Stripe Request ID: ${error.requestId}`);
        }
        if (error.raw?.request_log_url) {
          console.error(
            `[UploadDocument] Stripe Request Log: ${error.raw.request_log_url}`
          );
        }
        return sendBadRequest(res, error.message || "Stripe API error occurred");
      }

      // Handle multer errors (file size, type, etc.)
      if (error.name === "MulterError") {
        if (error.code === "LIMIT_FILE_SIZE") {
          return sendBadRequest(res, "File size exceeds 10MB limit");
        }
        if (error.code === "LIMIT_UNEXPECTED_FILE") {
          return sendBadRequest(res, "Unexpected file field. Only 'front' and 'back' are allowed.");
        }
        return sendBadRequest(res, error.message || "File upload error");
      }

      // Generic error
      return sendInternalError(
        res,
        error as Error,
        "Failed to upload verification documents"
      );
    }
  }
);

/**
 * POST /api/driver/connect/custom/clear-business-profile
 * Clears business_profile requirements for individual accounts
 */
router.post("/custom/clear-business-profile", async (req: Request, res: Response) => {
  try {
    const userIdFromRequest = getUserIdFromRequest(req);
    const driverId = getValidatedUserId(
      req.body.driverId
        ? parseInt(req.body.driverId as string)
        : userIdFromRequest,
      "driver"
    );

    if (!driverId) {
      return sendUnauthorized(res, "Driver authentication required");
    }

    const status = await clearBusinessProfile(driverId);

    return sendSuccess(res, "Business profile cleared for individual account", {
      payoutsEnabled: status.payoutsEnabled,
      chargesEnabled: status.chargesEnabled,
      currentlyDue: status.currentlyDue,
      eventuallyDue: status.eventuallyDue,
      pastDue: status.pastDue,
      disabledReason: status.disabledReason,
    });
  } catch (error: any) {
    console.error("Error clearing business profile:", error);
    return sendInternalError(
      res,
      error as Error,
      "Failed to clear business profile"
    );
  }
});

export default router;
