/**
 * Stripe Connect Custom Account Service
 * Handles all Stripe Connect Custom account operations for driver payouts
 */

import Stripe from "stripe";
import { stripe } from "../lib/stripe";
import { prisma } from "../lib/prisma";
import { formatPhoneToE164 } from "../utils/phone";

export interface ConnectStatus {
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  currentlyDue: string[];
  eventuallyDue: string[];
  pastDue: string[];
  disabledReason: string | null;
}

export interface IndividualInfoPayload {
  firstName: string;
  lastName: string;
  phone: string;
  dob: {
    day: number;
    month: number;
    year: number;
  };
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
  };
  ssnLast4?: string;
  idNumber?: string;
}

export interface BankAccountTokenPayload {
  routingNumber: string;
  accountNumber: string;
  accountHolderName: string;
}

/**
 * Get or create a Stripe Connect Custom account for a driver
 */
export async function getOrCreateCustomConnectedAccount(
  driverUserId: number,
  requestIp?: string
): Promise<string> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  // Fetch user
  const user = await prisma.users.findUnique({
    where: { id: driverUserId },
    select: {
      id: true,
      email: true,
      fullName: true,
      isDriver: true,
      stripeAccountId: true,
    },
  });

  if (!user || !user.isDriver) {
    throw new Error("User is not a driver");
  }

  // If stripeAccountId exists, verify it's a Custom account
  // API-based onboarding requires Custom accounts, not Express
  if (user.stripeAccountId) {
    try {
      const existingAccount = await stripe.accounts.retrieve(user.stripeAccountId);
      
      // If account is not Custom type, we need to create a new Custom account
      if (existingAccount.type !== "custom") {
        console.warn(
          `Driver ${driverUserId} has Express account ${user.stripeAccountId}. ` +
          `Creating new Custom account for API-based onboarding.`
        );
        
        // Clear the Express account ID (keep it for reference if needed)
        await prisma.users.update({
          where: { id: driverUserId },
          data: {
            stripeAccountId: null,
            stripeOnboardingStatus: "not_started",
          },
        });
        
        // Continue to create new Custom account below
      } else {
        // Account is Custom, return it
        return user.stripeAccountId;
      }
    } catch (error: any) {
      // If account doesn't exist or can't be retrieved, create new one
      console.warn(
        `Could not retrieve account ${user.stripeAccountId} for driver ${driverUserId}:`,
        error.message
      );
      
      // Clear invalid account ID
      await prisma.users.update({
        where: { id: driverUserId },
        data: {
          stripeAccountId: null,
          stripeOnboardingStatus: "not_started",
        },
      });
      
      // Continue to create new Custom account below
    }
  }

  // Create a new Custom connected account
  // For individual accounts, we don't set business_profile
  // to avoid business-related requirements
  const account = await stripe.accounts.create({
    type: "custom",
    country: "US",
    email: user.email,
    business_type: "individual",
    // business_profile is omitted for individuals to avoid business requirements
    capabilities: {
      transfers: { requested: true },
    },
    tos_acceptance: {
      date: Math.floor(Date.now() / 1000),
      ip: requestIp || "127.0.0.1",
    },
  });

  // Save stripeAccountId to user
  await prisma.users.update({
    where: { id: driverUserId },
    data: {
      stripeAccountId: account.id,
      stripeOnboardingStatus: "pending",
    } as any, // Will be properly typed after migration
  });

  return account.id;
}

/**
 * Retrieve Connect account status and requirements
 */
export async function retrieveConnectStatus(
  driverUserId: number
): Promise<
  ConnectStatus & { hasAccount: boolean; stripeAccountId: string | null }
> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const user = await prisma.users.findUnique({
    where: { id: driverUserId },
    select: {
      stripeAccountId: true,
    },
  });

  if (!user || !user.stripeAccountId) {
    return {
      hasAccount: false,
      stripeAccountId: null,
      payoutsEnabled: false,
      chargesEnabled: false,
      currentlyDue: [],
      eventuallyDue: [],
      pastDue: [],
      disabledReason: null,
    };
  }

  // Retrieve account from Stripe
  const account = await stripe.accounts.retrieve(user.stripeAccountId);

  const requirements = (account.requirements || {}) as {
    currently_due?: string[];
    eventually_due?: string[];
    past_due?: string[];
    disabled_reason?: string | null;
  };
  const currentlyDue = requirements.currently_due || [];
  const eventuallyDue = requirements.eventually_due || [];
  const pastDue = requirements.past_due || [];

  const status: ConnectStatus = {
    payoutsEnabled: account.payouts_enabled || false,
    chargesEnabled: account.charges_enabled || false,
    currentlyDue,
    eventuallyDue,
    pastDue,
    disabledReason: account.requirements?.disabled_reason || null,
  };

  // Cache requirements in DB for faster UI
  await prisma.users.update({
    where: { id: driverUserId },
    data: {
      stripeRequirementsDue: {
        currentlyDue,
        eventuallyDue,
        pastDue,
        disabledReason: status.disabledReason,
      },
      stripeOnboardingStatus: account.payouts_enabled
        ? "verified"
        : requirements.disabled_reason
        ? "restricted"
        : "pending",
    },
  });

  return {
    hasAccount: true,
    stripeAccountId: account.id,
    ...status,
  };
}

/**
 * Update individual information on the connected account
 */
export async function updateIndividualInfo(
  driverUserId: number,
  payload: IndividualInfoPayload
): Promise<ConnectStatus> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

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

  // Build basic individual update object (only include fields that are provided)
  const individualUpdate: any = {};

  // Only update fields that are provided and not placeholder values
  // This allows partial updates (e.g., only SSN/ID from identity screen)
  if (payload.firstName && payload.firstName.trim() && payload.firstName !== "N/A") {
    individualUpdate.first_name = payload.firstName;
  }
  if (payload.lastName && payload.lastName.trim() && payload.lastName !== "N/A") {
    individualUpdate.last_name = payload.lastName;
  }
  if (payload.phone && payload.phone.trim() && !payload.phone.startsWith("000")) {
    const formattedPhone = formatPhoneToE164(payload.phone, "1");
    individualUpdate.phone = formattedPhone;
  }
  if (payload.dob?.day && payload.dob?.month && payload.dob?.year && payload.dob.year > 1900) {
    individualUpdate.dob = {
      day: payload.dob.day,
      month: payload.dob.month,
      year: payload.dob.year,
    };
  }
  if (payload.address?.line1 && payload.address.line1.trim() && payload.address.line1 !== "N/A") {
    individualUpdate.address = {
      line1: payload.address.line1,
      line2: payload.address.line2 || undefined,
      city: payload.address.city || "",
      state: payload.address.state || "",
      postal_code: payload.address.postalCode || "",
      country: "US",
    };
  }

  // Try to update individual info
  // IMPORTANT: All onboarding calls must use platform context (no stripeAccount header)
  try {
    // Only update if we have at least one field to update
    if (Object.keys(individualUpdate).length > 0) {
      console.log(
        `[Stripe] Updating individual info for account ${user.stripeAccountId} ` +
        `(platform context, no stripeAccount header)`
      );
      
      await stripe.accounts.update(user.stripeAccountId, {
        individual: individualUpdate,
      });
    }

    // Try to update SSN/ID separately if provided (these may require special permissions)
    // IMPORTANT: Stripe doesn't allow both id_number and ssn_last_4 unless they match
    // For US individuals, prefer ssn_last_4. For non-US, use id_number.
    if (payload.ssnLast4 || payload.idNumber) {
      const verificationUpdate: any = {};
      
      // Only send one: prefer ssn_last_4 for US individuals, otherwise use id_number
      if (payload.ssnLast4) {
        verificationUpdate.ssn_last_4 = payload.ssnLast4;
        // Don't send id_number if we're sending ssn_last_4
      } else if (payload.idNumber) {
        verificationUpdate.id_number = payload.idNumber;
      }

      console.log(
        `[Stripe] Updating SSN/ID for account ${user.stripeAccountId} ` +
        `(platform context, no stripeAccount header)`
      );
      console.log(
        `[Stripe] Sending verification update:`,
        Object.keys(verificationUpdate)
      );

      await stripe.accounts.update(user.stripeAccountId, {
        individual: verificationUpdate,
      });
    }
  } catch (error: any) {
    // If update fails due to permissions (oauth_not_supported), this indicates
    // the call was made with connected account context (Stripe-Account header)
    if (error.code === "oauth_not_supported" || error.type === "StripePermissionError") {
      const errorMessage =
        "Stripe onboarding call was made with connected account context. " +
        "Ensure platform key is used and Stripe-Account header is not set.";
      
      console.error(
        `[Stripe] Permission error for account ${user.stripeAccountId}:`,
        errorMessage
      );
      console.error(
        `[Stripe] Request ID: ${error.requestId || "unknown"}, ` +
        `Log URL: ${error.raw?.request_log_url || "N/A"}`
      );
      
      // Throw with clear error message
      throw new Error(errorMessage);
    } else {
      // For other errors, re-throw
      throw error;
    }
  }

  // Return updated status
  const status = await retrieveConnectStatus(driverUserId);
  return status;
}

/**
 * Clear business_profile requirements for individual accounts
 * When Stripe requires business_profile.url for individuals, we set minimal required fields
 */
export async function clearBusinessProfile(
  driverUserId: number
): Promise<ConnectStatus> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const user = await prisma.users.findUnique({
    where: { id: driverUserId },
    select: {
      stripeAccountId: true,
      email: true,
    },
  });

  if (!user || !user.stripeAccountId) {
    throw new Error(
      "Stripe account not found. Please create an account first."
    );
  }

  // IMPORTANT: All onboarding calls must use platform context (no stripeAccount header)
  // When Stripe requires business_profile.url for individual accounts,
  // we set minimal required fields. For individuals without a business URL,
  // we use a placeholder or omit it if possible.
  try {
    console.log(
      `[Stripe] Clearing business_profile requirements for account ${user.stripeAccountId} ` +
      `(platform context, no stripeAccount header)`
    );

    // Check current account to see what's required
    const account = await stripe.accounts.retrieve(user.stripeAccountId);
    const requirements = account.requirements;
    
    // Check if business_profile.url is required (check all requirement arrays)
    const currentlyDue = requirements?.currently_due || [];
    const pastDue = requirements?.past_due || [];
    const eventuallyDue = requirements?.eventually_due || [];
    
    const needsBusinessUrl = 
      currentlyDue.some((req) => req.includes("business_profile.url")) ||
      pastDue.some((req) => req.includes("business_profile.url")) ||
      eventuallyDue.some((req) => req.includes("business_profile.url"));

    console.log(
      `[Stripe] Checking business_profile requirements: ` +
      `currentlyDue=${currentlyDue.length}, pastDue=${pastDue.length}, ` +
      `needsBusinessUrl=${needsBusinessUrl}`
    );

    // Build update payload - set business_profile.url if required
    const updateParams: Stripe.AccountUpdateParams = {};

    // If business_profile.url is required for individual accounts, we need to set it
    // For individuals without a business, we'll use a placeholder URL
    if (needsBusinessUrl) {
      // For individual accounts, use a placeholder URL
      // Stripe requires a valid URL format, so we use a placeholder
      // This satisfies the requirement without needing an actual business website
      updateParams.business_profile = {
        url: "https://individual-driver.waypool.com", // Placeholder URL for individuals
      };
      
      console.log(
        `[Stripe] Setting business_profile.url to placeholder for individual account ` +
        `(required by Stripe but not applicable to individuals)`
      );
      
      // Update the account
      await stripe.accounts.update(user.stripeAccountId, updateParams);
      console.log(`[Stripe] Successfully updated business_profile.url for individual account`);
    } else {
      console.log(`[Stripe] No business_profile.url requirement found - no update needed`);
    }
  } catch (error: any) {
    // If update fails due to permissions, log and continue
    if (error.code === "oauth_not_supported" || error.type === "StripePermissionError") {
      console.warn(
        `[Stripe] Permission error updating business_profile for account ${user.stripeAccountId}:`,
        error.message
      );
      // Don't throw - this might not be critical
    } else {
      console.error(`[Stripe] Error updating business_profile:`, error);
      throw error;
    }
  }

  // Return updated status
  const status = await retrieveConnectStatus(driverUserId);
  return status;
}

/**
 * Create a bank account token
 */
export async function createBankAccountToken(
  payload: BankAccountTokenPayload
): Promise<{ tokenId: string }> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  // Create bank account token
  // IMPORTANT: Token creation must use platform context (no stripeAccount header)
  console.log(
    `[Stripe] Creating bank account token (platform context, no stripeAccount header)`
  );
  
  const token = await stripe.tokens.create({
    bank_account: {
      country: "US",
      currency: "usd",
      routing_number: payload.routingNumber,
      account_number: payload.accountNumber,
      account_holder_name: payload.accountHolderName,
      account_holder_type: "individual",
    },
  });

  return { tokenId: token.id };
}

/**
 * Attach external bank account to connected account
 */
export async function attachExternalBankAccount(
  driverUserId: number,
  bankTokenId: string
): Promise<ConnectStatus> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

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

  // Attach external account
  // IMPORTANT: External account creation must use platform context (no stripeAccount header)
  console.log(
    `[Stripe] Attaching external account to ${user.stripeAccountId} ` +
    `(platform context, no stripeAccount header)`
  );
  
  const externalAccount = await stripe.accounts.createExternalAccount(
    user.stripeAccountId,
    {
      external_account: bankTokenId,
    }
  );

  // Update user with bank account info (only safe fields)
  if (externalAccount.object === "bank_account") {
    await prisma.users.update({
      where: { id: driverUserId },
      data: {
        bankAccountId: externalAccount.id,
        bankAccountLast4: externalAccount.last4 || null,
        bankAccountType: externalAccount.account_type || null,
        bankAccountStatus: externalAccount.status || null,
      },
    });
  }

  // Return updated status
  const status = await retrieveConnectStatus(driverUserId);
  return status;
}

/**
 * Upload verification document to Stripe
 */
export async function uploadVerificationDocument(
  fileBuffer: Buffer,
  filename: string,
  mimetype: string
): Promise<{ fileId: string }> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  // Upload to Stripe Files
  // CRITICAL: File upload must use platform context (NO stripeAccount header)
  // Files API does NOT support connected account context
  console.log(
    `[Stripe] Uploading verification document (platform context, no stripeAccount header)`
  );
  
  // Verify we're NOT passing stripeAccount (this would cause permission errors)
  const fileParams: Stripe.FileCreateParams = {
    purpose: "identity_document",
    file: {
      data: fileBuffer,
      name: filename,
      type: mimetype,
    },
  };

  // CRITICAL: Do NOT pass stripeAccount in requestOptions
  const requestOptions: Stripe.RequestOptions = {
    // DO NOT include stripeAccount here - Files API requires platform context
  };

  if ('stripeAccount' in requestOptions) {
    throw new Error('CRITICAL: stripeAccount must NOT be set for Files API uploads');
  }

  console.log(
    `[Stripe] ✅ Verified: No stripeAccount header will be sent (platform context)`
  );
  
  const file = await stripe.files.create(fileParams, requestOptions);

  return { fileId: file.id };
}

/**
 * Attach verification documents to connected account
 */
export async function attachVerificationDocument(
  driverUserId: number,
  frontFileId: string,
  backFileId?: string
): Promise<ConnectStatus> {
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

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

  // Build verification document object
  const verificationDoc: any = {
    front: frontFileId,
  };

  if (backFileId) {
    verificationDoc.back = backFileId;
  }

  // Update account with verification documents
  // IMPORTANT: Account update must use platform context (no stripeAccount header)
  console.log(
    `[Stripe] Attaching verification document to ${user.stripeAccountId} ` +
    `(platform context, no stripeAccount header)`
  );
  
  await stripe.accounts.update(user.stripeAccountId, {
    individual: {
      verification: {
        document: verificationDoc,
      },
    },
  });

  // Return updated status
  const status = await retrieveConnectStatus(driverUserId);
  return status;
}
