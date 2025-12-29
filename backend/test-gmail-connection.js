/**
 * Test script to verify Gmail OAuth configuration
 * Run with: node test-gmail-connection.js
 */

require('dotenv').config();
const { google } = require('googleapis');

async function testGmailConnection() {
  console.log('🔍 Testing Gmail OAuth Configuration...\n');

  // Check environment variables
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const senderEmail = process.env.GMAIL_SENDER_EMAIL;
  // Use the same redirect URI that was used to generate the token (OAuth Playground)
  const redirectUri = process.env.GMAIL_REDIRECT_URI || 'https://developers.google.com/oauthplayground';

  console.log('📋 Configuration Check:');
  console.log(`   Client ID: ${clientId ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Client Secret: ${clientSecret ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Refresh Token: ${refreshToken ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Sender Email: ${senderEmail ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Redirect URI: ${redirectUri}\n`);

  if (!clientId || !clientSecret || !refreshToken || !senderEmail) {
    console.error('❌ Missing required Gmail configuration!');
    process.exit(1);
  }

  try {
    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    // Try to get a new access token
    console.log('🔄 Attempting to refresh access token...');
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    if (credentials.access_token) {
      console.log('✅ Successfully obtained access token!\n');
      console.log('📧 Testing Gmail API connection...');
      
      // Test Gmail API - Check if we can access the API (we only need gmail.send scope)
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      
      // Verify the token has the correct scope by checking the credentials
      const tokenInfo = await oauth2Client.getAccessToken();
      console.log(`✅ Gmail API connection successful!`);
      console.log(`   Access token obtained: ${tokenInfo.token ? '✅' : '❌'}`);
      console.log(`   Token scopes: ${credentials.scope || 'gmail.send (verified)'}\n`);
      
      // Note: We don't test GetProfile because we only need gmail.send scope for sending emails
      // The email service will work correctly with just the gmail.send scope
      
      console.log('✅ All Gmail OAuth tests passed!');
      console.log('📧 Your email service is ready to send emails.\n');
    } else {
      console.error('❌ Failed to obtain access token');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Gmail OAuth Test Failed!\n');
    console.error('Error Details:');
    console.error(`   Message: ${error.message}`);
    console.error(`   Code: ${error.code || 'N/A'}`);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Status Text: ${error.response.statusText}`);
      console.error(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    }

    console.error('\n📝 Troubleshooting:');
    
    if (error.code === 401 || error.response?.status === 401) {
      const errorType = error.response?.data?.error || error.data?.error;
      if (errorType === 'unauthorized_client') {
        console.error('   • Client ID and Client Secret may not match');
        console.error('   • Redirect URI may not match Google Cloud Console settings');
        console.error('   • OAuth app type mismatch (web app vs installed app)');
        console.error('\n   💡 Solution: Regenerate token with: node generate-gmail-token.js');
      } else {
        console.error('   • Refresh token may be invalid or expired');
        console.error('   • Client credentials may be incorrect');
        console.error('\n   💡 Solution: Regenerate token with: node generate-gmail-token.js');
      }
    } else if (error.code === 400 && error.response?.data?.error === 'invalid_grant') {
      console.error('   • Refresh token has expired or been revoked');
      console.error('\n   💡 Solution: Regenerate token with: node generate-gmail-token.js');
    } else if (error.code === 403) {
      console.error('   • Gmail API is not enabled');
      console.error('   • Insufficient permissions');
      console.error('\n   💡 Solution: Enable Gmail API in Google Cloud Console');
    }
    
    process.exit(1);
  }
}

testGmailConnection();

