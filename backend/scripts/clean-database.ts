import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { prisma } from '../src/lib/prisma';

async function cleanDatabase() {
  try {
    console.log('🧹 Starting database cleanup...');

    // Delete in order to respect foreign key constraints
    console.log('  - Deleting notifications...');
    const deletedNotifications = await prisma.notification.deleteMany({});
    console.log(`    ✅ Deleted ${deletedNotifications.count} notifications`);

    console.log('  - Deleting bookings...');
    const deletedBookings = await prisma.booking.deleteMany({});
    console.log(`    ✅ Deleted ${deletedBookings.count} bookings`);

    console.log('  - Deleting rides...');
    const deletedRides = await prisma.ride.deleteMany({});
    console.log(`    ✅ Deleted ${deletedRides.count} rides`);

    console.log('  - Deleting users...');
    const deletedUsers = await prisma.user.deleteMany({});
    console.log(`    ✅ Deleted ${deletedUsers.count} users`);

    console.log('✅ Database cleanup completed successfully!');
  } catch (error) {
    console.error('❌ Error cleaning database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanDatabase()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
