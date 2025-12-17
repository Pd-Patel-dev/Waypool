import { prisma } from '../src/lib/prisma';

async function testEarningsAPI() {
  try {
    console.log('\n🧪 TESTING EARNINGS API\n');
    
    // Get all drivers with completed rides
    const drivers = await prisma.rides.findMany({
      where: {
        status: 'completed',
      },
      select: {
        driverId: true,
        driverName: true,
      },
      distinct: ['driverId'],
    });

    console.log(`Found ${drivers.length} drivers with completed rides:\n`);
    
    for (const driver of drivers) {
      console.log(`\n📊 Testing earnings for Driver ID: ${driver.driverId} (${driver.driverName})`);
      console.log(`   API URL: http://localhost:3000/api/driver/earnings?driverId=${driver.driverId}`);
      
      // Simulate what the API does
      const completedRides = await prisma.rides.findMany({
        where: {
          driverId: driver.driverId,
          status: 'completed',
        },
        include: {
          bookings: {
            where: {
              status: {
                in: ['confirmed', 'completed'],
              },
            },
            select: {
              numberOfSeats: true,
              status: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      const PRICE_PER_KM = 1.5;
      const PRICE_PER_PASSENGER = 5;

      let totalEarnings = 0;
      let totalRides = 0;
      let totalPassengers = 0;
      let totalDistance = 0;

      completedRides.forEach((ride) => {
        const passengers = ride.bookings.reduce((sum, booking) => sum + (booking.numberOfSeats || 1), 0);
        const distance = ride.distance || 0;
        
        const distanceEarnings = distance * PRICE_PER_KM;
        const passengerEarnings = passengers * PRICE_PER_PASSENGER;
        const rideEarnings = distanceEarnings + passengerEarnings;

        totalEarnings += rideEarnings;
        totalRides += 1;
        totalPassengers += passengers;
        totalDistance += distance;

        console.log(`   Ride #${ride.id}:`);
        console.log(`     - ${ride.fromCity} → ${ride.toCity}`);
        console.log(`     - Distance: ${distance.toFixed(2)} km`);
        console.log(`     - Passengers: ${passengers}`);
        console.log(`     - Bookings: ${ride.bookings.length} (${ride.bookings.map(b => b.status).join(', ')})`);
        console.log(`     - Earnings: $${rideEarnings.toFixed(2)}`);
      });

      console.log(`\n   ✅ TOTAL EARNINGS: $${totalEarnings.toFixed(2)}`);
      console.log(`   📈 Total Rides: ${totalRides}`);
      console.log(`   👥 Total Passengers: ${totalPassengers}`);
      console.log(`   📏 Total Distance: ${totalDistance.toFixed(2)} km`);
      console.log(`   💵 Avg per Ride: $${totalRides > 0 ? (totalEarnings / totalRides).toFixed(2) : '0.00'}`);
    }

    if (drivers.length === 0) {
      console.log('❌ No drivers with completed rides found!');
      console.log('   This is why earnings screen shows no data.');
      console.log('   Complete a ride first to see earnings.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testEarningsAPI();

