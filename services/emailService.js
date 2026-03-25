const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.isConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
    
    if (this.isConfigured) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      console.warn('Email service not configured - SMTP credentials missing');
    }
  }

  async sendWelcomeEmail(email, data) {
    if (!this.isConfigured) {
      console.log('Email would be sent to:', email, 'Data:', data);
      return { success: true, message: 'Email service not configured - logged instead' };
    }
    
    const { name, schoolName, subdomain, loginUrl } = data;
    
    try {
      const mailOptions = {
        from: `"EduFlow" <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: `Welcome to ${schoolName} - Your School Management System`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3B82F6;">Welcome to ${schoolName}!</h2>
            <p>Hi ${name},</p>
            <p>Congratulations! Your school management system has been successfully set up.</p>
            
            <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Your School Portal Details:</h3>
              <p><strong>School:</strong> ${schoolName}</p>
              <p><strong>Portal URL:</strong> <a href="${loginUrl}">${subdomain}.eduflow.com</a></p>
              <p><strong>Your Role:</strong> Administrator</p>
            </div>
            
            <p>Next steps:</p>
            <ol>
              <li>Complete your school setup</li>
              <li>Select the features you need</li>
              <li>Set up your billing preferences</li>
              <li>Start managing your school!</li>
            </ol>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Access Your Portal
              </a>
            </div>
            
            <p>If you have any questions, our support team is here to help.</p>
            <p>Best regards,<br>The EduFlow Team</p>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Welcome email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
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
      const mailOptions = {
        from: `"${schoolName}" <${process.env.FROM_EMAIL}>`,
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
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Verification email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Failed to send verification email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendLoginAlert(email, data) {
    if (!this.isConfigured) {
      console.log('Login alert would be sent to:', email);
      return { success: true, message: 'Email service not configured' };
    }
    
    const { name, loginTime, ipAddress, userAgent, schoolName } = data;
    
    try {
      const mailOptions = {
        from: `"${schoolName}" <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: 'New Login to Your Account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3B82F6;">New Login Detected</h2>
            <p>Hi ${name},</p>
            <p>We detected a new login to your account:</p>
            
            <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Time:</strong> ${loginTime}</p>
              <p><strong>IP Address:</strong> ${ipAddress}</p>
              <p><strong>Device:</strong> ${userAgent}</p>
            </div>
            
            <p>If this was you, no action is needed. If you don't recognize this login, please contact your administrator immediately.</p>
            
            <p>Best regards,<br>${schoolName}</p>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Login alert sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Failed to send login alert:', error);
      return { success: false, error: 'Failed to send login alert' };
    }
  }

  async sendPasswordReset(email, data) {
    if (!this.isConfigured) {
      console.log('Password reset would be sent to:', email);
      return { success: true, message: 'Email service not configured' };
    }
    
    const { name, resetUrl, schoolName } = data;
    
    try {
      const mailOptions = {
        from: `"${schoolName}" <${process.env.FROM_EMAIL}>`,
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
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Password reset email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();