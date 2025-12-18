/**
 * Script to create a test user for test mode
 * Run with: npx ts-node scripts/create-test-user.ts
 */

import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import * as bcrypt from 'bcrypt';

async function createTestUser() {
  try {
    console.log('🔧 Creating test user...\n');

    const testEmail = process.env.TEST_USER_EMAIL || 'test@waypool.com';
    const testPassword = process.env.TEST_USER_PASSWORD || 'test123456';
    const testName = process.env.TEST_USER_NAME || 'Test Driver';
    const testPhone = process.env.TEST_USER_PHONE || '1234567890';

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email: testEmail },
    });

    if (existingUser) {
      console.log(`⚠️  User with email ${testEmail} already exists (ID: ${existingUser.id})`);
      console.log(`   Updating to ensure isDriver = true...\n`);

      // Update existing user to be a driver
      const updatedUser = await prisma.users.update({
        where: { id: existingUser.id },
        data: {
          isDriver: true,
          fullName: testName,
          phoneNumber: testPhone,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          isDriver: true,
          phoneNumber: true,
        },
      });

      console.log('✅ Test user updated:');
      console.log(`   ID: ${updatedUser.id}`);
      console.log(`   Email: ${updatedUser.email}`);
      console.log(`   Name: ${updatedUser.fullName}`);
      console.log(`   Phone: ${updatedUser.phoneNumber}`);
      console.log(`   isDriver: ${updatedUser.isDriver}\n`);

      console.log('📝 Add to your .env file:');
      console.log(`   TEST_DRIVER_ID=${updatedUser.id}`);
      console.log(`   TEST_RIDER_ID=${updatedUser.id}\n`);

      return;
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(testPassword, saltRounds);

    // Create new user
    const newUser = await prisma.users.create({
      data: {
        fullName: testName,
        email: testEmail,
        phoneNumber: testPhone,
        password: hashedPassword,
        isDriver: true,
        isRider: false,
        city: 'Test City',
        carMake: 'Test Make',
        carModel: 'Test Model',
        carYear: 2020,
        carColor: 'Test Color',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        isDriver: true,
        phoneNumber: true,
      },
    });

    console.log('✅ Test user created:');
    console.log(`   ID: ${newUser.id}`);
    console.log(`   Email: ${newUser.email}`);
    console.log(`   Name: ${newUser.fullName}`);
    console.log(`   Phone: ${newUser.phoneNumber}`);
    console.log(`   isDriver: ${newUser.isDriver}\n`);

    console.log('📝 Add to your .env file:');
    console.log(`   TEST_DRIVER_ID=${newUser.id}`);
    console.log(`   TEST_RIDER_ID=${newUser.id}`);
    console.log(`   ENABLE_TEST_MODE=true\n`);

    console.log('🔐 Test credentials:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}\n`);

  } catch (error) {
    console.error('❌ Error creating test user:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();

