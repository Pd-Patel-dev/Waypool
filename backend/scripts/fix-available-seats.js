"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../src/lib/prisma");
async function fixAvailableSeats() {
    try {
        const rides = await prisma_1.prisma.rides.findMany({
            where: {
                status: 'scheduled',
            },
            include: {
                bookings: {
                    where: {
                        status: {
                            in: ['pending', 'confirmed'],
                        },
                    },
                },
            },
        });
        console.log(`Found ${rides.length} scheduled rides to check`);
        for (const ride of rides) {
            // Calculate total booked seats
            const totalBookedSeats = ride.bookings.reduce((sum, booking) => sum + (booking.numberOfSeats || 0), 0);
            // Calculate correct available seats
            const correctAvailableSeats = ride.totalSeats - totalBookedSeats;
            if (ride.availableSeats !== correctAvailableSeats) {
                console.log(`\n🔧 Fixing ride ${ride.id}:`);
                console.log(`   Total seats: ${ride.totalSeats}`);
                console.log(`   Booked seats: ${totalBookedSeats} (${ride.bookings.length} bookings)`);
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
//# sourceMappingURL=fix-available-seats.js.map