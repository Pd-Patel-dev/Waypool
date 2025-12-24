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
    
    // Calculate pricing breakdown
    const { calculateRiderTotal } = await import('../utils/earnings');
    const subtotal = rideDetails.numberOfSeats * rideDetails.pricePerSeat;
    const pricing = calculateRiderTotal(subtotal);
    
    const subtotalFormatted = pricing.subtotal.toFixed(2);
    const processingFeeFormatted = pricing.processingFee.toFixed(2);
    const commissionFormatted = pricing.commission.toFixed(2);
    const totalFeesFormatted = pricing.totalFees.toFixed(2);
    const totalAmountFormatted = pricing.total.toFixed(2);
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Confirmed</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 40px 20px; text-align: center;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 50px 30px 40px; text-align: center; background: linear-gradient(135deg, #4285F4 0%, #34C759 100%); border-radius: 12px 12px 0 0;">
                      <div style="background-color: rgba(255, 255, 255, 0.25); border-radius: 50%; width: 96px; height: 96px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="#ffffff" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </div>
                      <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Booking Confirmed</h1>
                      <p style="margin: 12px 0 0 0; color: rgba(255, 255, 255, 0.95); font-size: 16px; font-weight: 400;">Your ride is ready</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                        Hi ${riderName},
                      </p>
                      <p style="margin: 0 0 32px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                        Your booking has been confirmed by <strong>${driverName}</strong>. Your ride details are below.
                      </p>
                      
                      <!-- Ride Details Card -->
                      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin: 0 0 32px 0; border: 1px solid #e9ecef;">
                        <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#4285F4"/>
                          </svg>
                          <span>Ride Details</span>
                        </h2>
                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 10px 0; color: #666666; font-size: 14px; width: 140px; text-align: left; border-bottom: 1px solid #e9ecef;">Confirmation #</td>
                            <td style="padding: 10px 0; color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: left; border-bottom: 1px solid #e9ecef;">${rideDetails.confirmationNumber}</td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 0; color: #666666; font-size: 14px; text-align: left; border-bottom: 1px solid #e9ecef;">Driver</td>
                            <td style="padding: 10px 0; color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: left; border-bottom: 1px solid #e9ecef;">${driverName}</td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 0; color: #666666; font-size: 14px; text-align: left; border-bottom: 1px solid #e9ecef;">Seats</td>
                            <td style="padding: 10px 0; color: #1a1a1a; font-size: 14px; text-align: left; border-bottom: 1px solid #e9ecef;">${rideDetails.numberOfSeats}</td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 0; color: #666666; font-size: 14px; text-align: left; border-bottom: 1px solid #e9ecef;">From</td>
                            <td style="padding: 10px 0; color: #1a1a1a; font-size: 14px; text-align: left; border-bottom: 1px solid #e9ecef;">${rideDetails.fromAddress}</td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 0; color: #666666; font-size: 14px; text-align: left; border-bottom: 1px solid #e9ecef;">To</td>
                            <td style="padding: 10px 0; color: #1a1a1a; font-size: 14px; text-align: left; border-bottom: 1px solid #e9ecef;">${rideDetails.toAddress}</td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 0; color: #666666; font-size: 14px; text-align: left; border-bottom: 1px solid #e9ecef;">Date & Time</td>
                            <td style="padding: 10px 0; color: #1a1a1a; font-size: 14px; text-align: left; border-bottom: 1px solid #e9ecef;">${rideDetails.departureDate} at ${rideDetails.departureTime}</td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 0; color: #666666; font-size: 14px; text-align: left; border-bottom: 1px solid #e9ecef;">Price per seat</td>
                            <td style="padding: 10px 0; color: #1a1a1a; font-size: 14px; text-align: left; border-bottom: 1px solid #e9ecef;">$${rideDetails.pricePerSeat.toFixed(2)}</td>
                          </tr>
                        </table>
                      </div>

                      <!-- Pricing Breakdown Card -->
                      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 24px; margin: 0 0 32px 0; border: 1px solid #e9ecef;">
                        <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#4285F4"/>
                          </svg>
                          <span>Pricing Breakdown</span>
                        </h2>
                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 10px 0; color: #666666; font-size: 14px; text-align: left; border-bottom: 1px solid #e9ecef;">Subtotal (${rideDetails.numberOfSeats} seat${rideDetails.numberOfSeats !== 1 ? 's' : ''})</td>
                            <td style="padding: 10px 0; color: #1a1a1a; font-size: 14px; text-align: right; border-bottom: 1px solid #e9ecef;">$${subtotalFormatted}</td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 0; color: #666666; font-size: 14px; text-align: left; border-bottom: 1px solid #e9ecef;">Processing Fee</td>
                            <td style="padding: 10px 0; color: #1a1a1a; font-size: 14px; text-align: right; border-bottom: 1px solid #e9ecef;">$${processingFeeFormatted}</td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 0; color: #666666; font-size: 14px; text-align: left; border-bottom: 1px solid #e9ecef;">Platform Commission</td>
                            <td style="padding: 10px 0; color: #1a1a1a; font-size: 14px; text-align: right; border-bottom: 1px solid #e9ecef;">$${commissionFormatted}</td>
                          </tr>
                          <tr>
                            <td style="padding: 16px 0 10px 0; color: #1a1a1a; font-size: 16px; font-weight: 600; text-align: left; border-top: 2px solid #4285F4;">Total Amount</td>
                            <td style="padding: 16px 0 10px 0; color: #4285F4; font-size: 20px; font-weight: 700; text-align: right; border-top: 2px solid #4285F4;">$${totalAmountFormatted}</td>
                          </tr>
                        </table>
                      </div>

                      <!-- Pickup PIN Card -->
                      <div style="background-color: #e7f3ff; border: 1px solid #4285f4; border-radius: 8px; padding: 24px; margin: 0 0 32px 0;">
                        <h2 style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
                            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" fill="#4285F4"/>
                          </svg>
                          <span>Pickup Verification PIN</span>
                        </h2>
                        <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 14px; line-height: 1.6;">
                          Provide this PIN to your driver upon arrival:
                        </p>
                        <div style="background-color: #ffffff; border: 2px solid #4285f4; border-radius: 8px; padding: 24px; margin: 0 0 16px 0; text-align: center;">
                          <p style="margin: 0; color: #1a1a1a; font-size: 32px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                            ${pickupPIN}
                          </p>
                        </div>
                        <p style="margin: 0; color: #666666; font-size: 12px; line-height: 1.5; display: flex; align-items: center; gap: 6px;">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0;">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#666666"/>
                          </svg>
                          <span>Keep this PIN secure. Your driver will verify it before allowing you to board.</span>
                        </p>
                      </div>

                      <!-- Important Reminders -->
                      <div style="background-color: #fff9e6; border-left: 4px solid #f4b400; padding: 20px; margin: 0 0 32px 0; border-radius: 4px;">
                        <p style="margin: 0 0 12px 0; color: #856404; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink: 0;">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="#856404"/>
                          </svg>
                          <span>Important Reminders</span>
                        </p>
                        <ul style="margin: 0; padding-left: 24px; color: #856404; font-size: 14px; line-height: 1.8;">
                          <li>Arrive at the pickup location on time</li>
                          <li>Have your pickup PIN ready to share with the driver</li>
                          <li>Check your app for real-time updates on your driver's location</li>
                        </ul>
                      </div>

                      <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">
                        We'll send you updates about your ride. See you soon!
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
                      <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.5;">
                        © ${new Date().getFullYear()} Waypool. All rights reserved.
                      </p>
                    </td>
                  </tr>
                </table>
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

Pricing Breakdown:
- Subtotal (${rideDetails.numberOfSeats} seat${rideDetails.numberOfSeats !== 1 ? 's' : ''}): $${subtotalFormatted}
- Processing Fee: $${processingFeeFormatted}
- Platform Commission: $${commissionFormatted}
- Total Amount: $${totalAmountFormatted}

PICKUP VERIFICATION PIN: ${pickupPIN}

IMPORTANT: Keep this PIN secure. Your driver will verify it before allowing you to board.

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

interface SendRideNotificationEmailParams {
  riderEmail: string;
  riderName: string;
  driverName: string;
  rideDetails: {
    fromAddress: string;
    fromCity: string;
    fromState: string;
    toAddress: string;
    toCity: string;
    toState: string;
    departureDate: string;
    departureTime: string;
    availableSeats: number;
    pricePerSeat: number;
    distance?: number | null;
    carMake?: string | null;
    carModel?: string | null;
    carColor?: string | null;
  };
}

/**
 * Send email to riders when a new ride is created within their area
 * Encourages them to check the app for booking
 */
export async function sendRideNotificationEmail({
  riderEmail,
  riderName,
  driverName,
  rideDetails,
}: SendRideNotificationEmailParams): Promise<void> {
  try {
    const subject = `New Ride Available Near You - ${rideDetails.fromCity} to ${rideDetails.toCity}`;
    
    const carInfo = rideDetails.carMake && rideDetails.carModel
      ? `${rideDetails.carMake} ${rideDetails.carModel}${rideDetails.carColor ? ` (${rideDetails.carColor})` : ''}`
      : 'Vehicle details available in app';
    
    const distanceText = rideDetails.distance
      ? `${rideDetails.distance.toFixed(1)} miles`
      : 'Distance available in app';
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Ride Available</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 40px 20px; text-align: center;">
                <!-- Header with gradient -->
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #4285F4 0%, #34C759 100%); border-radius: 12px 12px 0 0; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 50px 30px 40px; text-align: center;">
                      <div style="background-color: rgba(255, 255, 255, 0.25); border-radius: 50%; width: 96px; height: 96px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        <!-- Professional Car Icon -->
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                          <path d="M5 17h14v2H5zm-2-4h18l-2-7H5zm2 0v-4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4"></path>
                          <circle cx="7" cy="17" r="2"></circle>
                          <circle cx="17" cy="17" r="2"></circle>
                        </svg>
                      </div>
                      <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">New Ride Available</h1>
                      <p style="margin: 12px 0 0 0; color: rgba(255, 255, 255, 0.95); font-size: 16px; font-weight: 400;">A driver near you just posted a ride</p>
                    </td>
                  </tr>
                </table>

                <!-- Main Content -->
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                        Hi ${riderName},
                      </p>
                      <p style="margin: 0 0 30px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                        Great news! <strong>${driverName}</strong> has posted a new ride that starts within 30 miles of your last dropoff location. This could be a perfect match for your travel plans!
                      </p>
                      
                      <!-- Ride Details Card -->
                      <div style="background-color: #f8f9fa; border-radius: 12px; padding: 24px; margin: 30px 0; border: 1px solid #e9ecef;">
                        <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                          <!-- Professional Location Icon -->
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                          </svg>
                          <span>Ride Details</span>
                        </h2>
                        
                        <!-- Route -->
                        <div style="margin-bottom: 24px;">
                          <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
                            <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #34C759; margin-top: 4px; flex-shrink: 0;"></div>
                            <div style="flex: 1;">
                              <p style="margin: 0 0 4px 0; color: #666666; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">From</p>
                              <p style="margin: 0; color: #1a1a1a; font-size: 16px; font-weight: 600; line-height: 1.4;">${rideDetails.fromAddress}</p>
                              <p style="margin: 4px 0 0 0; color: #666666; font-size: 14px;">${rideDetails.fromCity}, ${rideDetails.fromState}</p>
                            </div>
                          </div>
                          
                          <div style="width: 2px; height: 24px; background: linear-gradient(180deg, #34C759 0%, #FF3B30 100%); margin-left: 5px; margin-bottom: 16px;"></div>
                          
                          <div style="display: flex; align-items: flex-start; gap: 12px;">
                            <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #FF3B30; margin-top: 4px; flex-shrink: 0;"></div>
                            <div style="flex: 1;">
                              <p style="margin: 0 0 4px 0; color: #666666; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">To</p>
                              <p style="margin: 0; color: #1a1a1a; font-size: 16px; font-weight: 600; line-height: 1.4;">${rideDetails.toAddress}</p>
                              <p style="margin: 4px 0 0 0; color: #666666; font-size: 14px;">${rideDetails.toCity}, ${rideDetails.toState}</p>
                            </div>
                          </div>
                        </div>

                        <!-- Details Grid -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; padding-top: 24px; border-top: 1px solid #dee2e6;">
                          <div>
                            <p style="margin: 0 0 8px 0; color: #666666; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                              <!-- Calendar Icon -->
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                              </svg>
                              Date & Time
                            </p>
                            <p style="margin: 0; color: #1a1a1a; font-size: 15px; font-weight: 600;">${rideDetails.departureDate}</p>
                            <p style="margin: 2px 0 0 0; color: #4a4a4a; font-size: 14px;">${rideDetails.departureTime}</p>
                          </div>
                          
                          <div>
                            <p style="margin: 0 0 8px 0; color: #666666; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                              <!-- Dollar Icon -->
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                                <line x1="12" y1="1" x2="12" y2="23"></line>
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                              </svg>
                              Price
                            </p>
                            <p style="margin: 0; color: #1a1a1a; font-size: 15px; font-weight: 600;">$${rideDetails.pricePerSeat.toFixed(2)}</p>
                            <p style="margin: 2px 0 0 0; color: #4a4a4a; font-size: 14px;">per seat</p>
                          </div>
                          
                          <div>
                            <p style="margin: 0 0 8px 0; color: #666666; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                              <!-- Users Icon -->
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                              </svg>
                              Available Seats
                            </p>
                            <p style="margin: 0; color: #1a1a1a; font-size: 15px; font-weight: 600;">${rideDetails.availableSeats} seat${rideDetails.availableSeats !== 1 ? 's' : ''}</p>
                          </div>
                          
                          <div>
                            <p style="margin: 0 0 8px 0; color: #666666; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                              <!-- Car Icon -->
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                                <path d="M5 17h14v2H5zm-2-4h18l-2-7H5zm2 0v-4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4"></path>
                                <circle cx="7" cy="17" r="2"></circle>
                                <circle cx="17" cy="17" r="2"></circle>
                              </svg>
                              Vehicle
                            </p>
                            <p style="margin: 0; color: #1a1a1a; font-size: 15px; font-weight: 600; line-height: 1.3;">${carInfo}</p>
                          </div>
                        </div>
                      </div>

                      <!-- CTA Button -->
                      <div style="text-align: center; margin: 40px 0 30px 0;">
                        <a href="#" style="display: inline-block; background: linear-gradient(135deg, #4285F4 0%, #34C759 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);">
                          Open Waypool App to Book
                        </a>
                      </div>

                      <!-- Info Box -->
                      <div style="background-color: #e7f3ff; border-left: 4px solid #4285F4; padding: 16px; margin: 30px 0; border-radius: 4px;">
                        <p style="margin: 0; color: #1a4480; font-size: 14px; line-height: 1.6; display: flex; align-items: flex-start; gap: 8px;">
                          <!-- Info Icon -->
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; flex-shrink: 0; margin-top: 2px;">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                          </svg>
                          <span><strong>Quick Tip:</strong> Open your Waypool app to see the full route, driver details, and book your seat. Seats are limited and fill up fast!</span>
                        </p>
                      </div>

                      <p style="margin: 30px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                        This ride starts within 30 miles of your last dropoff location. Don't miss out on this opportunity to save on your travel!
                      </p>
                      
                      <p style="margin: 20px 0 0 0; color: #999999; font-size: 12px; line-height: 1.5;">
                        You're receiving this email because you're a Waypool rider and this ride is near your location. 
                        <a href="#" style="color: #4285F4; text-decoration: none;">Manage your email preferences</a> in the app.
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Footer -->
                <table role="presentation" style="max-width: 600px; margin: 20px auto 0; text-align: center;">
                  <tr>
                    <td>
                      <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.5;">
                        © ${new Date().getFullYear()} Waypool. All rights reserved.
                      </p>
                      <p style="margin: 8px 0 0 0; color: #999999; font-size: 11px;">
                        Safe rides, better connections.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const text = `
New Ride Available Near You!

Hi ${riderName},

Great news! ${driverName} has posted a new ride that starts within 30 miles of your last dropoff location. This could be a perfect match for your travel plans!

RIDE DETAILS

From:
${rideDetails.fromAddress}
${rideDetails.fromCity}, ${rideDetails.fromState}

To:
${rideDetails.toAddress}
${rideDetails.toCity}, ${rideDetails.toState}

Date & Time: ${rideDetails.departureDate} at ${rideDetails.departureTime}
Price: $${rideDetails.pricePerSeat.toFixed(2)} per seat
Available Seats: ${rideDetails.availableSeats} seat${rideDetails.availableSeats !== 1 ? 's' : ''}
Vehicle: ${carInfo}
${rideDetails.distance ? `Distance: ${distanceText}` : ''}

ACTION REQUIRED: Open your Waypool app to see the full route, driver details, and book your seat. Seats are limited and fill up fast!

This ride starts within 30 miles of your last dropoff location. Don't miss out on this opportunity to save on your travel!

You're receiving this email because you're a Waypool rider and this ride is near your location. Manage your email preferences in the app.

© ${new Date().getFullYear()} Waypool. All rights reserved.
Safe rides, better connections.
    `.trim();

    await sendEmailViaGmail(riderEmail, subject, html, text);
    console.log(`✅ Ride notification email sent to rider ${riderEmail}`);
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack || 'No stack trace';
    console.error(`❌ Error sending ride notification email to ${riderEmail}:`, errorMessage);
    console.error(`❌ Error stack:`, errorStack);
    // Don't throw - email failures shouldn't break the ride creation flow
  }
}

interface SendRideModificationEmailParams {
  riderEmail: string;
  riderName: string;
  driverName: string;
  rideDetails: {
    fromAddress: string;
    toAddress: string;
    departureDate: string;
    departureTime: string;
    changes: string[];
  };
}

/**
 * Send email to rider when a ride they booked is modified
 */
export async function sendRideModificationEmail({
  riderEmail,
  riderName,
  driverName,
  rideDetails,
}: SendRideModificationEmailParams): Promise<void> {
  try {
    const subject = `Ride Details Updated - ${rideDetails.fromAddress} to ${rideDetails.toAddress}`;
    
    const changesList = rideDetails.changes.map(change => `• ${change.charAt(0).toUpperCase() + change.slice(1)}`).join('\n');
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Ride Details Updated</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 40px 20px; text-align: center;">
                <!-- Header -->
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                  <tr>
                    <td style="padding: 50px 30px 40px; text-align: center; background: linear-gradient(135deg, #FF9500 0%, #FF6B00 100%); border-radius: 12px 12px 0 0;">
                      <div style="background-color: rgba(255, 255, 255, 0.25); border-radius: 50%; width: 96px; height: 96px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        <!-- Edit Icon -->
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </div>
                      <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Ride Details Updated</h1>
                      <p style="margin: 12px 0 0 0; color: rgba(255, 255, 255, 0.95); font-size: 16px; font-weight: 400;">Please review the changes</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                        Hi ${riderName},
                      </p>
                      <p style="margin: 0 0 30px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                        <strong>${driverName}</strong> has updated the following details for your ride:
                      </p>
                      
                      <!-- Changes Card -->
                      <div style="background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 12px; padding: 24px; margin: 30px 0;">
                        <h2 style="margin: 0 0 16px 0; color: #1a1a1a; font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                          <!-- Alert Icon -->
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffc107" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                          </svg>
                          <span>Updated Information</span>
                        </h2>
                        <div style="color: #856404; font-size: 16px; line-height: 1.8;">
                          ${rideDetails.changes.map(change => `<p style="margin: 8px 0; display: flex; align-items: center; gap: 8px;"><span style="color: #ffc107; font-weight: 600;">•</span> ${change.charAt(0).toUpperCase() + change.slice(1)}</p>`).join('')}
                        </div>
                      </div>

                      <!-- Ride Details Card -->
                      <div style="background-color: #f8f9fa; border-radius: 12px; padding: 24px; margin: 30px 0; border: 1px solid #e9ecef;">
                        <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                          <!-- Location Icon -->
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                          </svg>
                          <span>Ride Details</span>
                        </h2>
                        
                        <div style="margin-bottom: 20px;">
                          <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
                            <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #34C759; margin-top: 4px; flex-shrink: 0;"></div>
                            <div style="flex: 1;">
                              <p style="margin: 0 0 4px 0; color: #666666; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">From</p>
                              <p style="margin: 0; color: #1a1a1a; font-size: 16px; font-weight: 600; line-height: 1.4;">${rideDetails.fromAddress}</p>
                            </div>
                          </div>
                          
                          <div style="width: 2px; height: 24px; background: linear-gradient(180deg, #34C759 0%, #FF3B30 100%); margin-left: 5px; margin-bottom: 16px;"></div>
                          
                          <div style="display: flex; align-items: flex-start; gap: 12px;">
                            <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #FF3B30; margin-top: 4px; flex-shrink: 0;"></div>
                            <div style="flex: 1;">
                              <p style="margin: 0 0 4px 0; color: #666666; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">To</p>
                              <p style="margin: 0; color: #1a1a1a; font-size: 16px; font-weight: 600; line-height: 1.4;">${rideDetails.toAddress}</p>
                            </div>
                          </div>
                        </div>

                        <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; width: 140px; text-align: left;">Date & Time:</td>
                            <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: left;">${rideDetails.departureDate} at ${rideDetails.departureTime}</td>
                          </tr>
                        </table>
                      </div>

                      <!-- CTA -->
                      <div style="text-align: center; margin: 40px 0 30px 0;">
                        <a href="#" style="display: inline-block; background: linear-gradient(135deg, #4285F4 0%, #34C759 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);">
                          View Updated Details in App
                        </a>
                      </div>

                      <p style="margin: 30px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                        Please check your Waypool app for the complete updated ride information.
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Footer -->
                <table role="presentation" style="max-width: 600px; margin: 20px auto 0; text-align: center;">
                  <tr>
                    <td>
                      <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.5;">
                        © ${new Date().getFullYear()} Waypool. All rights reserved.
                      </p>
                      <p style="margin: 8px 0 0 0; color: #999999; font-size: 11px;">
                        Safe rides, better connections.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const text = `
Ride Details Updated

Hi ${riderName},

${driverName} has updated the following details for your ride:

Updated Information:
${changesList}

Ride Details:
From: ${rideDetails.fromAddress}
To: ${rideDetails.toAddress}
Date & Time: ${rideDetails.departureDate} at ${rideDetails.departureTime}

Please check your Waypool app for the complete updated ride information.

© ${new Date().getFullYear()} Waypool. All rights reserved.
Safe rides, better connections.
    `.trim();

    await sendEmailViaGmail(riderEmail, subject, html, text);
    console.log(`✅ Ride modification email sent to rider ${riderEmail}`);
  } catch (error: any) {
    console.error(`❌ Error sending ride modification email to ${riderEmail}:`, error);
    // Don't throw - email failures shouldn't break the ride update flow
  }
}

interface SendRideCancellationEmailParams {
  riderEmail: string;
  riderName: string;
  driverName: string;
  rideDetails: {
    fromAddress: string;
    toAddress: string;
    departureDate: string;
    departureTime: string;
  };
}

/**
 * Send email to rider when a ride they booked is cancelled
 */
export async function sendRideCancellationEmail({
  riderEmail,
  riderName,
  driverName,
  rideDetails,
}: SendRideCancellationEmailParams): Promise<void> {
  try {
    const subject = `Ride Cancelled - ${rideDetails.fromAddress} to ${rideDetails.toAddress}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Ride Cancelled</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 40px 20px; text-align: center;">
                <!-- Header -->
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                  <tr>
                    <td style="padding: 50px 30px 40px; text-align: center; background: linear-gradient(135deg, #FF3B30 0%, #DC2626 100%); border-radius: 12px 12px 0 0;">
                      <div style="background-color: rgba(255, 255, 255, 0.25); border-radius: 50%; width: 96px; height: 96px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        <!-- X Icon -->
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="15" y1="9" x2="9" y2="15"></line>
                          <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                      </div>
                      <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Ride Cancelled</h1>
                      <p style="margin: 12px 0 0 0; color: rgba(255, 255, 255, 0.95); font-size: 16px; font-weight: 400;">We're sorry for the inconvenience</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                        Hi ${riderName},
                      </p>
                      <p style="margin: 0 0 30px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                        We're sorry to inform you that <strong>${driverName}</strong> has cancelled the following ride:
                      </p>
                      
                      <!-- Ride Details Card -->
                      <div style="background-color: #f8f9fa; border-radius: 12px; padding: 24px; margin: 30px 0; border: 1px solid #e9ecef;">
                        <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                          <!-- Location Icon -->
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                          </svg>
                          <span>Cancelled Ride</span>
                        </h2>
                        
                        <div style="margin-bottom: 20px;">
                          <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
                            <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #34C759; margin-top: 4px; flex-shrink: 0;"></div>
                            <div style="flex: 1;">
                              <p style="margin: 0 0 4px 0; color: #666666; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">From</p>
                              <p style="margin: 0; color: #1a1a1a; font-size: 16px; font-weight: 600; line-height: 1.4;">${rideDetails.fromAddress}</p>
                            </div>
                          </div>
                          
                          <div style="width: 2px; height: 24px; background: linear-gradient(180deg, #34C759 0%, #FF3B30 100%); margin-left: 5px; margin-bottom: 16px;"></div>
                          
                          <div style="display: flex; align-items: flex-start; gap: 12px;">
                            <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #FF3B30; margin-top: 4px; flex-shrink: 0;"></div>
                            <div style="flex: 1;">
                              <p style="margin: 0 0 4px 0; color: #666666; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">To</p>
                              <p style="margin: 0; color: #1a1a1a; font-size: 16px; font-weight: 600; line-height: 1.4;">${rideDetails.toAddress}</p>
                            </div>
                          </div>
                        </div>

                        <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; width: 140px; text-align: left;">Date & Time:</td>
                            <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: left;">${rideDetails.departureDate} at ${rideDetails.departureTime}</td>
                          </tr>
                        </table>
                      </div>

                      <!-- Refund Info -->
                      <div style="background-color: #e7f3ff; border-left: 4px solid #4285F4; padding: 16px; margin: 30px 0; border-radius: 4px;">
                        <p style="margin: 0; color: #1a4480; font-size: 14px; line-height: 1.6; display: flex; align-items: flex-start; gap: 8px;">
                          <!-- Info Icon -->
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; flex-shrink: 0; margin-top: 2px;">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                          </svg>
                          <span><strong>Refund Information:</strong> If you were charged for this ride, you will receive a full refund. The refund will be processed automatically and should appear in your account within 5-7 business days.</span>
                        </p>
                      </div>

                      <!-- CTA -->
                      <div style="text-align: center; margin: 40px 0 30px 0;">
                        <a href="#" style="display: inline-block; background: linear-gradient(135deg, #4285F4 0%, #34C759 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);">
                          Find Another Ride
                        </a>
                      </div>

                      <p style="margin: 30px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                        We apologize for any inconvenience. Please check the Waypool app to find alternative rides for your journey.
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Footer -->
                <table role="presentation" style="max-width: 600px; margin: 20px auto 0; text-align: center;">
                  <tr>
                    <td>
                      <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.5;">
                        © ${new Date().getFullYear()} Waypool. All rights reserved.
                      </p>
                      <p style="margin: 8px 0 0 0; color: #999999; font-size: 11px;">
                        Safe rides, better connections.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const text = `
Ride Cancelled

Hi ${riderName},

We're sorry to inform you that ${driverName} has cancelled the following ride:

Cancelled Ride:
From: ${rideDetails.fromAddress}
To: ${rideDetails.toAddress}
Date & Time: ${rideDetails.departureDate} at ${rideDetails.departureTime}

Refund Information: If you were charged for this ride, you will receive a full refund. The refund will be processed automatically and should appear in your account within 5-7 business days.

We apologize for any inconvenience. Please check the Waypool app to find alternative rides for your journey.

© ${new Date().getFullYear()} Waypool. All rights reserved.
Safe rides, better connections.
    `.trim();

    await sendEmailViaGmail(riderEmail, subject, html, text);
    console.log(`✅ Ride cancellation email sent to rider ${riderEmail}`);
  } catch (error: any) {
    console.error(`❌ Error sending ride cancellation email to ${riderEmail}:`, error);
    // Don't throw - email failures shouldn't break the ride cancellation flow
  }
}

interface SendBookingRejectionEmailParams {
  riderEmail: string;
  riderName: string;
  driverName: string;
  rideDetails: {
    fromAddress: string;
    toAddress: string;
    departureDate: string;
    departureTime: string;
  };
  rejectionReason?: string | null;
}

/**
 * Send email to rider when their booking request is rejected
 */
export async function sendBookingRejectionEmail({
  riderEmail,
  riderName,
  driverName,
  rideDetails,
  rejectionReason,
}: SendBookingRejectionEmailParams): Promise<void> {
  try {
    const subject = `Booking Request Not Accepted - ${rideDetails.fromAddress} to ${rideDetails.toAddress}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Request Not Accepted</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 40px 20px; text-align: center;">
                <!-- Header -->
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                  <tr>
                    <td style="padding: 50px 30px 40px; text-align: center; background: linear-gradient(135deg, #6B7280 0%, #4B5563 100%); border-radius: 12px 12px 0 0;">
                      <div style="background-color: rgba(255, 255, 255, 0.25); border-radius: 50%; width: 96px; height: 96px; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                        <!-- X Circle Icon -->
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="15" y1="9" x2="9" y2="15"></line>
                          <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                      </div>
                      <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Request Not Accepted</h1>
                      <p style="margin: 12px 0 0 0; color: rgba(255, 255, 255, 0.95); font-size: 16px; font-weight: 400;">Your booking request was declined</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 16px; line-height: 1.6;">
                        Hi ${riderName},
                      </p>
                      <p style="margin: 0 0 30px 0; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                        We're sorry to inform you that <strong>${driverName}</strong> was unable to accept your booking request for the following ride:
                      </p>
                      
                      <!-- Ride Details Card -->
                      <div style="background-color: #f8f9fa; border-radius: 12px; padding: 24px; margin: 30px 0; border: 1px solid #e9ecef;">
                        <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                          <!-- Location Icon -->
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4285F4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block;">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                          </svg>
                          <span>Ride Details</span>
                        </h2>
                        
                        <div style="margin-bottom: 20px;">
                          <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
                            <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #34C759; margin-top: 4px; flex-shrink: 0;"></div>
                            <div style="flex: 1;">
                              <p style="margin: 0 0 4px 0; color: #666666; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">From</p>
                              <p style="margin: 0; color: #1a1a1a; font-size: 16px; font-weight: 600; line-height: 1.4;">${rideDetails.fromAddress}</p>
                            </div>
                          </div>
                          
                          <div style="width: 2px; height: 24px; background: linear-gradient(180deg, #34C759 0%, #FF3B30 100%); margin-left: 5px; margin-bottom: 16px;"></div>
                          
                          <div style="display: flex; align-items: flex-start; gap: 12px;">
                            <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #FF3B30; margin-top: 4px; flex-shrink: 0;"></div>
                            <div style="flex: 1;">
                              <p style="margin: 0 0 4px 0; color: #666666; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">To</p>
                              <p style="margin: 0; color: #1a1a1a; font-size: 16px; font-weight: 600; line-height: 1.4;">${rideDetails.toAddress}</p>
                            </div>
                          </div>
                        </div>

                        <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6;">
                          <tr>
                            <td style="padding: 8px 0; color: #666666; font-size: 14px; width: 140px; text-align: left;">Date & Time:</td>
                            <td style="padding: 8px 0; color: #1a1a1a; font-size: 14px; font-weight: 600; text-align: left;">${rideDetails.departureDate} at ${rideDetails.departureTime}</td>
                          </tr>
                        </table>
                      </div>

                      ${rejectionReason ? `
                      <!-- Rejection Reason Card -->
                      <div style="background-color: #fee2e2; border-left: 4px solid #EF4444; padding: 16px; margin: 30px 0; border-radius: 4px;">
                        <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.6; display: flex; align-items: flex-start; gap: 8px;">
                          <!-- Alert Icon -->
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; flex-shrink: 0; margin-top: 2px;">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                          </svg>
                          <span><strong>Reason:</strong> ${rejectionReason}</span>
                        </p>
                      </div>
                      ` : ''}

                      <!-- CTA -->
                      <div style="text-align: center; margin: 40px 0 30px 0;">
                        <a href="#" style="display: inline-block; background: linear-gradient(135deg, #4285F4 0%, #34C759 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);">
                          Find Another Ride
                        </a>
                      </div>

                      <p style="margin: 30px 0 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                        Don't worry! There are many other rides available. Check the Waypool app to find alternative options for your journey.
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Footer -->
                <table role="presentation" style="max-width: 600px; margin: 20px auto 0; text-align: center;">
                  <tr>
                    <td>
                      <p style="margin: 0; color: #999999; font-size: 12px; line-height: 1.5;">
                        © ${new Date().getFullYear()} Waypool. All rights reserved.
                      </p>
                      <p style="margin: 8px 0 0 0; color: #999999; font-size: 11px;">
                        Safe rides, better connections.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const text = `
Booking Request Not Accepted

Hi ${riderName},

We're sorry to inform you that ${driverName} was unable to accept your booking request for the following ride:

Ride Details:
From: ${rideDetails.fromAddress}
To: ${rideDetails.toAddress}
Date & Time: ${rideDetails.departureDate} at ${rideDetails.departureTime}

${rejectionReason ? `Reason: ${rejectionReason}\n\n` : ''}
Don't worry! There are many other rides available. Check the Waypool app to find alternative options for your journey.

© ${new Date().getFullYear()} Waypool. All rights reserved.
Safe rides, better connections.
    `.trim();

    await sendEmailViaGmail(riderEmail, subject, html, text);
    console.log(`✅ Booking rejection email sent to rider ${riderEmail}`);
  } catch (error: any) {
    console.error(`❌ Error sending booking rejection email to ${riderEmail}:`, error);
    // Don't throw - email failures shouldn't break the booking rejection flow
  }
}
