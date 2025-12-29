/**
 * Verify Gmail OAuth Configuration
 * Checks if the refresh token matches the client credentials
 */

require('dotenv').config();
const { google } = require('googleapis');

async function verifyConfig() {
  console.log('🔍 Verifying Gmail OAuth Configuration...\n');

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const redirectUri = process.env.GMAIL_REDIRECT_URI || 'https://developers.google.com/oauthplayground';

  console.log('📋 Current Configuration:');
  console.log(`   Client ID: ${clientId}`);
  console.log(`   Client Secret: ${clientSecret ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Refresh Token: ${refreshToken ? '✅ Set (starts with: ' + refreshToken.substring(0, 10) + '...)' : '❌ Missing'}`);
  console.log(`   Redirect URI: ${redirectUri}\n`);

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('❌ Missing required configuration!');
    process.exit(1);
  }

  // Check if token was generated with Playground's default client
  const playgroundClientId = '407408718192.apps.googleusercontent.com';
  const isPlaygroundClient = clientId.includes('407408718192');
  
  console.log('🔍 Analysis:');
  if (isPlaygroundClient) {
    console.log('   ⚠️  Your Client ID appears to be the OAuth Playground default');
    console.log('   ⚠️  This means your refresh token was generated with Playground\'s client');
    console.log('   ⚠️  You need to use YOUR OWN client credentials in the Playground\n');
  } else {
    console.log('   ✅ Your Client ID is your own (not Playground default)');
    console.log('   ✅ Make sure you used THIS client ID in OAuth Playground settings\n');
  }

  console.log('📝 Verification Steps:');
  console.log('   1. Go to: https://developers.google.com/oauthplayground/');
  console.log('   2. Click the ⚙️ gear icon (top right)');
  console.log('   3. Check "Use your own OAuth credentials"');
  console.log(`   4. Verify Client ID matches: ${clientId}`);
  console.log(`   5. Verify Client Secret matches: ${clientSecret ? '✅ Set' : '❌ Missing'}`);
  console.log('   6. If they don\'t match, update them and regenerate the token\n');

  // Try to use the token
  console.log('🔄 Testing token with current credentials...\n');
  
  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    if (credentials.access_token) {
      console.log('✅ SUCCESS! Token works with your current credentials!\n');
      console.log('✅ Your configuration is correct!');
      return;
    }
  } catch (error) {
    console.log('❌ Token test failed!\n');
    console.log('Error:', error.message);
    
    if (error.message === 'unauthorized_client') {
      console.log('\n📝 This means:');
      console.log('   • The refresh token was generated with DIFFERENT client credentials');
      console.log('   • You need to regenerate the token using YOUR client ID/Secret\n');
      console.log('🔧 Solution:');
      console.log('   1. Open OAuth Playground: https://developers.google.com/oauthplayground/');
      console.log('   2. Click ⚙️ gear icon → Check "Use your own OAuth credentials"');
      console.log(`   3. Enter Client ID: ${clientId}`);
      console.log(`   4. Enter Client Secret: ${clientSecret}`);
      console.log('   5. Generate a new refresh token');
      console.log('   6. Update GMAIL_REFRESH_TOKEN in .env\n');
    }
  }
}

verifyConfig();

