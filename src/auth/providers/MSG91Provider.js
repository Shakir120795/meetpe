/**
 * MSG91Provider — Real OTP implementation using MSG91 API
 * 
 * Features:
 * - Send OTP via SMS or WhatsApp
 * - Verify OTP with retry limits
 * - Automatic expiry (10 minutes)
 * - Rate limiting (max 3 OTPs per 15 minutes per phone)
 * - Retry tracking (max 5 attempts per OTP)
 * 
 * Environment Variables Required:
 * - MSG91_AUTH_KEY: Your MSG91 authentication key
 * - MSG91_TEMPLATE_ID: SMS template ID (optional)
 * - MSG91_SENDER_ID: Sender ID for SMS (optional, default: MSGIND)
 */

const IAuthProvider = require('../auth.interface');
const axios = require('axios');

class MSG91Provider extends IAuthProvider {
  constructor() {
    super();
    this.authKey = process.env.MSG91_AUTH_KEY;
    this.templateId = process.env.MSG91_TEMPLATE_ID;
    this.senderId = process.env.MSG91_SENDER_ID || 'MSGIND';
    
    // In-memory session store (use Redis in production)
    this.sessions = new Map(); // { phone: { otp, expiry, attempts, sessionId } }
    this.rateLimits = new Map(); // { phone: { count, resetAt } }
    
    if (!this.authKey) {
      console.warn('⚠️ MSG91_AUTH_KEY not found in environment. Provider will use demo mode.');
    }
  }

  /**
   * Check rate limit for phone number
   * Max 3 OTP requests per 15 minutes
   */
  _checkRateLimit(phone) {
    const limit = this.rateLimits.get(phone);
    const now = Date.now();
    
    if (!limit) {
      this.rateLimits.set(phone, { count: 1, resetAt: now + 15 * 60 * 1000 });
      return { ok: true };
    }
    
    if (now > limit.resetAt) {
      // Reset the limit
      this.rateLimits.set(phone, { count: 1, resetAt: now + 15 * 60 * 1000 });
      return { ok: true };
    }
    
    if (limit.count >= 3) {
      const remainingMinutes = Math.ceil((limit.resetAt - now) / 60000);
      return { 
        ok: false, 
        error: `Too many OTP requests. Please try again in ${remainingMinutes} minutes.` 
      };
    }
    
    limit.count++;
    return { ok: true };
  }

  /**
   * Generate 6-digit OTP
   * DEMO MODE: Always returns 123456 until real API is configured
   */
  _generateOTP() {
    // DEMO MODE: Hard-coded OTP for development
    if (!this.authKey || this.authKey === 'your_msg91_auth_key_here') {
      return '123456';
    }
    // Production: Random OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP via MSG91 API
   */
  async sendOTP(phone, method = 'sms') {
    try {
      // Validate phone
      const cleanPhone = String(phone).replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        return { ok: false, error: 'Invalid phone number' };
      }

      // Check rate limit
      const rateLimitCheck = this._checkRateLimit(cleanPhone);
      if (!rateLimitCheck.ok) {
        return rateLimitCheck;
      }

      // Generate OTP
      const otp = this._generateOTP();
      const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes
      const sessionId = `${cleanPhone}_${Date.now()}`;

      // Store session
      this.sessions.set(cleanPhone, {
        otp,
        expiry,
        attempts: 0,
        sessionId,
        method
      });

      console.log(`🔐 [MSG91] OTP for +91${cleanPhone}: ${otp} (${method})`);

      // Send OTP via MSG91
      if (!this.authKey || this.authKey === 'your_msg91_auth_key_here') {
        console.log('📱 [MSG91] Demo mode - OTP: 123456 (always use this OTP)');
        return { 
          ok: true, 
          sessionInfo: { sessionId },
          message: 'OTP sent (demo mode)',
          dev_otp: '123456' // Always show in demo
        };
      }

      if (method === 'whatsapp') {
        // MSG91 WhatsApp OTP
        const response = await axios.post(
          'https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/',
          {
            integrated_number: process.env.MSG91_WHATSAPP_NUMBER || '',
            content_type: 'template',
            payload: {
              to: `91${cleanPhone}`,
              type: 'template',
              template: {
                name: 'otp_template',
                language: { code: 'en' },
                components: [
                  {
                    type: 'body',
                    parameters: [{ type: 'text', text: otp }]
                  }
                ]
              }
            }
          },
          {
            headers: {
              'authkey': this.authKey,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.data && response.data.type === 'success') {
          console.log(`✅ [MSG91] WhatsApp OTP sent to +91${cleanPhone}`);
          return { ok: true, sessionInfo: { sessionId } };
        } else {
          throw new Error(response.data?.message || 'WhatsApp send failed');
        }
      } else {
        // MSG91 SMS OTP
        const response = await axios.get(
          `https://control.msg91.com/api/v5/otp`,
          {
            params: {
              authkey: this.authKey,
              mobile: `91${cleanPhone}`,
              otp: otp,
              template_id: this.templateId,
              sender: this.senderId,
              otp_expiry: '10' // 10 minutes
            }
          }
        );

        if (response.data && response.data.type === 'success') {
          console.log(`✅ [MSG91] SMS OTP sent to +91${cleanPhone}`);
          return { ok: true, sessionInfo: { sessionId } };
        } else {
          throw new Error(response.data?.message || 'SMS send failed');
        }
      }
    } catch (error) {
      console.error('❌ [MSG91] Send OTP error:', error.message);
      
      // Return generic error to avoid leaking API details
      if (error.response) {
        const status = error.response.status;
        if (status === 401 || status === 403) {
          return { ok: false, error: 'Authentication failed. Please check API credentials.' };
        } else if (status === 429) {
          return { ok: false, error: 'Too many requests. Please try again later.' };
        }
      }
      
      return { 
        ok: false, 
        error: 'Failed to send OTP. Please try again.' 
      };
    }
  }

  /**
   * Verify OTP entered by user
   */
  async verifyOTP(phone, otp, sessionInfo) {
    try {
      const cleanPhone = String(phone).replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        return { ok: false, error: 'Invalid phone number' };
      }

      if (!otp || otp.length !== 6) {
        return { ok: false, error: 'Invalid OTP format' };
      }

      // Get session
      const session = this.sessions.get(cleanPhone);
      
      if (!session) {
        return { ok: false, error: 'OTP not found. Please request a new one.' };
      }

      // Check expiry
      if (Date.now() > session.expiry) {
        this.sessions.delete(cleanPhone);
        return { ok: false, error: 'OTP expired. Please request a new one.' };
      }

      // Check attempts
      if (session.attempts >= 5) {
        this.sessions.delete(cleanPhone);
        return { ok: false, error: 'Too many failed attempts. Please request a new OTP.' };
      }

      // Verify OTP
      if (session.otp !== otp) {
        session.attempts++;
        const remaining = 5 - session.attempts;
        return { 
          ok: false, 
          error: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` 
        };
      }

      // OTP verified successfully
      this.sessions.delete(cleanPhone);
      
      console.log(`✅ [MSG91] OTP verified for +91${cleanPhone}`);
      
      return { 
        ok: true, 
        uid: `msg91_${cleanPhone}_${Date.now()}`
      };
    } catch (error) {
      console.error('❌ [MSG91] Verify OTP error:', error.message);
      return { ok: false, error: 'Failed to verify OTP. Please try again.' };
    }
  }

  /**
   * Get current user (stateless - always returns null)
   * Session management is handled by the application layer
   */
  async currentUser() {
    return null;
  }

  /**
   * Logout (no-op for stateless OTP)
   */
  async logout() {
    // No session to clear at provider level
    return;
  }

  /**
   * Get provider name
   */
  getName() {
    return 'MSG91';
  }

  /**
   * Clear expired sessions and rate limits (cleanup job)
   */
  cleanup() {
    const now = Date.now();
    
    // Clear expired sessions
    for (const [phone, session] of this.sessions.entries()) {
      if (now > session.expiry) {
        this.sessions.delete(phone);
      }
    }
    
    // Clear expired rate limits
    for (const [phone, limit] of this.rateLimits.entries()) {
      if (now > limit.resetAt) {
        this.rateLimits.delete(phone);
      }
    }
    
    console.log(`🧹 [MSG91] Cleanup: ${this.sessions.size} active sessions, ${this.rateLimits.size} rate limits`);
  }
}

module.exports = MSG91Provider;
