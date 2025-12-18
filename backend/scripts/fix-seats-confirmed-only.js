"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../src/lib/prisma");
async function fixAvailableSeats() {
    try {
        const rides = await prisma_1.prisma.rides.findMany({
            where: {
                status: {
                    in: ['scheduled', 'in-progress'],
                },
            },
            include: {
                bookings: {
                    where: {
                        status: 'confirmed', // Only count confirmed bookings
                    },
                },
            },
        });
        console.log(`Found ${rides.length} active rides to check`);
        for (const ride of rides) {
            // Calculate total confirmed booked seats
            const totalBookedSeats = ride.bookings.reduce((sum, booking) => sum + (booking.numberOfSeats || 0), 0);
            // Calculate correct available seats
            const correctAvailableSeats = ride.totalSeats - totalBookedSeats;
            if (ride.availableSeats !== correctAvailableSeats) {
                console.log(`\n🔧 Fixing ride ${ride.id}:`);
                console.log(`   Total seats: ${ride.totalSeats}`);
                console.log(`   Confirmed bookings: ${totalBookedSeats} (${ride.bookings.length} confirmed)`);
                console.log(`   Current available: ${ride.availableSeats}`);
                console.log(`   Should be: ${correctAvailableSeats}`);
                await prisma_1.prisma.rides.update({
                    where: { id: ride.id },
                    data: { availableSeats: correctAvailableSeats },
                });
                console.log(`   ✅ Updated!`);
            }
            else {
                console.log(`✅ Ride ${ride.id} is already correct (${ride.availableSeats} available of ${ride.totalSeats})`);
            }
        }
        console.log(`\n✅ All rides fixed!`);
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    finally {
        await prisma_1.prisma.$disconnect();
    }
}
fixAvailableSeats();
//# sourceMappingURL=fix-seats-confirmed-only.js.map