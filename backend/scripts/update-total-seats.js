"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../src/lib/prisma");
async function updateTotalSeats() {
    try {
        const rides = await prisma_1.prisma.rides.findMany();
        console.log(`Found ${rides.length} rides to update`);
        for (const ride of rides) {
            await prisma_1.prisma.rides.update({
                where: { id: ride.id },
                data: { totalSeats: ride.availableSeats },
            });
            console.log(`✅ Updated ride ${ride.id}: totalSeats = ${ride.availableSeats}`);
        }
        console.log(`\n✅ Successfully updated ${rides.length} rides`);
    }
    catch (error) {
        console.error('❌ Error:', error);
    }
    finally {
        await prisma_1.prisma.$disconnect();
    }
}
updateTotalSeats();
//# sourceMappingURL=update-total-seats.js.map