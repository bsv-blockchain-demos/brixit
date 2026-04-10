/**
 * Email utility for sending OTP codes.
 *
 * TODO: wire up a real email provider (nodemailer, Resend, SendGrid, etc.)
 * when email OTP is needed in production.
 */

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  // Email sending not yet configured — log OTP to console for testing.
  console.log(`\n📧 OTP for ${to}: ${otp}  (expires in 10 minutes)\n`);
}
