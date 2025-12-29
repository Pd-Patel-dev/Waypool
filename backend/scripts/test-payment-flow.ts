/**
 * Payment Flow Testing Script
 * 
 * This script tests the complete payment flow:
 * 1. Create booking with payment
 * 2. Accept booking (capture payment)
 * 3. Cancel booking (refund)
 * 4. Retry failed payment
 * 
 * Usage:
 *   npx ts-node scripts/test-payment-flow.ts
 * 
 * Prerequisites:
 *   - Backend server running
 *   - Valid test Stripe keys
 *   - Test user accounts (rider and driver)
 */

import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const RIDER_EMAIL = process.env.TEST_RIDER_EMAIL || 'rider@test.com';
const RIDER_PASSWORD = process.env.TEST_RIDER_PASSWORD || 'password123';
const DRIVER_EMAIL = process.env.TEST_DRIVER_EMAIL || 'driver@test.com';
const DRIVER_PASSWORD = process.env.TEST_DRIVER_PASSWORD || 'password123';

interface TestResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
}

const results: TestResult[] = [];

async function logResult(step: string, success: boolean, message: string, data?: any) {
  results.push({ step, success, message, data });
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${step}: ${message}`);
  if (data) {
    console.log('   Data:', JSON.stringify(data, null, 2));
  }
}

async function login(email: string, password: string): Promise<string | null> {
  try {
    const response = await fetch(`${API_URL}/api/rider/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const result = await response.json();
    if (result.tokens?.accessToken) {
      return result.tokens.accessToken;
    } else if (result.token) {
      return result.token;
    }
    return null;
  } catch (error) {
    console.error('Login error:', error);
    return null;
  }
}

async function createRide(driverToken: string): Promise<number | null> {
  try {
    const response = await fetch(`${API_URL}/api/driver/rides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverToken}`,
      },
      body: JSON.stringify({
        fromAddress: '123 Main St',
        fromCity: 'San Francisco',
        fromState: 'CA',
        fromZipCode: '94102',
        fromLatitude: 37.7749,
        fromLongitude: -122.4194,
        toAddress: '456 Market St',
        toCity: 'San Francisco',
        toState: 'CA',
        toZipCode: '94105',
        toLatitude: 37.7849,
        toLongitude: -122.4094,
        departureDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        departureTime: '10:00',
        totalSeats: 4,
        pricePerSeat: 25.00,
      }),
    });

    const result = await response.json();
    if (result.success && result.data?.id) {
      return result.data.id;
    }
    return null;
  } catch (error) {
    console.error('Create ride error:', error);
    return null;
  }
}

async function createBookingWithPayment(
  riderToken: string,
  rideId: number,
  paymentMethodId: string
): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/api/rider/rides/${rideId}/book`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${riderToken}`,
      },
      body: JSON.stringify({
        pickupAddress: '789 Test St',
        pickupCity: 'San Francisco',
        pickupState: 'CA',
        pickupZipCode: '94103',
        pickupLatitude: 37.7849,
        pickupLongitude: -122.4094,
        numberOfSeats: 1,
        paymentMethodId,
      }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Create booking error:', error);
    return null;
  }
}

async function acceptBooking(driverToken: string, bookingId: number): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/api/driver/bookings/${bookingId}/accept`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${driverToken}`,
      },
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Accept booking error:', error);
    return null;
  }
}

async function cancelBooking(riderToken: string, bookingId: number): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/api/rider/bookings/${bookingId}/cancel?riderId=${riderToken}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Cancel booking error:', error);
    return null;
  }
}

async function getPaymentStatus(riderToken: string, bookingId: number): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/api/rider/payment/status/${bookingId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${riderToken}`,
      },
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Get payment status error:', error);
    return null;
  }
}

async function retryPayment(
  riderToken: string,
  bookingId: number,
  paymentMethodId: string
): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/api/rider/payment/retry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${riderToken}`,
      },
      body: JSON.stringify({
        bookingId,
        paymentMethodId,
      }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Retry payment error:', error);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting Payment Flow Tests\n');
  console.log(`API URL: ${API_URL}\n`);

  // Step 1: Login as rider and driver
  console.log('Step 1: Logging in...');
  const riderToken = await login(RIDER_EMAIL, RIDER_PASSWORD);
  const driverToken = await login(DRIVER_EMAIL, DRIVER_PASSWORD);

  if (!riderToken) {
    logResult('Rider Login', false, 'Failed to login as rider');
    return;
  }
  logResult('Rider Login', true, 'Logged in successfully');

  if (!driverToken) {
    logResult('Driver Login', false, 'Failed to login as driver');
    return;
  }
  logResult('Driver Login', true, 'Logged in successfully');

  // Step 2: Create a ride
  console.log('\nStep 2: Creating ride...');
  const rideId = await createRide(driverToken);
  if (!rideId) {
    logResult('Create Ride', false, 'Failed to create ride');
    return;
  }
  logResult('Create Ride', true, `Ride created with ID: ${rideId}`);

  // Step 3: Create booking with payment
  console.log('\nStep 3: Creating booking with payment...');
  // Note: In real testing, you would use a test payment method ID from Stripe
  // For this script, we'll use a placeholder
  const testPaymentMethodId = process.env.TEST_PAYMENT_METHOD_ID || 'pm_test_1234567890';
  
  const bookingResult = await createBookingWithPayment(riderToken, rideId, testPaymentMethodId);
  if (!bookingResult || !bookingResult.success) {
    logResult('Create Booking', false, bookingResult?.message || 'Failed to create booking');
    return;
  }
  
  const bookingId = bookingResult.data?.id;
  if (!bookingId) {
    logResult('Create Booking', false, 'Booking ID not returned');
    return;
  }
  logResult('Create Booking', true, `Booking created with ID: ${bookingId}`, {
    bookingId,
    paymentIntentId: bookingResult.data?.paymentIntentId,
    paymentStatus: bookingResult.data?.paymentStatus,
  });

  // Step 4: Check payment status (should be 'authorized')
  console.log('\nStep 4: Checking payment status...');
  const paymentStatus1 = await getPaymentStatus(riderToken, bookingId);
  if (paymentStatus1?.success) {
    logResult('Payment Status Check', true, 'Payment status retrieved', paymentStatus1.paymentStatus);
  } else {
    logResult('Payment Status Check', false, 'Failed to get payment status');
  }

  // Step 5: Accept booking (should capture payment)
  console.log('\nStep 5: Accepting booking (capturing payment)...');
  const acceptResult = await acceptBooking(driverToken, bookingId);
  if (!acceptResult || !acceptResult.success) {
    logResult('Accept Booking', false, acceptResult?.message || 'Failed to accept booking');
  } else {
    logResult('Accept Booking', true, 'Booking accepted, payment should be captured');
    
    // Check payment status again (should be 'captured')
    const paymentStatus2 = await getPaymentStatus(riderToken, bookingId);
    if (paymentStatus2?.success) {
      logResult('Payment Status After Capture', true, 'Payment status after capture', paymentStatus2.paymentStatus);
    }
  }

  // Step 6: Cancel booking (should refund)
  console.log('\nStep 6: Cancelling booking (refunding payment)...');
  const cancelResult = await cancelBooking(riderToken, bookingId);
  if (!cancelResult || !cancelResult.success) {
    logResult('Cancel Booking', false, cancelResult?.message || 'Failed to cancel booking');
  } else {
    logResult('Cancel Booking', true, 'Booking cancelled, refund should be processed');
    
    // Check payment status again (should be 'refunded')
    const paymentStatus3 = await getPaymentStatus(riderToken, bookingId);
    if (paymentStatus3?.success) {
      logResult('Payment Status After Refund', true, 'Payment status after refund', paymentStatus3.paymentStatus);
    }
  }

  // Step 7: Test payment retry (create new booking with failed payment, then retry)
  console.log('\nStep 7: Testing payment retry...');
  const rideId2 = await createRide(driverToken);
  if (rideId2) {
    // Create booking with invalid payment method to simulate failure
    const bookingResult2 = await createBookingWithPayment(riderToken, rideId2, 'pm_invalid_test');
    if (bookingResult2 && bookingResult2.data?.id) {
      const bookingId2 = bookingResult2.data.id;
      
      // Try to retry with valid payment method
      const retryResult = await retryPayment(riderToken, bookingId2, testPaymentMethodId);
      if (retryResult?.success) {
        logResult('Retry Payment', true, 'Payment retry successful', retryResult);
      } else {
        logResult('Retry Payment', false, retryResult?.message || 'Payment retry failed');
      }
    }
  }

  // Summary
  console.log('\n📊 Test Summary:');
  console.log('='.repeat(50));
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(50));

  if (failed > 0) {
    console.log('\nFailed Tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  ❌ ${r.step}: ${r.message}`);
    });
  }
}

// Run tests
main().catch(console.error);

