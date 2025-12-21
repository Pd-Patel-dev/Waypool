import { google } from 'googleapis';

// Initialize Gmail OAuth2 client
const getGmailClient = () => {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  const senderEmail = process.env.GMAIL_SENDER_EMAIL;

  if (!clientId || !clientSecret || !refreshToken || !senderEmail) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'urn:ietf:wg:oauth:2.0:oob' // Redirect URI for installed apps
  );

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  return { gmail, senderEmail };
};

/**
 * Send email using Gmail API
 */
async function sendEmailViaGmail(to: string, subject: string, html: string, text: string): Promise<void> {
  const gmailClient = getGmailClient();
  
  if (!gmailClient) {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      throw new Error(
        'Gmail API not configured. Please set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and GMAIL_SENDER_EMAIL environment variables.'
      );
    }
    console.warn('⚠️  Gmail API credentials not configured. Email sending is disabled.');
    console.warn(`   Would send email to ${to} with subject: ${subject}`);
    return;
  }

  const { gmail, senderEmail } = gmailClient;

  // Create multipart MIME message with both HTML and plain text
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  const messageParts = [
    `From: ${senderEmail}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    html,
    '',
    `--${boundary}--`,
  ];

  const message = messageParts.join('\r\n');

  // Encode message in base64url format (RFC 4648 §5)
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log(`✅ Email sent successfully to ${to}`);
  } catch (error) {
    console.error('❌ Error sending email via Gmail API:', error);
    throw new Error('Failed to send email. Please try again.');
  }
}

interface SendOTPEmailParams {
  email: string;
  code: string;
  fullName?: string;
}

export async function sendOTPEmail({ email, code, fullName }: SendOTPEmailParams): Promise<void> {
  try {
    const subject = 'Verify your Waypool account';
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 40px 20px; text-align: center;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px 30px; text-align: center;">
                      <h1 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">Verify Your Email</h1>
                      <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                        ${fullName ? `Hi ${fullName},` : 'Hi,'}
                      </p>
                      <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                        Thank you for signing up for Waypool! Please use the following verification code to verify your email address:
                      </p>
                      <div style="background-color: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 8px; padding: 20px; margin: 30px 0;">
                        <p style="margin: 0; color: #1a1a1a; font-size: 32px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                          ${code}
                        </p>
                      </div>
                      <p style="margin: 30px 0 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
                        This code will expire in 10 minutes. If you didn't request this code, please ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
                <p style="margin: 20px 0 0 0; color: #999999; font-size: 12px; text-align: center;">
                  © ${new Date().getFullYear()} Waypool. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const text = `
Verify Your Email

${fullName ? `Hi ${fullName},` : 'Hi,'}

Thank you for signing up for Waypool! Please use the following verification code to verify your email address:

${code}

This code will expire in 10 minutes. If you didn't request this code, please ignore this email.

© ${new Date().getFullYear()} Waypool. All rights reserved.
    `.trim();

    await sendEmailViaGmail(email, subject, html, text);
    console.log(`✅ OTP email sent to ${email}`);
  } catch (error) {
    console.error('❌ Error sending OTP email:', error);
    throw new Error('Failed to send verification email. Please try again.');
  }
}

interface SendBookingRequestEmailParams {
  driverEmail: string;
  driverName: string;
  riderName: string;
  rideDetails: {
    fromAddress: string;
    toAddress: string;
    departureDate: string;
    departureTime: string;
    numberOfSeats: number;
    pricePerSeat: number;
    confirmationNumber: string;
  };
}

/**
 * Send email to driver when a passenger books a seat
 * Asks driver to confirm the booking request
 */
export async function sendBookingRequestEmail({
  driverEmail,
  driverName,
  riderName,
  rideDetails,
}: SendBookingRequestEmailParams): Promise<void> {
  try {
    const subject = `New Booking Request - ${rideDetails.confirmationNumber}`;
    
    const totalAmount = (rideDetails.numberOfSeats * rideDetails.pricePerSeat).toFixed(2);
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Booking Request</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 40px 20px; text-align: center;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h1 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">New Booking Request</h1>
                      <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                        Hi ${driverName},
                      </p>
                      <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                        <strong>${riderName}</strong> has requested to book ${rideDetails.numberOfSeats} seat${rideDetails.numberOfSeats !== 1 ? 's' : ''} on your ride. Please review and confirm the booking in your app.
                      </p>
                      
                      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0;">
                        <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 18px; font-weight: 600;">Booking Details</h2>
                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; width: 140px;">Confirmation #:</td>
                            <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">${rideDetails.confirmationNumber}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px;">Passenger:</td>
                            <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">${riderName}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px;">Seats:</td>
                            <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; font-weight: 600;">${rideDetails.numberOfSeats}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px;">From:</td>
                            <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px;">${rideDetails.fromAddress}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px;">To:</td>
                            <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px;">${rideDetails.toAddress}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px;">Date & Time:</td>
                            <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px;">${rideDetails.departureDate} at ${rideDetails.departureTime}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px;">Price per seat:</td>
                            <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px;">$${rideDetails.pricePerSeat.toFixed(2)}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px;">Total:</td>
                            <td style="padding: 8px 0; color: #1a1a1a; font-size: 16px; font-weight: 700;">$${totalAmount}</td>
                          </tr>
                        </table>
                      </div>

                      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 30px 0; border-radius: 4px;">
                        <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.5;">
                          <strong>Action Required:</strong> Please open your Waypool driver app to review and confirm this booking request.
                        </p>
                      </div>

                      <p style="margin: 30px 0 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
                        This is an automated notification. Please do not reply to this email.
                      </p>
                    </td>
                  </tr>
                </table>
                <p style="margin: 20px 0 0 0; color: #999999; font-size: 12px; text-align: center;">
                  © ${new Date().getFullYear()} Waypool. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const text = `
New Booking Request

Hi ${driverName},

${riderName} has requested to book ${rideDetails.numberOfSeats} seat${rideDetails.numberOfSeats !== 1 ? 's' : ''} on your ride. Please review and confirm the booking in your app.

Booking Details:
- Confirmation #: ${rideDetails.confirmationNumber}
- Passenger: ${riderName}
- Seats: ${rideDetails.numberOfSeats}
- From: ${rideDetails.fromAddress}
- To: ${rideDetails.toAddress}
- Date & Time: ${rideDetails.departureDate} at ${rideDetails.departureTime}
- Price per seat: $${rideDetails.pricePerSeat.toFixed(2)}
- Total: $${totalAmount}

ACTION REQUIRED: Please open your Waypool driver app to review and confirm this booking request.

This is an automated notification. Please do not reply to this email.

© ${new Date().getFullYear()} Waypool. All rights reserved.
    `.trim();

    await sendEmailViaGmail(driverEmail, subject, html, text);
    console.log(`✅ Booking request email sent to driver ${driverEmail}`);
  } catch (error) {
    console.error('❌ Error sending booking request email:', error);
    // Don't throw - email failures shouldn't break the booking flow
    console.warn('⚠️  Booking was created but email notification failed');
  }
}

interface SendBookingConfirmationEmailParams {
  riderEmail: string;
  riderName: string;
  driverName: string;
  pickupPIN: string;
  rideDetails: {
    fromAddress: string;
    toAddress: string;
    departureDate: string;
    departureTime: string;
    numberOfSeats: number;
    pricePerSeat: number;
    confirmationNumber: string;
  };
}

/**
 * Send confirmation email to rider when driver accepts their booking
 * Includes the pickup PIN for verification
 */
export async function sendBookingConfirmationEmail({
  riderEmail,
  riderName,
  driverName,
  pickupPIN,
  rideDetails,
}: SendBookingConfirmationEmailParams): Promise<void> {
  try {
    const subject = `Booking Confirmed - ${rideDetails.confirmationNumber}`;
    
    const totalAmount = (rideDetails.numberOfSeats * rideDetails.pricePerSeat).toFixed(2);
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Confirmed</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 40px 20px; text-align: center;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px 30px; text-align: center;">
                      <div style="background-color: #d4edda; border-radius: 50%; width: 64px; height: 64px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                        <span style="color: #155724; font-size: 32px; font-weight: bold;">✓</span>
                      </div>
                      <h1 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">Booking Confirmed!</h1>
                      <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                        Hi ${riderName},
                      </p>
                      <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.5;">
                        Great news! <strong>${driverName}</strong> has confirmed your booking request. Your ride is confirmed and you're all set!
                      </p>
                      
                      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0;">
                        <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 18px; font-weight: 600;">Ride Details</h2>
                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; width: 140px; text-align: left;">Confirmation #:</td>
                            <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: left;">${rideDetails.confirmationNumber}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; text-align: left;">Driver:</td>
                            <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: left;">${driverName}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; text-align: left;">Seats:</td>
                            <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; text-align: left;">${rideDetails.numberOfSeats}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; text-align: left;">From:</td>
                            <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; text-align: left;">${rideDetails.fromAddress}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; text-align: left;">To:</td>
                            <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; text-align: left;">${rideDetails.toAddress}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; text-align: left;">Date & Time:</td>
                            <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; text-align: left;">${rideDetails.departureDate} at ${rideDetails.departureTime}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; text-align: left;">Price per seat:</td>
                            <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; text-align: left;">$${rideDetails.pricePerSeat.toFixed(2)}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; text-align: left;">Total:</td>
                            <td style="padding: 8px 0; color: #1a1a1a; font-size: 16px; font-weight: 700; text-align: left;">$${totalAmount}</td>
                          </tr>
                        </table>
                      </div>

                      <div style="background-color: #e7f3ff; border: 2px solid #4285f4; border-radius: 8px; padding: 24px; margin: 30px 0;">
                        <h2 style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 18px; font-weight: 600;">Pickup Verification PIN</h2>
                        <p style="margin: 0 0 20px 0; color: #666666; font-size: 14px; line-height: 1.5;">
                          Please provide this PIN to your driver when they arrive for pickup:
                        </p>
                        <div style="background-color: #ffffff; border: 2px dashed #4285f4; border-radius: 8px; padding: 20px; margin: 20px 0;">
                          <p style="margin: 0; color: #1a1a1a; font-size: 36px; font-weight: 700; letter-spacing: 12px; font-family: 'Courier New', monospace;">
                            ${pickupPIN}
                          </p>
                        </div>
                        <p style="margin: 20px 0 0 0; color: #666666; font-size: 12px; line-height: 1.5;">
                          ⚠️ Keep this PIN secure. Your driver will verify it before allowing you to board.
                        </p>
                      </div>

                      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 30px 0; border-radius: 4px; text-align: left;">
                        <p style="margin: 0 0 8px 0; color: #856404; font-size: 14px; font-weight: 600;">Important Reminders:</p>
                        <ul style="margin: 0; padding-left: 20px; color: #856404; font-size: 14px; line-height: 1.8;">
                          <li>Arrive at the pickup location on time</li>
                          <li>Have your pickup PIN ready to share with the driver</li>
                          <li>Check your app for real-time updates on your driver's location</li>
                        </ul>
                      </div>

                      <p style="margin: 30px 0 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
                        We'll send you updates about your ride. See you soon!
                      </p>
                    </td>
                  </tr>
                </table>
                <p style="margin: 20px 0 0 0; color: #999999; font-size: 12px; text-align: center;">
                  © ${new Date().getFullYear()} Waypool. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const text = `
Booking Confirmed!

Hi ${riderName},

Great news! ${driverName} has confirmed your booking request. Your ride is confirmed and you're all set!

Ride Details:
- Confirmation #: ${rideDetails.confirmationNumber}
- Driver: ${driverName}
- Seats: ${rideDetails.numberOfSeats}
- From: ${rideDetails.fromAddress}
- To: ${rideDetails.toAddress}
- Date & Time: ${rideDetails.departureDate} at ${rideDetails.departureTime}
- Price per seat: $${rideDetails.pricePerSeat.toFixed(2)}
- Total: $${totalAmount}

PICKUP VERIFICATION PIN: ${pickupPIN}

⚠️ Keep this PIN secure. Your driver will verify it before allowing you to board.

Important Reminders:
- Arrive at the pickup location on time
- Have your pickup PIN ready to share with the driver
- Check your app for real-time updates on your driver's location

We'll send you updates about your ride. See you soon!

© ${new Date().getFullYear()} Waypool. All rights reserved.
    `.trim();

    await sendEmailViaGmail(riderEmail, subject, html, text);
    console.log(`✅ Booking confirmation email sent to rider ${riderEmail} with PIN ${pickupPIN}`);
  } catch (error) {
    console.error('❌ Error sending booking confirmation email:', error);
    // Don't throw - email failures shouldn't break the booking acceptance flow
    console.warn('⚠️  Booking was accepted but confirmation email failed');
  }
}
