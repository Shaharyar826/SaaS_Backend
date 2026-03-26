const { Resend } = require('resend');

class EmailService {
  get client() {
    if (!this._client) {
      this._client = new Resend(process.env.RESEND_API_KEY);
    }
    return this._client;
  }

  get isConfigured() {
    return !!process.env.RESEND_API_KEY;
  }

  get fromEmail() {
    return process.env.FROM_EMAIL || 'onboarding@resend.dev';
  }

  async sendWelcomeEmail(email, data) {
    if (!this.isConfigured) {
      console.log('Email service not configured - RESEND_API_KEY missing');
      return { success: true, message: 'Email service not configured' };
    }

    const { name, schoolName, subdomain, loginUrl } = data;

    try {
      const result = await this.client.emails.send({
        from: `EduFlow <${this.fromEmail}>`,
        to: email,
        subject: `Welcome to ${schoolName} - Your School Management System`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3B82F6;">Welcome to ${schoolName}!</h2>
            <p>Hi ${name},</p>
            <p>Your school management system has been successfully set up.</p>
            <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>School:</strong> ${schoolName}</p>
              <p><strong>Your Role:</strong> Administrator</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Access Your Portal
              </a>
            </div>
            <p>Best regards,<br>The EduFlow Team</p>
          </div>
        `
      });
      return { success: true, messageId: result.id };
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendEmailVerification(email, data) {
    if (!this.isConfigured) {
      console.log('Email verification would be sent to:', email);
      return { success: true, message: 'Email service not configured' };
    }

    const { name, verificationUrl, schoolName } = data;

    try {
      const result = await this.client.emails.send({
        from: `${schoolName} <${this.fromEmail}>`,
        to: email,
        subject: 'Verify Your Email Address',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3B82F6;">Verify Your Email</h2>
            <p>Hi ${name},</p>
            <p>Please verify your email address to complete your registration.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create this account, please ignore this email.</p>
            <p>Best regards,<br>${schoolName}</p>
          </div>
        `
      });
      return { success: true, messageId: result.id };
    } catch (error) {
      console.error('Failed to send verification email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordReset(email, data) {
    if (!this.isConfigured) {
      console.log('Password reset would be sent to:', email);
      return { success: true, message: 'Email service not configured' };
    }

    const { name, resetUrl, schoolName } = data;

    try {
      const result = await this.client.emails.send({
        from: `${schoolName} <${this.fromEmail}>`,
        to: email,
        subject: 'Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3B82F6;">Password Reset</h2>
            <p>Hi ${name},</p>
            <p>You requested a password reset for your account.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p>This link will expire in 10 minutes.</p>
            <p>If you didn't request this reset, please ignore this email.</p>
            <p>Best regards,<br>${schoolName}</p>
          </div>
        `
      });
      return { success: true, messageId: result.id };
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendLoginAlert(email, data) {
    if (!this.isConfigured) return { success: true };
    const { name, loginTime, ipAddress, userAgent, schoolName } = data;
    try {
      await this.client.emails.send({
        from: `${schoolName} <${this.fromEmail}>`,
        to: email,
        subject: 'New Login to Your Account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3B82F6;">New Login Detected</h2>
            <p>Hi ${name},</p>
            <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Time:</strong> ${loginTime}</p>
              <p><strong>IP Address:</strong> ${ipAddress}</p>
              <p><strong>Device:</strong> ${userAgent}</p>
            </div>
            <p>If this wasn't you, contact your administrator immediately.</p>
            <p>Best regards,<br>${schoolName}</p>
          </div>
        `
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to send login alert:', error);
      return { success: false };
    }
  }
}

module.exports = new EmailService();
