# Automatic Weekly Payouts Setup

## Overview
Stripe Connect supports automatic weekly payouts that Stripe handles automatically. This is the recommended approach for weekly payouts.

## Setup in Stripe Dashboard

### Option 1: Stripe Dashboard (Recommended - One-Time Setup)

1. **Go to Stripe Dashboard**
   - Navigate to: https://dashboard.stripe.com/connect/accounts/overview

2. **Enable Automatic Payouts**
   - Go to Settings > Connect > Express accounts
   - Enable "Automatic payouts"
   - Set schedule: Weekly (every Monday, or your preferred day)
   - Stripe will automatically transfer funds to connected accounts

3. **Configure Payout Schedule**
   - Choose payout frequency: Weekly
   - Choose payout day: Monday (or your preferred day)
   - Set minimum payout amount (optional): $1.00
   - Stripe will automatically process payouts for all connected accounts

### Option 2: Per-Account Settings (If needed)

If you need different schedules per driver:
1. Go to the specific Connect account in Stripe Dashboard
2. Settings > Payouts
3. Enable automatic payouts
4. Set schedule

## How It Works

1. **Driver completes onboarding** → Bank account linked
2. **Driver earns money** → Funds accumulate in platform account
3. **Weekly (automatic)** → Stripe automatically transfers to driver's bank account
4. **No code needed** → Stripe handles everything

## Benefits

- ✅ **No code required** - Stripe handles everything
- ✅ **Automatic** - No cron jobs or scheduled tasks needed
- ✅ **Reliable** - Stripe's infrastructure handles it
- ✅ **Consistent** - Same schedule for all drivers
- ✅ **Less maintenance** - No need to monitor or fix payout scripts

## Manual Payouts (Still Available)

Drivers can still request manual payouts via:
- `POST /api/driver/payouts/initiate` endpoint
- "Request Payout" button in the app

## Monitoring

- View payouts in Stripe Dashboard: https://dashboard.stripe.com/payouts
- View per-account payouts: Connect > Accounts > [Account] > Payouts
- Webhooks still work for status updates

## Testing

- Test mode supports automatic payouts
- Use test bank accounts
- Payouts will process automatically in test mode too

## Notes

- Automatic payouts are free (no additional fee)
- Stripe handles the scheduling and processing
- You can still track payouts via webhooks
- Manual payouts remain available as backup


