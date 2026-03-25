const crypto = require('crypto');
const { SECURITY_CONFIG } = require('../config/security');
const emailService = require('./emailService');

class EmailVerificationService {
  // Generate verification token
  static generateVerificationToken() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  // Hash verification token for storage
  static hashVerificationToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
  
  // Generate verification URL
  static generateVerificationUrl(token, tenantSubdomain) {
    const baseUrl = process.env.FRONTEND_URL || 'https://app.eduflow.com';
    return `${baseUrl}/verify-email?token=${token}&tenant=${tenantSubdomain}`;
  }
  
  // Send verification email
  static async sendVerificationEmail(user, tenant) {
    try {
      const verificationToken = this.generateVerificationToken();
      const hashedToken = this.hashVerificationToken(verificationToken);
      const verificationUrl = this.generateVerificationUrl(verificationToken, tenant.subdomain);
      
      // Update user with verification token
      user.emailVerification = {
        isVerified: false,
        verificationToken: hashedToken,
        verificationExpires: new Date(Date.now() + SECURITY_CONFIG.emailVerification.tokenExpiry),
        verifiedAt: null,
        resendCount: (user.emailVerification?.resendCount || 0) + 1,
        lastResendAt: new Date()
      };
      
      await user.save();
      
      // Send email
      const emailResult = await emailService.sendEmailVerification(user.email, {
        name: user.name,
        verificationUrl,
        schoolName: tenant.schoolName,
        expiryHours: 24
      });
      
      if (!emailResult.success) {
        throw new Error('Failed to send verification email');
      }
      
      return {
        success: true,
        message: 'Verification email sent successfully',
        expiresAt: user.emailVerification.verificationExpires
      };
    } catch (error) {
      console.error('Email verification error:', error);
      throw new Error('Failed to send verification email');
    }
  }
  
  // Verify email token
  static async verifyEmailToken(token, TenantUser, tenantId) {
    try {
      const hashedToken = this.hashVerificationToken(token);
      
      const user = await TenantUser.findOne({
        tenant: tenantId,
        'emailVerification.verificationToken': hashedToken,
        'emailVerification.verificationExpires': { $gt: new Date() }
      });
      
      if (!user) {
        return {
          success: false,
          message: 'Invalid or expired verification token'
        };
      }
      
      if (user.emailVerification.isVerified) {
        return {
          success: false,
          message: 'Email is already verified'
        };
      }
      
      // Mark email as verified
      user.emailVerification.isVerified = true;
      user.emailVerification.verifiedAt = new Date();
      user.emailVerification.verificationToken = undefined;
      user.emailVerification.verificationExpires = undefined;
      
      // Activate account if it was pending email verification
      if (user.status === 'pending_verification') {
        user.status = 'active';
      }
      
      await user.save();
      
      return {
        success: true,
        message: 'Email verified successfully',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          isVerified: true
        }
      };
    } catch (error) {
      console.error('Email verification error:', error);
      return {
        success: false,
        message: 'Email verification failed'
      };
    }
  }
  
  // Resend verification email
  static async resendVerificationEmail(email, TenantUser, tenant) {
    try {
      const user = await TenantUser.findOne({
        email,
        tenant: tenant._id,
        'emailVerification.isVerified': false
      });
      
      if (!user) {
        return {
          success: false,
          message: 'User not found or email already verified'
        };
      }
      
      // Check resend limits
      const resendCount = user.emailVerification?.resendCount || 0;
      const lastResendAt = user.emailVerification?.lastResendAt;
      
      if (resendCount >= SECURITY_CONFIG.emailVerification.maxResendAttempts) {
        return {
          success: false,
          message: 'Maximum resend attempts exceeded'
        };
      }
      
      if (lastResendAt && (Date.now() - lastResendAt.getTime()) < SECURITY_CONFIG.emailVerification.resendCooldown) {
        const remainingTime = Math.ceil((SECURITY_CONFIG.emailVerification.resendCooldown - (Date.now() - lastResendAt.getTime())) / 1000 / 60);
        return {
          success: false,
          message: `Please wait ${remainingTime} minutes before requesting another verification email`
        };
      }
      
      return await this.sendVerificationEmail(user, tenant);
    } catch (error) {
      console.error('Resend verification error:', error);
      return {
        success: false,
        message: 'Failed to resend verification email'
      };
    }
  }
  
  // Check if email verification is required
  static isVerificationRequired(user) {
    if (!SECURITY_CONFIG.emailVerification.required) {
      return false;
    }
    
    return !user.emailVerification?.isVerified;
  }
  
  // Clean expired verification tokens
  static async cleanExpiredTokens(TenantUser) {
    try {
      const result = await TenantUser.updateMany(
        {
          'emailVerification.verificationExpires': { $lt: new Date() },
          'emailVerification.isVerified': false
        },
        {
          $unset: {
            'emailVerification.verificationToken': 1,
            'emailVerification.verificationExpires': 1
          }
        }
      );
      
      console.log(`Cleaned ${result.modifiedCount} expired verification tokens`);
      return result.modifiedCount;
    } catch (error) {
      console.error('Error cleaning expired tokens:', error);
      return 0;
    }
  }
}

module.exports = EmailVerificationService;