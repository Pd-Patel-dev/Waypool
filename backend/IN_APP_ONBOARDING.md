# In-App Onboarding Implementation

## Overview
This document explains how to use the in-app onboarding feature for Stripe Connect Express accounts, allowing drivers to complete onboarding without leaving the app.

## Implementation Status

✅ **Backend APIs Implemented:**
- `PUT /api/driver/payouts/update-account` - Update account information
- `POST /api/driver/payouts/create-bank-account-token` - Create bank account token
- `GET /api/driver/payouts/account-requirements` - Get what's still needed

✅ **Frontend APIs Implemented:**
- `updatePayoutAccount()` - Update account information
- `createBankAccountToken()` - Create bank account token
- `getAccountRequirements()` - Get requirements

⏳ **Frontend Screen:**
- In-app onboarding screen needs to be created

## How It Works

### Option 1: Redirect to Stripe (Current)
- Driver clicks "Set Up Bank Account"
- Redirects to Stripe's hosted onboarding page
- Completes onboarding on Stripe's website
- Returns to app

### Option 2: In-App Onboarding (New)
- Driver clicks "Set Up Bank Account"
- Stays in app
- Fills out forms in-app
- Submits information via API
- No redirect needed

## Required Information

For Stripe Connect Express accounts, you need to collect:

1. **Personal Information:**
   - SSN Last 4 digits
   - Date of Birth (YYYY-MM-DD)
   - Address (street, city, state, ZIP)

2. **Bank Account:**
   - Account Number
   - Routing Number
   - Account Holder Name
   - Account Type (checking/savings)

## Security Considerations

⚠️ **Important:** Bank account information is sensitive. Consider:

1. **Client-Side Token Creation (Recommended):**
   - Use Stripe.js or Stripe React Native SDK
   - Create tokens client-side
   - Never send raw bank account numbers to your server
   - Only send tokens to your backend

2. **Server-Side Token Creation (Current Implementation):**
   - Current implementation creates tokens server-side
   - Acceptable for MVP/testing
   - Should migrate to client-side for production

## Implementation Steps

### Step 1: Create Onboarding Screen

Create `driver-app/app/payout-onboarding.tsx` with:
- Form for personal information (SSN, DOB, address)
- Form for bank account details
- Validation
- Submit to `updatePayoutAccount()` API

### Step 2: Update Payouts Screen

Modify `driver-app/app/payouts.tsx` to:
- Offer choice: "Set Up in App" or "Set Up with Stripe"
- Navigate to in-app onboarding screen

### Step 3: Handle Requirements

After submitting:
- Check `getAccountRequirements()` to see what's still needed
- Show appropriate messages
- Guide user through remaining steps

## Example Flow

```typescript
// 1. Create account (if not exists)
const account = await createConnectAccount(driverId);

// 2. Get requirements
const requirements = await getAccountRequirements(driverId);

// 3. Collect information in-app
const formData = {
  ssnLast4: "1234",
  dob: "1990-01-01",
  address: "123 Main St",
  city: "New York",
  state: "NY",
  postalCode: "10001",
};

// 4. Create bank account token (client-side recommended)
const bankToken = await createBankAccountToken(driverId, {
  accountNumber: "000123456789",
  routingNumber: "110000000",
  accountHolderName: "John Doe",
  accountType: "checking",
});

// 5. Update account with all information
const result = await updatePayoutAccount(driverId, {
  ...formData,
  bankAccountToken: bankToken.token,
});

// 6. Check if complete
if (result.payoutsEnabled) {
  // Onboarding complete!
} else {
  // Check requirements for what's still needed
  const requirements = await getAccountRequirements(driverId);
  // Show user what's missing
}
```

## Testing

### Test Mode
- Use Stripe test mode keys
- Test bank account: `account_number: 000123456789`
- Test routing: `110000000`

### Validation
- SSN Last 4: Must be 4 digits
- DOB: Must be valid date, driver must be 18+
- Address: Required fields
- Bank Account: Valid routing number (9 digits), account number

## Next Steps

1. ✅ Backend APIs - Complete
2. ✅ Frontend API functions - Complete
3. ⏳ Create onboarding screen UI
4. ⏳ Add validation
5. ⏳ Integrate with payouts screen
6. ⏳ Test end-to-end flow
7. ⏳ Migrate to client-side token creation (production)

## Notes

- Current implementation uses server-side token creation for simplicity
- For production, migrate to Stripe.js/Stripe React Native SDK
- Some information may still require Stripe verification (micro-deposits)
- Account may need additional verification after initial submission


