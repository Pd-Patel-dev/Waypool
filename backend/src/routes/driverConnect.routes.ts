/**
 * Stripe Connect Custom Account Routes
 * API-based onboarding for driver payouts
 */

import express, { Request, Response } from "express";
import multer from "multer";
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
  uploadVerificationDocument,
  attachVerificationDocument,
  type IndividualInfoPayload,
  type BankAccountTokenPayload,
} from "../services/stripeConnectCustom.service";

const router = express.Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Extend Express Request type to include files
interface MulterRequest extends Request {
  files?:
    | { [fieldname: string]: Express.Multer.File[] }
    | Express.Multer.File[]
    | undefined;
}

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
 */
router.post(
  "/custom/upload-document",
  upload.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
  ]),
  async (req: MulterRequest, res: Response) => {
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

      // Type guard for files - multer.fields() returns an object, not an array
      const files = (req as any).files as
        | { [fieldname: string]: Express.Multer.File[] }
        | undefined;

      if (!files || Array.isArray(files)) {
        return sendBadRequest(res, "Front document is required");
      }

      if (!files.front || files.front.length === 0) {
        return sendBadRequest(res, "Front document is required");
      }

      const frontFile = files.front[0];
      if (!frontFile) {
        return sendBadRequest(res, "Front document is required");
      }

      // Upload front document
      const { fileId: frontFileId } = await uploadVerificationDocument(
        frontFile.buffer,
        frontFile.originalname,
        frontFile.mimetype
      );

      // Upload back document if provided
      let backFileId: string | undefined;
      if (files.back && files.back.length > 0) {
        const backFile = files.back[0];
        if (backFile) {
          const { fileId } = await uploadVerificationDocument(
            backFile.buffer,
            backFile.originalname,
            backFile.mimetype
          );
          backFileId = fileId;
        }
      }

      // Attach documents to account
      const status = await attachVerificationDocument(
        driverId,
        frontFileId,
        backFileId
      );

      return sendSuccess(res, "Verification documents uploaded", {
        payoutsEnabled: status.payoutsEnabled,
        chargesEnabled: status.chargesEnabled,
        currentlyDue: status.currentlyDue,
        eventuallyDue: status.eventuallyDue,
        pastDue: status.pastDue,
        disabledReason: status.disabledReason,
      });
    } catch (error: any) {
      console.error("Error uploading documents:", error);
      return sendInternalError(
        res,
        error as Error,
        "Failed to upload verification documents"
      );
    }
  }
);

export default router;
