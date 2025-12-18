"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../src/lib/prisma");
async function clearAllData() {
    try {
        console.log('🗑️  Starting database cleanup...\n');
        // Delete in order to respect foreign key constraints
        console.log('Deleting ratings...');
        const ratings = await prisma_1.prisma.ratings.deleteMany();
        console.log(`✅ Deleted ${ratings.count} ratings`);
        console.log('Deleting messages...');
        const messages = await prisma_1.prisma.messages.deleteMany();
        console.log(`✅ Deleted ${messages.count} messages`);
        console.log('Deleting notifications...');
        const notifications = await prisma_1.prisma.notifications.deleteMany();
        console.log(`✅ Deleted ${notifications.count} notifications`);
        console.log('Deleting bookings...');
        const bookings = await prisma_1.prisma.bookings.deleteMany();
        console.log(`✅ Deleted ${bookings.count} bookings`);
        console.log('Deleting rides...');
        const rides = await prisma_1.prisma.rides.deleteMany();
        console.log(`✅ Deleted ${rides.count} rides`);
        console.log('Deleting users...');
        const users = await prisma_1.prisma.users.deleteMany();
        console.log(`✅ Deleted ${users.count} users`);
        console.log('\n✨ Database cleared successfully!');
        console.log('📊 Schema remains intact - only data was removed.\n');
    }
    catch (error) {
        console.error('❌ Error clearing database:', error);
        throw error;
    }
    finally {
        await prisma_1.prisma.$disconnect();
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
//# sourceMappingURL=clear-data.js.map