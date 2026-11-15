export interface SentEmailRecord {
  to: string;
  subject: string;
  text: string;
  html: string;
  actionUrl: string;
  sentAt: Date;
}

export class EmailService {
  private sentEmailsHistory: SentEmailRecord[] = [];
  private appUrl: string;
  private emailFrom: string;
  private provider: string;

  constructor() {
    this.appUrl = process.env.APP_URL || "http://localhost:3000";
    this.emailFrom = process.env.EMAIL_FROM || "noreply@analytics-saas.local";
    this.provider = process.env.EMAIL_PROVIDER || "mock";
  }

  /**
   * Dispatches an email verification link.
   */
  async sendVerificationEmail(email: string, rawToken: string): Promise<boolean> {
    const verificationUrl = `${this.appUrl}/verify-email?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;
    const subject = "Verify your Analytics Intelligence SaaS account";
    const text = `Hello,\n\nPlease verify your email by clicking the link below:\n${verificationUrl}\n\nThis link will expire in 24 hours.\nIf you did not request this account, please ignore this email.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Verify your email address</h2>
        <p>Thank you for signing up for Analytics Intelligence SaaS. Please verify your email by clicking below:</p>
        <p><a href="${verificationUrl}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a></p>
        <p>Or paste this link into your browser:</p>
        <p style="word-break: break-all; color: #6b7280;">${verificationUrl}</p>
        <p>This link expires in 24 hours.</p>
      </div>
    `;

    return this.deliverEmail({
      to: email,
      subject,
      text,
      html,
      actionUrl: verificationUrl,
      sentAt: new Date(),
    });
  }

  /**
   * Dispatches a password reset link.
   */
  async sendPasswordResetEmail(email: string, rawToken: string): Promise<boolean> {
    const resetUrl = `${this.appUrl}/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;
    const subject = "Reset your password - Analytics Intelligence SaaS";
    const text = `Hello,\n\nYou requested a password reset. Click the link below to set a new password:\n${resetUrl}\n\nThis link expires in 1 hour.\nIf you did not request this, please ignore this message.`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Click below to continue:</p>
        <p><a href="${resetUrl}" style="background-color: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
        <p>Or paste this link into your browser:</p>
        <p style="word-break: break-all; color: #6b7280;">${resetUrl}</p>
        <p>This link expires in 1 hour.</p>
      </div>
    `;

    return this.deliverEmail({
      to: email,
      subject,
      text,
      html,
      actionUrl: resetUrl,
      sentAt: new Date(),
    });
  }

  private async deliverEmail(record: SentEmailRecord): Promise<boolean> {
    this.sentEmailsHistory.push(record);

    if (this.provider === "mock") {
      // In development/test mode, log safe summary and preserve in memory
      console.log(`[EMAIL DISPATCH - MOCK] To: ${record.to} | Subject: "${record.subject}" | Link: ${record.actionUrl}`);
      return true;
    }

    // In production/smtp mode: real provider integration will be plugged here when authorized
    console.warn(`[EMAIL DISPATCH] Real email provider "${this.provider}" not yet configured.`);
    return false;
  }

  /**
   * For automated testing assertions.
   */
  getSentEmails(): SentEmailRecord[] {
    return [...this.sentEmailsHistory];
  }

  clearHistory(): void {
    this.sentEmailsHistory = [];
  }
}

export const emailService = new EmailService();
