/**
 * Script to check and validate test mode user IDs
 * Run with: npx ts-node scripts/check-test-users.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTestUsers() {
  try {
    console.log('🔍 Checking test mode user configuration...\n');

    // Get test mode configuration
    const testDriverId = parseInt(process.env.TEST_DRIVER_ID || '1', 10);
    const testRiderId = parseInt(process.env.TEST_RIDER_ID || '1', 10);
    const testModeEnabled = process.env.ENABLE_TEST_MODE === 'true';
    const nodeEnv = process.env.NODE_ENV || 'development';

    console.log('📋 Configuration:');
    console.log(`   NODE_ENV: ${nodeEnv}`);
    console.log(`   ENABLE_TEST_MODE: ${testModeEnabled}`);
    console.log(`   TEST_DRIVER_ID: ${testDriverId}`);
    console.log(`   TEST_RIDER_ID: ${testRiderId}\n`);

    if (!testModeEnabled) {
      console.log('⚠️  Test mode is not enabled. Set ENABLE_TEST_MODE=true in .env\n');
    }

    // Check test driver
    console.log('👤 Checking TEST_DRIVER_ID...');
    const testDriver = await prisma.users.findUnique({
      where: { id: testDriverId },
      select: {
        id: true,
        email: true,
        fullName: true,
        isDriver: true,
        phoneNumber: true,
      },
    });

    if (!testDriver) {
      console.log(`❌ ERROR: User with ID ${testDriverId} does not exist!\n`);
      console.log('💡 Solution:');
      console.log('   1. Find a valid driver user ID:');
      console.log('      SELECT id, email, "isDriver" FROM users WHERE "isDriver" = true;');
      console.log('   2. Update TEST_DRIVER_ID in .env file');
      console.log('   3. Restart backend server\n');
    } else if (!testDriver.isDriver) {
      console.log(`⚠️  WARNING: User ${testDriverId} exists but isDriver = false`);
      console.log(`   Email: ${testDriver.email}`);
      console.log(`   Name: ${testDriver.fullName || 'N/A'}\n`);
      console.log('💡 Solution:');
      console.log('   1. Update user to be a driver:');
      console.log(`      UPDATE users SET "isDriver" = true WHERE id = ${testDriverId};`);
      console.log('   2. Or use a different user ID that is already a driver\n');
    } else {
      console.log(`✅ Test driver user found:`);
      console.log(`   ID: ${testDriver.id}`);
      console.log(`   Email: ${testDriver.email}`);
      console.log(`   Name: ${testDriver.fullName || 'N/A'}`);
      console.log(`   Phone: ${testDriver.phoneNumber || 'N/A'}`);
      console.log(`   isDriver: ${testDriver.isDriver}\n`);
    }

    // Check test rider
    console.log('👤 Checking TEST_RIDER_ID...');
    const testRider = await prisma.users.findUnique({
      where: { id: testRiderId },
      select: {
        id: true,
        email: true,
        fullName: true,
        isDriver: true,
        phoneNumber: true,
      },
    });

    if (!testRider) {
      console.log(`❌ ERROR: User with ID ${testRiderId} does not exist!\n`);
      console.log('💡 Solution:');
      console.log('   1. Find a valid user ID:');
      console.log('      SELECT id, email FROM users LIMIT 1;');
      console.log('   2. Update TEST_RIDER_ID in .env file');
      console.log('   3. Restart backend server\n');
    } else {
      console.log(`✅ Test rider user found:`);
      console.log(`   ID: ${testRider.id}`);
      console.log(`   Email: ${testRider.email}`);
      console.log(`   Name: ${testRider.fullName || 'N/A'}`);
      console.log(`   Phone: ${testRider.phoneNumber || 'N/A'}\n`);
    }

    // List all available drivers
    console.log('📋 Available drivers in database:');
    const allDrivers = await prisma.users.findMany({
      where: { isDriver: true },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
      },
      orderBy: { id: 'asc' },
      take: 10,
    });

    if (allDrivers.length === 0) {
      console.log('   ⚠️  No drivers found in database!');
      console.log('   💡 Create a driver user first:\n');
    } else {
      allDrivers.forEach((driver) => {
        const isTestDriver = driver.id === testDriverId;
        console.log(
          `   ${isTestDriver ? '✅' : '  '} ID: ${driver.id} | Email: ${driver.email} | Name: ${driver.fullName || 'N/A'}`
        );
      });
      console.log('');
    }

    // Summary
    console.log('📊 Summary:');
    const driverValid = testDriver && testDriver.isDriver;
    const riderValid = testRider !== null;

    if (driverValid && riderValid && testModeEnabled) {
      console.log('   ✅ Test mode is properly configured!');
      console.log('   ✅ All test users are valid');
    } else {
      console.log('   ⚠️  Test mode configuration needs attention:');
      if (!testModeEnabled) {
        console.log('      - Enable test mode: ENABLE_TEST_MODE=true');
      }
      if (!driverValid) {
        console.log('      - Fix TEST_DRIVER_ID (see above)');
      }
      if (!riderValid) {
        console.log('      - Fix TEST_RIDER_ID (see above)');
      }
    }
    console.log('');

  } catch (error) {
    console.error('❌ Error checking test users:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkTestUsers();

