# Driver Payout Implementation Guide

## Overview
This feature allows drivers to link their bank accounts via Stripe Connect and receive automatic weekly payouts based on their net earnings.

## Architecture

### Backend Components

1. **Database Schema** (`prisma/schema.prisma`)
   - Added Stripe Connect fields to `users` table:
     - `stripeAccountId`: Stripe Connect account ID
     - `stripeAccountStatus`: Account status (pending, enabled, etc.)
     - `bankAccountId`: Linked bank account ID
     - `bankAccountLast4`: Last 4 digits of bank account
     - `bankAccountType`: checking or savings
     - `bankAccountStatus`: Account verification status
     - `payoutsEnabled`: Whether payouts are enabled
   - Created `payouts` table to track all payout transactions

2. **API Routes** (`src/routes/driver/payouts.ts`)
   - `POST /api/driver/payouts/connect-account` - Create Stripe Connect account
   - `GET /api/driver/payouts/account-status` - Get account and bank account status
   - `POST /api/driver/payouts/create-account-link` - Create onboarding/update link
   - `POST /api/driver/payouts/initiate` - Manually initiate a payout
   - `GET /api/driver/payouts/history` - Get payout history
   - `GET /api/driver/payouts/balance` - Get available balance for payout

3. **Weekly Payout Service** (`src/services/weeklyPayoutService.ts`)
   - `calculateWeeklyEarningsForAllDrivers()` - Calculate weekly net earnings
   - `processWeeklyPayoutForDriver()` - Process payout for single driver
   - `processWeeklyPayoutsForAllDrivers()` - Process payouts for all eligible drivers

4. **Webhook Handler** (`src/routes/driver/payouts-webhook.ts`)
   - Handles Stripe webhook events for payout status updates

### Frontend Components

1. **API Functions** (`driver-app/services/api.ts`)
   - `createConnectAccount()` - Create/retrieve Stripe Connect account
   - `getAccountStatus()` - Get account status
   - `createAccountLink()` - Create onboarding link
   - `initiatePayout()` - Initiate manual payout
   - `getPayoutHistory()` - Get payout history
   - `getPayoutBalance()` - Get available balance

2. **Screens**
   - `app/payouts.tsx` - Main payouts screen (bank account setup, balance, quick payout)
   - `app/payout-history.tsx` - Detailed payout history

## Setup Instructions

### 1. Database Migration

Run the migration to add the new fields and table:

```bash
cd backend
npx prisma migrate dev --name add_payouts
```

Or manually run the SQL script:
```bash
psql -d your_database < prisma/migrations/add_payouts.sql
```

### 2. Stripe Connect Setup

1. **Enable Stripe Connect** in your Stripe Dashboard
   - Go to Settings > Connect
   - Enable Express accounts

2. **Configure Webhook Endpoint**
   - Go to Developers > Webhooks
   - Add endpoint: `https://your-domain.com/api/driver/payouts/webhook`
   - Select events:
     - `transfer.paid`
     - `transfer.failed`
     - `transfer.canceled`
     - `account.updated`
   - Copy the webhook secret to `STRIPE_WEBHOOK_SECRET` in `.env`

3. **Environment Variables**
   ```env
   STRIPE_SECRET_KEY=sk_live_... (or sk_test_...)
   STRIPE_WEBHOOK_SECRET=whsec_...
   FRONTEND_URL=https://your-frontend-url.com
   ```

### 3. Weekly Payout Automation

Create a cron job or scheduled task to run weekly payouts:

**Option 1: Node.js Cron Job**
```javascript
// scripts/weekly-payouts.js
const cron = require('node-cron');
const { processWeeklyPayoutsForAllDrivers } = require('../src/services/weeklyPayoutService');

// Run every Monday at 9 AM
cron.schedule('0 9 * * 1', async () => {
  console.log('Starting weekly payouts...');
  const result = await processWeeklyPayoutsForAllDrivers();
  console.log('Weekly payouts completed:', result);
});
```

**Option 2: Manual API Endpoint** (for testing)
```typescript
// Add to src/routes/driver/payouts.ts
router.post('/process-weekly', async (req, res) => {
  // Add admin authentication here
  const result = await processWeeklyPayoutsForAllDrivers();
  return sendSuccess(res, 'Weekly payouts processed', result);
});
```

**Option 3: External Cron Service**
- Use services like cron-job.org or GitHub Actions
- Call your API endpoint weekly

## Usage Flow

### Driver Onboarding

1. Driver opens Payouts screen
2. Clicks "Set Up Bank Account"
3. Redirected to Stripe onboarding (hosted by Stripe)
4. Completes bank account verification
5. Returns to app with account linked

### Weekly Payouts

1. System calculates weekly net earnings (last 7 days)
2. For each driver with earnings > $0:
   - Creates Stripe transfer to driver's Connect account
   - Records payout in database
   - Driver receives funds in 2-7 business days

### Manual Payouts

Drivers can also request payouts manually:
1. View available balance on Payouts screen
2. Click "Request Payout"
3. Confirm amount
4. Payout initiated immediately

## Payout Calculation

Weekly net earnings = Sum of (net earnings from completed rides in last 7 days)

Net earnings per ride = Gross earnings - Processing fee (2.9% + $0.30) - Commission ($2.00)

Available balance = Weekly net earnings - Pending payouts

## Security Considerations

1. **Authentication**: All endpoints require driver authentication
2. **Validation**: Amount validation, account status checks
3. **Webhook Verification**: Stripe webhook signature verification
4. **Idempotency**: Prevents duplicate payouts for same period

## Testing

### Test Mode
- Use Stripe test mode keys
- Test bank accounts: https://stripe.com/docs/testing#bank-accounts
- Test account: `acct_1TestAccount`

### Manual Testing
1. Create test driver account
2. Complete test rides
3. Link test bank account
4. Initiate test payout
5. Verify in Stripe Dashboard

## Monitoring

- Check payout status in Stripe Dashboard
- Monitor webhook events
- Review payout history in database
- Set up alerts for failed payouts

## Troubleshooting

### Common Issues

1. **"Payouts not enabled"**
   - Driver needs to complete Stripe onboarding
   - Check `payouts_enabled` in Stripe account

2. **"No available balance"**
   - Driver has no completed rides in last 7 days
   - All earnings already paid out

3. **"Webhook not receiving events"**
   - Verify webhook endpoint URL
   - Check webhook secret in `.env`
   - Verify Stripe webhook is active

4. **"Transfer failed"**
   - Check bank account status
   - Verify account details in Stripe
   - Review failure message in payout record

## Cost Structure

- **Stripe Connect**: No monthly fee
- **Transfers**: $0.25 per transfer (US)
- **Processing Fee**: Already deducted from driver earnings (2.9% + $0.30)
- **Platform Commission**: $2.00 per ride (already deducted)

## Future Enhancements

- Scheduled payouts (daily, weekly, monthly options)
- Payout thresholds (minimum amount before payout)
- Multiple bank accounts
- Instant payouts (for a fee)
- Payout notifications

