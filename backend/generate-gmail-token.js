/**
 * Gmail OAuth2 Token Generator
 * 
 * This script helps you generate a refresh token for Gmail SMTP authentication.
 * 
 * Usage:
 *   1. Install googleapis: npm install googleapis
 *   2. Update CLIENT_ID and CLIENT_SECRET below with your values
 *   3. Run: node generate-gmail-token.js
 *   4. Follow the prompts
 * 
 * See NODEMAILER_SETUP_GUIDE.md for detailed instructions.
 */

const { google } = require("googleapis");
const readline = require("readline");

// ⚠️  REPLACE THESE WITH YOUR VALUES FROM GOOGLE CLOUD CONSOLE
// Get them from: https://console.cloud.google.com/apis/credentials
const CLIENT_ID = "YOUR_CLIENT_ID.apps.googleusercontent.com";
const CLIENT_SECRET = "GOCSPX-YOUR_CLIENT_SECRET";
const REDIRECT_URI = "http://localhost";
const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

// ⚠️  IMPORTANT: Before running this script, make sure you've added
//     "http://localhost" to your OAuth 2.0 Client ID's "Authorized redirect URIs"
//     in Google Cloud Console. Otherwise you'll get a redirect_uri_mismatch error.

// Validate that user has set their credentials
if (CLIENT_ID.includes("YOUR_CLIENT_ID") || CLIENT_SECRET.includes("YOUR_CLIENT_SECRET")) {
  console.error("\n❌ Error: Please update CLIENT_ID and CLIENT_SECRET in this file first!\n");
  console.log("📖 See NODEMAILER_SETUP_GUIDE.md for instructions on how to get these values.\n");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent", // Force consent screen to ensure we get a refresh token
});

console.log("\n" + "=".repeat(60));
console.log("🔐 Gmail OAuth2 Token Generator");
console.log("=".repeat(60) + "\n");
console.log("📝 Step 1: Visit this URL to authorize the application:\n");
console.log("   " + authUrl);
console.log("\n📝 Step 2: Sign in with the Gmail account you want to send emails FROM");
console.log("📝 Step 3: Click 'Allow' to grant permissions");
console.log("📝 Step 4: Copy the authorization code from the redirect page\n");
console.log("=".repeat(60) + "\n");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("✏️  Paste the authorization code here: ", (code) => {
  rl.close();

  console.log("\n⏳ Exchanging authorization code for tokens...\n");

  oauth2Client.getToken(code, (err, token) => {
    if (err) {
      console.error("❌ Error retrieving access token:", err.message);
      if (err.message.includes("invalid_grant")) {
        console.log("\n💡 Tip: Authorization codes expire quickly. Generate a new one and try again.");
      }
      process.exit(1);
    }

    if (!token.refresh_token) {
      console.error("\n❌ Error: No refresh token received!");
      console.log("\n💡 Tip: Make sure 'prompt: consent' is set in the auth URL.");
      console.log("   Try revoking access at https://myaccount.google.com/permissions and run again.\n");
      process.exit(1);
    }

    console.log("=".repeat(60));
    console.log("✅ Tokens generated successfully!");
    console.log("=".repeat(60) + "\n");
    console.log("📋 IMPORTANT: Copy these values to your .env file:\n");
    console.log("   GMAIL_CLIENT_ID=" + CLIENT_ID);
    console.log("   GMAIL_CLIENT_SECRET=" + CLIENT_SECRET);
    console.log("   GMAIL_REFRESH_TOKEN=" + token.refresh_token);
    console.log("   GMAIL_SENDER_EMAIL=your-email@gmail.com\n");
    console.log("=".repeat(60));
    console.log("\n⚠️  Security Notes:");
    console.log("   - Never commit these values to version control");
    console.log("   - Keep your refresh token secure");
    console.log("   - Regenerate if you suspect it's been compromised\n");
  });
});

