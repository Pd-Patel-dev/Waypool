/**
 * Weekly Payout Automation Script
 * Processes weekly payouts for all eligible drivers
 * 
 * Run this script weekly (e.g., every Monday) via cron job or scheduled task
 * 
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/weekly-payouts.ts
 */

import 'dotenv/config';
import { processWeeklyPayoutsForAllDrivers } from '../src/services/weeklyPayoutService';

async function main() {
  console.log('🚀 Starting weekly payout processing...');
  console.log(`📅 Date: ${new Date().toISOString()}\n`);

  try {
    const result = await processWeeklyPayoutsForAllDrivers();

    console.log('\n✅ Weekly payout processing completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total drivers processed: ${result.totalProcessed}`);
    console.log(`   - Successful payouts: ${result.successes}`);
    console.log(`   - Failed payouts: ${result.failures}`);
    console.log(`   - Total amount: $${result.totalAmount.toFixed(2)}`);

    if (result.results.length > 0) {
      console.log('\n📋 Detailed Results:');
      result.results.forEach((r) => {
        const status = r.success ? '✅' : '❌';
        console.log(`   ${status} Driver ${r.driverId}: $${r.amount.toFixed(2)} ${r.error ? `- ${r.error}` : ''}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error processing weekly payouts:', error);
    process.exit(1);
  }
}

main();

