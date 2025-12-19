/**
 * Stripe Connect Custom Account Service
 * Handles all Stripe Connect Custom account operations for driver payouts
 */

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

  // If stripeAccountId exists, return it
  if (user.stripeAccountId) {
    return user.stripeAccountId;
  }

  // Create a new Custom connected account
  const account = await stripe.accounts.create({
    type: "custom",
    country: "US",
    email: user.email,
    business_type: "individual",
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
    } as any, // Will be properly typed after migration
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

  // Format phone number
  const formattedPhone = formatPhoneToE164(payload.phone, "1");

  // Build individual update object
  const individualUpdate: any = {
    first_name: payload.firstName,
    last_name: payload.lastName,
    phone: formattedPhone,
    dob: {
      day: payload.dob.day,
      month: payload.dob.month,
      year: payload.dob.year,
    },
    address: {
      line1: payload.address.line1,
      line2: payload.address.line2 || undefined,
      city: payload.address.city,
      state: payload.address.state,
      postal_code: payload.address.postalCode,
      country: "US",
    },
  };

  // Only add SSN or ID number if provided
  if (payload.ssnLast4) {
    individualUpdate.ssn_last_4 = payload.ssnLast4;
  }

  if (payload.idNumber) {
    individualUpdate.id_number = payload.idNumber;
  }

  // Update account
  await stripe.accounts.update(user.stripeAccountId, {
    individual: individualUpdate,
  });

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
  const file = await stripe.files.create({
    purpose: "identity_document",
    file: {
      data: fileBuffer,
      name: filename,
      type: mimetype,
    },
  });

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
