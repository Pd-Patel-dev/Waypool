#!/usr/bin/env node

/**
 * Script to create a test rider account
 * Usage: node scripts/create-test-rider.js [options]
 * 
 * Options:
 *   --email <email>     Email for the test rider (default: test.rider@waypool.com)
 *   --password <pwd>    Password for the test rider (default: test123456)
 *   --firstName <name>  First name (default: Test)
 *   --lastName <name>   Last name (default: Rider)
 *   --phone <phone>     Phone number (default: 5551234567)
 *   --api-url <url>     API URL (default: http://localhost:3000)
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Determine API URL
let API_URL = 'http://localhost:3000';
if (process.env.API_URL) {
  API_URL = process.env.API_URL;
} else if (process.argv.includes('--api-url')) {
  const index = process.argv.indexOf('--api-url');
  if (process.argv[index + 1]) {
    API_URL = process.argv[index + 1];
  }
}

// Parse command line arguments
function getArg(name, defaultValue) {
  const index = process.argv.indexOf(`--${name}`);
  if (index !== -1 && process.argv[index + 1]) {
    return process.argv[index + 1];
  }
  return defaultValue;
}

const testRider = {
  email: getArg('email', 'test.rider@waypool.com'),
  password: getArg('password', 'test123456'),
  firstName: getArg('firstName', 'Test'),
  lastName: getArg('lastName', 'Rider'),
  phoneNumber: getArg('phone', '5551234567'),
};

function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = httpModule.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: async () => jsonData,
          });
        } catch (e) {
          resolve({
            ok: false,
            status: res.statusCode,
            json: async () => ({ message: data }),
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

async function createTestRider() {
  console.log('🚀 Creating test rider account...');
  console.log('📧 Email:', testRider.email);
  console.log('👤 Name:', `${testRider.firstName} ${testRider.lastName}`);
  console.log('📱 Phone:', testRider.phoneNumber);
  console.log('🔗 API URL:', API_URL);
  console.log('');

  try {
    const requestBody = JSON.stringify({
      email: testRider.email,
      password: testRider.password,
      firstName: testRider.firstName,
      lastName: testRider.lastName,
      phoneNumber: testRider.phoneNumber,
    });

    const response = await makeRequest(`${API_URL}/api/rider/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
      },
      body: requestBody,
    });

    const result = await response.json();

    if (!response.ok) {
      if (result.errors && Array.isArray(result.errors)) {
        console.error('❌ Validation errors:');
        result.errors.forEach(error => console.error('   -', error));
      } else {
        console.error('❌ Error:', result.message || 'Failed to create test rider');
      }
      process.exit(1);
    }

    if (result.success && result.user) {
      console.log('✅ Test rider created successfully!');
      console.log('');
      console.log('📋 Account Details:');
      console.log('   ID:', result.user.id);
      console.log('   Email:', result.user.email);
      console.log('   Name:', `${result.user.firstName} ${result.user.lastName}`);
      console.log('   Phone:', result.user.phoneNumber);
      console.log('   Role:', result.user.isRider ? 'Rider' : 'Driver');
      console.log('');
      console.log('🔑 Login Credentials:');
      console.log('   Email:', testRider.email);
      console.log('   Password:', testRider.password);
      console.log('');
      console.log('💡 You can now use these credentials to log in to the rider app.');
    } else {
      console.error('❌ Unexpected response format:', result);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error creating test rider:', error.message);
    console.error('');
    console.error('💡 Make sure:');
    console.error('   1. The backend server is running on', API_URL);
    console.error('   2. The API URL is correct');
    console.error('   3. You have network connectivity');
    process.exit(1);
  }
}

// Run the script
createTestRider();

