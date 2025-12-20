/**
 * Test script for Stripe Connect Custom account onboarding
 * Verifies that all onboarding calls work in platform context (no Stripe-Account header)
 * 
 * Usage: npx ts-node scripts/test-stripe-onboarding.ts
 */

import { stripe } from "../src/lib/stripe";
import { prisma } from "../src/lib/prisma";

async function testStripeOnboarding() {
  if (!stripe) {
    console.error("❌ Stripe is not configured");
    process.exit(1);
  }

  console.log("🧪 Testing Stripe Connect Custom account onboarding...\n");

  try {
    // 1. Create a Custom account
    console.log("1. Creating Custom account...");
    const account = await stripe.accounts.create({
      type: "custom",
      country: "US",
      email: `test-${Date.now()}@example.com`,
      business_type: "individual",
      capabilities: {
        transfers: { requested: true },
      },
      tos_acceptance: {
        date: Math.floor(Date.now() / 1000),
        ip: "127.0.0.1",
      },
    });
    console.log(`   ✅ Created account: ${account.id}\n`);

    // 2. Update individual fields
    console.log("2. Updating individual fields...");
    await stripe.accounts.update(account.id, {
      individual: {
        first_name: "Test",
        last_name: "Driver",
        phone: "+15551234567",
        dob: {
          day: 1,
          month: 1,
          year: 1990,
        },
        address: {
          line1: "123 Test St",
          city: "San Francisco",
          state: "CA",
          postal_code: "94102",
          country: "US",
        },
      },
    });
    console.log("   ✅ Individual fields updated\n");

    // 3. Create bank account token
    console.log("3. Creating bank account token...");
    const token = await stripe.tokens.create({
      bank_account: {
        country: "US",
        currency: "usd",
        routing_number: "110000000", // Stripe test routing number
        account_number: "000123456789",
        account_holder_name: "Test Driver",
        account_holder_type: "individual",
      },
    });
    console.log(`   ✅ Created token: ${token.id}\n`);

    // 4. Attach external account
    console.log("4. Attaching external account...");
    const externalAccount = await stripe.accounts.createExternalAccount(
      account.id,
      {
        external_account: token.id,
      }
    );
    console.log(`   ✅ Attached external account: ${externalAccount.id}\n`);

    // 5. Retrieve account status
    console.log("5. Retrieving account status...");
    const updatedAccount = await stripe.accounts.retrieve(account.id);
    console.log(`   ✅ Account status retrieved`);
    console.log(`   - Payouts enabled: ${updatedAccount.payouts_enabled}`);
    console.log(`   - Charges enabled: ${updatedAccount.charges_enabled}`);
    console.log(
      `   - Currently due: ${updatedAccount.requirements?.currently_due?.length || 0} requirements\n`
    );

    // Cleanup: Delete test account
    console.log("6. Cleaning up test account...");
    await stripe.accounts.del(account.id);
    console.log("   ✅ Test account deleted\n");

    console.log("✅ All tests passed! Onboarding calls work correctly in platform context.\n");
  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    if (error.code === "oauth_not_supported") {
      console.error(
        "\n⚠️  This error indicates a Stripe-Account header is being set somewhere."
      );
      console.error("   Check that all onboarding calls use platform context only.\n");
    }
    console.error("Full error:", error);
    process.exit(1);
  }
}

// Run test
testStripeOnboarding()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });

