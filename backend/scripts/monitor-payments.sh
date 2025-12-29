#!/bin/bash

# Payment Monitoring Script
# Monitors payment status in the database and provides real-time insights

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Payment Status Monitor${NC}"
echo "================================"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql is not installed. Please install PostgreSQL client.${NC}"
    exit 1
fi

# Get database URL from environment or use default
DB_URL=${DATABASE_URL:-"postgresql://user:password@localhost:5432/waypool"}

echo -e "${YELLOW}📊 Payment Status Summary${NC}"
echo "--------------------------------"
psql "$DB_URL" -c "
SELECT 
    COALESCE(payment_status, 'no_payment') as status,
    COUNT(*) as count,
    COALESCE(SUM(payment_amount), 0) as total_amount,
    COALESCE(AVG(payment_amount), 0) as avg_amount
FROM bookings
WHERE payment_intent_id IS NOT NULL
GROUP BY payment_status
ORDER BY count DESC;
"

echo ""
echo -e "${YELLOW}💰 Recent Payments (Last 10)${NC}"
echo "--------------------------------"
psql "$DB_URL" -c "
SELECT 
    confirmation_number,
    payment_status,
    payment_amount,
    refund_amount,
    created_at,
    updated_at
FROM bookings
WHERE payment_intent_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
"

echo ""
echo -e "${YELLOW}⚠️  Payment Issues${NC}"
echo "--------------------------------"

# Failed payments
FAILED_COUNT=$(psql "$DB_URL" -t -c "
SELECT COUNT(*) 
FROM bookings 
WHERE payment_status = 'failed' 
  AND payment_intent_id IS NOT NULL;
" | xargs)

if [ "$FAILED_COUNT" -gt 0 ]; then
    echo -e "${RED}❌ Failed Payments: $FAILED_COUNT${NC}"
    psql "$DB_URL" -c "
    SELECT 
        confirmation_number,
        payment_amount,
        payment_intent_id,
        created_at
    FROM bookings
    WHERE payment_status = 'failed'
      AND payment_intent_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 5;
    "
else
    echo -e "${GREEN}✅ No failed payments${NC}"
fi

# Long-pending payments (more than 24 hours)
PENDING_COUNT=$(psql "$DB_URL" -t -c "
SELECT COUNT(*) 
FROM bookings 
WHERE payment_status IN ('pending', 'authorized')
  AND payment_intent_id IS NOT NULL
  AND created_at < NOW() - INTERVAL '24 hours';
" | xargs)

if [ "$PENDING_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⏳ Long-Pending Payments: $PENDING_COUNT${NC}"
    psql "$DB_URL" -c "
    SELECT 
        confirmation_number,
        payment_status,
        payment_amount,
        created_at,
        EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as hours_pending
    FROM bookings
    WHERE payment_status IN ('pending', 'authorized')
      AND payment_intent_id IS NOT NULL
      AND created_at < NOW() - INTERVAL '24 hours'
    ORDER BY created_at ASC
    LIMIT 5;
    "
else
    echo -e "${GREEN}✅ No long-pending payments${NC}"
fi

# Refunded payments
REFUNDED_COUNT=$(psql "$DB_URL" -t -c "
SELECT COUNT(*) 
FROM bookings 
WHERE refund_amount > 0;
" | xargs)

if [ "$REFUNDED_COUNT" -gt 0 ]; then
    TOTAL_REFUNDED=$(psql "$DB_URL" -t -c "
    SELECT COALESCE(SUM(refund_amount), 0) 
    FROM bookings 
    WHERE refund_amount > 0;
    " | xargs)
    echo -e "${BLUE}💰 Refunded Payments: $REFUNDED_COUNT (Total: \$$TOTAL_REFUNDED)${NC}"
    psql "$DB_URL" -c "
    SELECT 
        confirmation_number,
        payment_amount,
        refund_amount,
        refunded_at
    FROM bookings
    WHERE refund_amount > 0
    ORDER BY refunded_at DESC
    LIMIT 5;
    "
else
    echo -e "${GREEN}✅ No refunded payments${NC}"
fi

echo ""
echo -e "${GREEN}✅ Monitoring complete${NC}"

