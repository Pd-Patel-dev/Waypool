import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function clearAllData() {
  try {
    console.log('🗑️  Starting database cleanup...\n');

    // Delete in order to respect foreign key constraints
    // Delete child tables first, then parent tables
    
    console.log('Deleting ratings...');
    const ratings = await prisma.ratings.deleteMany();
    console.log(`✅ Deleted ${ratings.count} ratings`);

    console.log('Deleting messages...');
    const messages = await prisma.messages.deleteMany();
    console.log(`✅ Deleted ${messages.count} messages`);

    console.log('Deleting notifications...');
    const notifications = await prisma.notifications.deleteMany();
    console.log(`✅ Deleted ${notifications.count} notifications`);

    console.log('Deleting bookings...');
    const bookings = await prisma.bookings.deleteMany();
    console.log(`✅ Deleted ${bookings.count} bookings`);

    console.log('Deleting payouts...');
    const payouts = await prisma.payouts.deleteMany();
    console.log(`✅ Deleted ${payouts.count} payouts`);

    console.log('Deleting saved addresses...');
    const savedAddresses = await prisma.savedAddresses.deleteMany();
    console.log(`✅ Deleted ${savedAddresses.count} saved addresses`);

    console.log('Deleting rides...');
    const rides = await prisma.rides.deleteMany();
    console.log(`✅ Deleted ${rides.count} rides`);

    console.log('Deleting email verification codes...');
    const emailVerificationCodes = await prisma.emailVerificationCodes.deleteMany();
    console.log(`✅ Deleted ${emailVerificationCodes.count} email verification codes`);

    console.log('Deleting users...');
    const users = await prisma.users.deleteMany();
    console.log(`✅ Deleted ${users.count} users`);

    console.log('\n✨ Database cleared successfully!');
    console.log('📊 Schema remains intact - only data was removed.\n');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
clearAllData()
  .then(() => {
    console.log('✅ Complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });





