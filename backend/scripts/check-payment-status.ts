/**
 * Payment Status Monitoring Script
 * 
 * This script queries the database to check payment status transitions
 * and provides insights into payment processing.
 * 
 * Usage:
 *   npx ts-node scripts/check-payment-status.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PaymentStatusSummary {
  status: string;
  count: number;
  totalAmount: number;
  averageAmount: number;
}

async function checkPaymentStatus() {
  console.log('🔍 Payment Status Monitoring\n');
  console.log('='.repeat(60));

  try {
    // Get all bookings with payment information
    const bookings = await prisma.bookings.findMany({
      where: {
        paymentIntentId: {
          not: null,
        },
      },
      select: {
        id: true,
        confirmationNumber: true,
        status: true,
        paymentStatus: true,
        paymentAmount: true,
        paymentCurrency: true,
        refundAmount: true,
        refundedAt: true,
        paymentIntentId: true,
        createdAt: true,
        updatedAt: true,
        users: {
          select: {
            email: true,
            fullName: true,
          },
        },
        rides: {
          select: {
            id: true,
            fromAddress: true,
            toAddress: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Last 50 bookings with payments
    });

    console.log(`\n📊 Found ${bookings.length} bookings with payment information\n`);

    // Summary by payment status
    const statusSummary: { [key: string]: PaymentStatusSummary } = {};
    
    bookings.forEach(booking => {
      const status = booking.paymentStatus || 'unknown';
      if (!statusSummary[status]) {
        statusSummary[status] = {
          status,
          count: 0,
          totalAmount: 0,
          averageAmount: 0,
        };
      }
      statusSummary[status].count++;
      if (booking.paymentAmount) {
        statusSummary[status].totalAmount += booking.paymentAmount;
      }
    });

    // Calculate averages
    Object.keys(statusSummary).forEach(status => {
      const summary = statusSummary[status];
      summary.averageAmount = summary.totalAmount / summary.count;
    });

    console.log('📈 Payment Status Summary:');
    console.log('-'.repeat(60));
    Object.values(statusSummary).forEach(summary => {
      console.log(`${summary.status.padEnd(25)} | Count: ${summary.count.toString().padStart(4)} | Total: $${summary.totalAmount.toFixed(2).padStart(10)} | Avg: $${summary.averageAmount.toFixed(2).padStart(10)}`);
    });
    console.log('-'.repeat(60));

    // Recent payment activity
    console.log('\n🕐 Recent Payment Activity (Last 10):');
    console.log('-'.repeat(60));
    bookings.slice(0, 10).forEach(booking => {
      const date = new Date(booking.createdAt).toLocaleString();
      const amount = booking.paymentAmount ? `$${booking.paymentAmount.toFixed(2)}` : 'N/A';
      const refund = booking.refundAmount ? ` (Refunded: $${booking.refundAmount.toFixed(2)})` : '';
      console.log(`${date} | ${booking.paymentStatus?.padEnd(15)} | ${amount.padStart(10)}${refund} | ${booking.confirmationNumber}`);
    });
    console.log('-'.repeat(60));

    // Payment issues (failed, pending for too long)
    console.log('\n⚠️  Payment Issues:');
    console.log('-'.repeat(60));
    
    const failedPayments = bookings.filter(b => b.paymentStatus === 'failed');
    if (failedPayments.length > 0) {
      console.log(`\n❌ Failed Payments (${failedPayments.length}):`);
      failedPayments.forEach(booking => {
        console.log(`  - Booking #${booking.confirmationNumber} | Amount: $${booking.paymentAmount?.toFixed(2) || 'N/A'} | Payment Intent: ${booking.paymentIntentId}`);
      });
    }

    const pendingPayments = bookings.filter(b => {
      if (b.paymentStatus !== 'pending' && b.paymentStatus !== 'authorized') return false;
      const hoursPending = (Date.now() - booking.createdAt.getTime()) / (1000 * 60 * 60);
      return hoursPending > 24; // Pending for more than 24 hours
    });
    
    if (pendingPayments.length > 0) {
      console.log(`\n⏳ Long-Pending Payments (${pendingPayments.length}):`);
      pendingPayments.forEach(booking => {
        const hoursPending = (Date.now() - booking.createdAt.getTime()) / (1000 * 60 * 60);
        console.log(`  - Booking #${booking.confirmationNumber} | Status: ${booking.paymentStatus} | Pending: ${hoursPending.toFixed(1)} hours`);
      });
    }

    // Refund summary
    const refundedPayments = bookings.filter(b => b.refundAmount && b.refundAmount > 0);
    if (refundedPayments.length > 0) {
      console.log(`\n💰 Refunded Payments (${refundedPayments.length}):`);
      const totalRefunded = refundedPayments.reduce((sum, b) => sum + (b.refundAmount || 0), 0);
      console.log(`  Total Refunded: $${totalRefunded.toFixed(2)}`);
      refundedPayments.slice(0, 5).forEach(booking => {
        const refundDate = booking.refundedAt ? new Date(booking.refundedAt).toLocaleString() : 'N/A';
        console.log(`  - Booking #${booking.confirmationNumber} | Refunded: $${booking.refundAmount?.toFixed(2)} | Date: ${refundDate}`);
      });
    }

    if (failedPayments.length === 0 && pendingPayments.length === 0) {
      console.log('  ✅ No payment issues detected');
    }

    // Payment status transitions
    console.log('\n🔄 Payment Status Transitions:');
    console.log('-'.repeat(60));
    const transitions: { [key: string]: number } = {};
    bookings.forEach(booking => {
      const status = booking.paymentStatus || 'unknown';
      transitions[status] = (transitions[status] || 0) + 1;
    });
    
    const sortedTransitions = Object.entries(transitions).sort((a, b) => b[1] - a[1]);
    sortedTransitions.forEach(([status, count]) => {
      const percentage = ((count / bookings.length) * 100).toFixed(1);
      console.log(`${status.padEnd(25)} | ${count.toString().padStart(4)} (${percentage.padStart(5)}%)`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Payment status check completed\n');

  } catch (error) {
    console.error('❌ Error checking payment status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run check
checkPaymentStatus().catch(console.error);

