# Next Steps After Creating Stripe Connect Account

## What You've Done ✅

- Created a Stripe Connect Express account
- Account ID is stored in your database

## What's Next? 🎯

### Step 1: Complete Account Onboarding

You have **two options** to complete onboarding:

#### Option A: Stripe Hosted Onboarding (Current - Easiest)

1. **In the app**, go to the Payouts screen
2. Click **"Set Up Bank Account"** or **"Complete Setup"**
3. You'll be redirected to Stripe's secure onboarding page
4. Complete the required information:
   - Personal details (SSN, Date of Birth)
   - Address information
   - Bank account details (routing number, account number)
5. Stripe will verify your information
6. Return to the app - your account will be updated automatically

#### Option B: In-App Onboarding (New - No Redirect)

1. **In the app**, go to the Payouts screen
2. Click **"Set Up in App"** (if this option is available)
3. Fill out forms directly in the app:
   - SSN Last 4 digits
   - Date of Birth
   - Address (street, city, state, ZIP)
   - Bank account details
4. Submit - information is sent securely to Stripe
5. No redirect needed!

### Step 2: Check Account Status

After onboarding, check your account status:

**Via API:**

```bash
GET /api/driver/payouts/account-status?driverId=YOUR_DRIVER_ID
```

**In the app:**

- Go to Payouts screen
- It will show:
  - ✅ Account status (enabled/pending)
  - ✅ Bank account linked (last 4 digits)
  - ✅ Payouts enabled (yes/no)
  - ⚠️ Any missing requirements

### Step 3: Verify Requirements

Check what's still needed:

**Via API:**

```bash
GET /api/driver/payouts/account-requirements?driverId=YOUR_DRIVER_ID
```

This will show:

- `currentlyDue`: Information needed right now
- `eventuallyDue`: Information needed later
- `pastDue`: Overdue requirements
- `disabledReason`: Why payouts might be disabled

### Step 4: Wait for Verification

After submitting information:

- Stripe may need to verify your bank account (micro-deposits)
- This can take 1-2 business days
- You'll receive webhook notifications when status changes

### Step 5: Enable Payouts

Once verified:

- `payoutsEnabled` will be `true`
- You can start receiving payouts
- Check your available balance

## Current Status Check

To see where you are right now:

1. **Check Account Status:**

   ```typescript
   const status = await getAccountStatus(driverId);
   console.log("Payouts Enabled:", status.payoutsEnabled);
   console.log("Bank Account:", status.bankAccount);
   console.log("Status:", status.status);
   ```

2. **Check Requirements:**
   ```typescript
   const requirements = await getAccountRequirements(driverId);
   console.log("Currently Due:", requirements.currentlyDue);
   console.log("Payouts Enabled:", requirements.payoutsEnabled);
   ```

## Common Scenarios

### Scenario 1: Account Created, No Onboarding Yet

- **Status**: `pending`
- **Payouts Enabled**: `false`
- **Bank Account**: `null`
- **Action**: Complete onboarding (Option A or B above)

### Scenario 2: Onboarding Started, Not Complete

- **Status**: `pending`
- **Payouts Enabled**: `false`
- **Bank Account**: May be linked but not verified
- **Action**: Check `requirements.currentlyDue` for what's missing

### Scenario 3: Onboarding Complete, Awaiting Verification

- **Status**: `enabled`
- **Payouts Enabled**: `false` (still verifying)
- **Bank Account**: Linked, status may be `pending`
- **Action**: Wait for Stripe verification (1-2 business days)

### Scenario 4: Fully Ready

- **Status**: `enabled`
- **Payouts Enabled**: `true`
- **Bank Account**: Linked and verified
- **Action**: ✅ You're ready! You can receive payouts.

## Troubleshooting

### "Payouts not enabled"

- **Cause**: Account verification not complete
- **Solution**:
  1. Check `requirements.currentlyDue`
  2. Complete any missing information
  3. Wait for Stripe verification

### "No bank account linked"

- **Cause**: Bank account not added during onboarding
- **Solution**:
  1. Create account link: `POST /api/driver/payouts/create-account-link`
  2. Or use in-app onboarding to add bank account

### "Requirements show missing information"

- **Cause**: Some information wasn't provided or needs updating
- **Solution**:
  1. Use `PUT /api/driver/payouts/update-account` to add missing info
  2. Or create account link to update: `POST /api/driver/payouts/create-account-link` with `type: 'account_update'`

## Quick Reference

### API Endpoints

- `GET /api/driver/payouts/account-status` - Check current status
- `GET /api/driver/payouts/account-requirements` - See what's needed
- `POST /api/driver/payouts/create-account-link` - Get onboarding/update link
- `PUT /api/driver/payouts/update-account` - Update info in-app
- `GET /api/driver/payouts/balance` - Check available balance

### Frontend Functions

- `getAccountStatus(driverId)` - Get account status
- `getAccountRequirements(driverId)` - Get requirements
- `createAccountLink(driverId, type)` - Create onboarding link
- `updatePayoutAccount(driverId, data)` - Update account info
- `getPayoutBalance(driverId)` - Get available balance

## Next Actions

1. ✅ **Check your account status** - See where you are
2. ✅ **Complete onboarding** - Use Stripe hosted or in-app
3. ✅ **Verify bank account** - Wait for Stripe verification
4. ✅ **Start earning** - Complete rides to build balance
5. ✅ **Request payout** - Once payouts are enabled

## Need Help?

- Check `backend/STRIPE_CONNECT_SETUP.md` for setup details
- Check `backend/IN_APP_ONBOARDING.md` for in-app onboarding
- Review Stripe Dashboard: https://dashboard.stripe.com/connect/accounts
