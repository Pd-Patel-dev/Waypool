# Stripe Connect Express Setup Guide

## Overview
This guide explains how to set up Stripe Connect Express for driver weekly payouts.

## Complete Flow

### 1. Driver Onboarding (First Time Setup)

**Step 1: Create Stripe Connect Account**
- Driver clicks "Set Up Bank Account" in the app
- App calls: `POST /api/driver/payouts/connect-account`
- Backend creates a Stripe Connect Express account
- Returns `onboardingUrl` for Stripe-hosted onboarding

**Step 2: Complete Stripe Onboarding**
- Driver is redirected to Stripe's hosted onboarding page
- Driver provides:
  - Personal information
  - Bank account details
  - Tax information (if required)
- Stripe verifies the bank account

**Step 3: Account Status Update**
- After onboarding, Stripe sends `account.updated` webhook
- Backend automatically updates:
  - `stripeAccountStatus`: 'enabled' or 'pending'
  - `payoutsEnabled`: true/false
  - `bankAccountId`, `bankAccountLast4`, `bankAccountType`, `bankAccountStatus`

**Step 4: Verify Account Status**
- Driver can check status via: `GET /api/driver/payouts/account-status`
- Shows if payouts are enabled and bank account details

### 2. Weekly Payout Process

**Automatic Weekly Payouts:**
1. System calculates weekly net earnings (last 7 days)
2. For each driver with:
   - `stripeAccountId` set
   - `payoutsEnabled = true`
   - Net earnings > $0
3. Creates Stripe Transfer to driver's Connect account
4. Records payout in `payouts` table with status 'pending'
5. Stripe processes transfer (2-7 business days)
6. Webhook updates status to 'paid' when complete

**Manual Payouts:**
- Driver can request immediate payout via: `POST /api/driver/payouts/initiate`
- Same process as automatic, but triggered by driver

### 3. Payout Status Tracking

**Webhook Events:**
- `transfer.paid` → Status: 'paid'
- `transfer.failed` → Status: 'failed' (with failure code/message)
- `transfer.canceled` → Status: 'canceled'
- `account.updated` → Updates account status and bank details

## API Endpoints

### Driver Payout Routes

1. **Create/Get Connect Account**
   ```
   POST /api/driver/payouts/connect-account
   Body: { driverId: number }
   Returns: { accountId, onboardingUrl, status }
   ```

2. **Get Account Status**
   ```
   GET /api/driver/payouts/account-status?driverId=123
   Returns: { hasAccount, accountId, status, payoutsEnabled, bankAccount, requirements }
   ```

3. **Create Account Link (Re-onboarding)**
   ```
   POST /api/driver/payouts/create-account-link
   Body: { driverId: number, type?: 'account_onboarding' | 'account_update' }
   Returns: { url }
   ```

4. **Initiate Manual Payout**
   ```
   POST /api/driver/payouts/initiate
   Body: { driverId: number, amount: number, description?: string }
   Returns: { payoutId, stripePayoutId, amount, status }
   ```

5. **Get Payout History**
   ```
   GET /api/driver/payouts/history?driverId=123&limit=20&offset=0
   Returns: { payouts: [...], total, limit, offset }
   ```

6. **Get Available Balance**
   ```
   GET /api/driver/payouts/balance?driverId=123
   Returns: { weeklyNetEarnings, pendingPayouts, availableBalance, currency }
   ```

### Webhook Endpoint

```
POST /api/driver/payouts/webhook
Headers: { 'stripe-signature': string }
Body: Stripe webhook event (raw JSON)
```

## Setup Instructions

### 1. Enable Stripe Connect

1. Go to: https://dashboard.stripe.com/settings/connect
2. Click "Get started" or "Enable Connect"
3. Complete the Connect setup process
4. Accept terms and conditions

### 2. Configure Webhook

1. Go to: https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://your-domain.com/api/driver/payouts/webhook`
4. Select events:
   - `transfer.paid`
   - `transfer.failed`
   - `transfer.canceled`
   - `account.updated`
5. Copy webhook signing secret to `.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### 3. Environment Variables

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_...  # or sk_test_... for testing
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend URL (for return URLs)
FRONTEND_URL=https://your-app-url.com
```

### 4. Database Migration

Ensure the payout schema is applied:
```bash
cd backend
npx prisma db push
# or
npx prisma migrate dev
```

### 5. Weekly Payout Automation

**Option A: Cron Job (Recommended)**
```bash
# Add to crontab (runs every Monday at 9 AM)
0 9 * * 1 cd /path/to/backend && npm run payouts:weekly
```

**Option B: Node.js Cron**
Install `node-cron` and create a scheduled job:
```javascript
const cron = require('node-cron');
const { processWeeklyPayoutsForAllDrivers } = require('./src/services/weeklyPayoutService');

cron.schedule('0 9 * * 1', async () => {
  await processWeeklyPayoutsForAllDrivers();
});
```

**Option C: External Service**
- Use services like cron-job.org
- Set up weekly HTTP request to your API endpoint
- (You may need to add an admin endpoint for this)

## Testing

### Test Mode Setup

1. Use Stripe test mode keys:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   ```

2. Test bank accounts:
   - Success: `account_number: 000123456789`
   - Failure: `account_number: 000000000000`
   - See: https://stripe.com/docs/testing#bank-accounts

3. Test Connect accounts:
   - Create test Express account
   - Use test bank account details
   - Verify webhook events in Stripe Dashboard

### Manual Testing Flow

1. **Create Test Driver Account**
   ```bash
   # Via your app or database
   ```

2. **Create Connect Account**
   ```bash
   curl -X POST http://localhost:3000/api/driver/payouts/connect-account \
     -H "Content-Type: application/json" \
     -d '{"driverId": 1}'
   ```

3. **Complete Onboarding**
   - Use the returned `onboardingUrl`
   - Complete Stripe test onboarding
   - Verify webhook received

4. **Check Account Status**
   ```bash
   curl http://localhost:3000/api/driver/payouts/account-status?driverId=1
   ```

5. **Initiate Test Payout**
   ```bash
   curl -X POST http://localhost:3000/api/driver/payouts/initiate \
     -H "Content-Type: application/json" \
     -d '{"driverId": 1, "amount": 50.00}'
   ```

6. **Check Payout History**
   ```bash
   curl http://localhost:3000/api/driver/payouts/history?driverId=1
   ```

## Troubleshooting

### "Stripe Connect is not enabled"
- **Solution**: Enable Connect in Stripe Dashboard (see Setup #1)

### "Payouts not enabled"
- **Cause**: Driver hasn't completed onboarding
- **Solution**: Driver needs to complete Stripe onboarding

### "No available balance"
- **Cause**: No completed rides in last 7 days, or all earnings already paid
- **Solution**: Complete test rides or wait for next week

### "Webhook not receiving events"
- **Check**: Webhook endpoint URL is correct
- **Check**: `STRIPE_WEBHOOK_SECRET` is set correctly
- **Check**: Webhook is active in Stripe Dashboard
- **Test**: Use Stripe CLI: `stripe listen --forward-to localhost:3000/api/driver/payouts/webhook`

### "Transfer failed"
- **Check**: Bank account status in Stripe Dashboard
- **Check**: Account verification status
- **Review**: Failure message in payout record

## Security Considerations

1. **Authentication**: All endpoints require driver authentication
2. **Webhook Verification**: Stripe signature is verified
3. **Amount Validation**: Prevents invalid payout amounts
4. **Idempotency**: Prevents duplicate payouts
5. **Account Status Checks**: Verifies payouts are enabled before processing

## Cost Structure

- **Stripe Connect**: No monthly fee
- **Transfers**: $0.25 per transfer (US)
- **Processing Fee**: Already deducted from driver earnings (2.9% + $0.30 per ride)
- **Platform Commission**: $2.00 per ride (already deducted)

## Next Steps

1. ✅ Enable Stripe Connect in Dashboard
2. ✅ Configure webhook endpoint
3. ✅ Set up environment variables
4. ✅ Test with test mode
5. ✅ Set up weekly payout automation
6. ✅ Monitor first production payout

