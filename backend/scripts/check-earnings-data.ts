import { prisma } from '../src/lib/prisma';

async function checkEarningsData() {
  try {
    // Get all completed rides
    const completedRides = await prisma.rides.findMany({
      where: {
        status: 'completed',
      },
      include: {
        bookings: {
          where: {
            status: {
              in: ['confirmed', 'completed'],
            },
          },
        },
      },
    });

    console.log('\n📊 COMPLETED RIDES CHECK\n');
    console.log(`Found ${completedRides.length} completed rides\n`);

    if (completedRides.length === 0) {
      console.log('❌ No completed rides found in database');
      console.log('   This is why earnings are not showing.');
      console.log('   Complete a ride first to see earnings.\n');
    } else {
      completedRides.forEach((ride, index) => {
        const bookingsCount = ride.bookings.length;
        const totalPassengers = ride.bookings.reduce(
          (sum, b) => sum + (b.numberOfSeats || 1),
          0
        );
        const distance = ride.distance || 0;
        const earnings = (distance * 1.5) + (totalPassengers * 5);

        console.log(`${index + 1}. Ride #${ride.id}`);
        console.log(`   Driver: ${ride.driverName} (ID: ${ride.driverId})`);
        console.log(`   Route: ${ride.fromCity} → ${ride.toCity}`);
        console.log(`   Distance: ${distance} km`);
        console.log(`   Bookings: ${bookingsCount} (${totalPassengers} passengers)`);
        console.log(`   Earnings: $${earnings.toFixed(2)}`);
        console.log(`   Completed: ${ride.updatedAt.toLocaleDateString()}`);
        console.log('');
      });

      console.log(`💰 Total earnings across all drivers: $${completedRides.reduce((sum, ride) => {
        const passengers = ride.bookings.reduce((s, b) => s + (b.numberOfSeats || 1), 0);
        const distance = ride.distance || 0;
        return sum + (distance * 1.5) + (passengers * 5);
      }, 0).toFixed(2)}\n`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEarningsData();

