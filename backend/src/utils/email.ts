/**
 * Email utility for sending OTP codes.
 *
 * Development: logs OTP to console (no SMTP config needed).
 * Production: plug in your email provider here (nodemailer, Resend, SendGrid, etc.)
 */

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;

  if (smtpHost) {
    // Production: use nodemailer — install it with `npm install nodemailer @types/nodemailer`
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || `noreply@brixit.app`,
        to,
        subject: 'Your BRIX verification code',
        text: `Your BRIX verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
        html: `
          <p>Your BRIX verification code is:</p>
          <h2 style="letter-spacing:0.2em">${otp}</h2>
          <p>This code expires in 10 minutes.</p>
        `,
      });
    } catch (err) {
      console.error('[email] Failed to send via SMTP:', err);
      throw new Error('Failed to send verification email');
    }
  } else {
    // Development: log to console
    console.log(`\n📧 OTP for ${to}: ${otp}  (expires in 10 minutes)\n`);
  }
}
