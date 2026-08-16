/**
 * MSG91Provider — Widget-based OTP (no DLT registration needed)
 *
 * Uses MSG91 Secure OTP Widget API:
 * - Send OTP via Widget (SMS auto-handled by MSG91)
 * - Verify OTP via Widget
 * - Rate limiting: max 3 OTPs per 15 minutes
 *
 * Environment Variables Required:
 * - MSG91_AUTH_KEY: Your MSG91 Auth Key
 * - MSG91_WIDGET_ID: Your Widget ID (SecureOTPWidgetQF9Z)
 */

const IAuthProvider = require('../auth.interface');
const axios = require('axios');

class MSG91Provider extends IAuthProvider {
  constructor() {
    super();
    this.authKey = process.env.MSG91_AUTH_KEY;
    this.widgetId = process.env.MSG91_WIDGET_ID || 'SecureOTPWidgetQF9Z';

    // Rate limiting store
    this.rateLimits = new Map(); // { phone: { count, resetAt } }

    if (!this.authKey || this.authKey === 'your_msg91_auth_key_here') {
      console.warn('⚠️ MSG91_AUTH_KEY not configured. OTP will not be sent.');
    } else {
      console.log(`✅ [MSG91] Widget OTP Provider ready. Widget: ${this.widgetId}`);
    }
  }

  // Rate limit check: max 3 requests per 15 minutes
  _checkRateLimit(phone) {
    const limit = this.rateLimits.get(phone);
    const now = Date.now();

    if (!limit || now > limit.resetAt) {
      this.rateLimits.set(phone, { count: 1, resetAt: now + 15 * 60 * 1000 });
      return { ok: true };
    }

    if (limit.count >= 3) {
      const mins = Math.ceil((limit.resetAt - now) / 60000);
      return { ok: false, error: `Too many OTP requests. Try again in ${mins} minutes.` };
    }

    limit.count++;
    return { ok: true };
  }

  // Send OTP using MSG91 Widget API
  async sendOTP(phone, method = 'sms') {
    try {
      const cleanPhone = String(phone).replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        return { ok: false, error: 'Invalid phone number' };
      }

      // Check rate limit
      const rateCheck = this._checkRateLimit(cleanPhone);
      if (!rateCheck.ok) return rateCheck;

      // Check if configured
      if (!this.authKey || this.authKey === 'your_msg91_auth_key_here') {
        console.warn(`⚠️ [MSG91] Auth key not configured for +91${cleanPhone}`);
        return { ok: false, error: 'OTP service not configured. Please contact support.' };
      }

      console.log(`📱 [MSG91] Sending OTP to +91${cleanPhone} via Widget...`);

      // MSG91 Widget Send OTP API
      const response = await axios.post(
        'https://control.msg91.com/api/v5/widget/initiate',
        {
          identifier: `91${cleanPhone}`,
          widgetId: this.widgetId
        },
        {
          headers: {
            'authkey': this.authKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log(`📡 [MSG91] Send response:`, JSON.stringify(response.data));

      if (response.data && response.data.type === 'success') {
        const reqId = response.data.data?.reqId || response.data.reqId || '';
        console.log(`✅ [MSG91] OTP sent to +91${cleanPhone}, reqId: ${reqId}`);
        return {
          ok: true,
          sessionInfo: { reqId, phone: cleanPhone },
          message: 'OTP sent successfully'
        };
      } else {
        const errMsg = response.data?.message || response.data?.error || 'Failed to send OTP';
        console.error(`❌ [MSG91] Send failed:`, errMsg);
        return { ok: false, error: errMsg };
      }

    } catch (error) {
      console.error('❌ [MSG91] sendOTP error:', error.message);
      if (error.response) {
        console.error('Response:', JSON.stringify(error.response.data));
        if (error.response.status === 401 || error.response.status === 403) {
          return { ok: false, error: 'OTP service authentication failed.' };
        }
        if (error.response.status === 429) {
          return { ok: false, error: 'Too many requests. Please try again later.' };
        }
      }
      return { ok: false, error: 'Failed to send OTP. Please try again.' };
    }
  }

  // Verify OTP using MSG91 Widget API
  async verifyOTP(phone, otp, sessionInfo) {
    try {
      const cleanPhone = String(phone).replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        return { ok: false, error: 'Invalid phone number' };
      }

      const cleanOTP = String(otp || '').trim();
      if (!cleanOTP || cleanOTP.length !== 6) {
        return { ok: false, error: 'Invalid OTP format' };
      }

      if (!this.authKey || this.authKey === 'your_msg91_auth_key_here') {
        return { ok: false, error: 'OTP service not configured.' };
      }

      const reqId = sessionInfo?.reqId || '';

      console.log(`🔍 [MSG91] Verifying OTP for +91${cleanPhone}, reqId: ${reqId}`);

      // MSG91 Widget Verify OTP API
      const response = await axios.post(
        'https://control.msg91.com/api/v5/widget/verify',
        {
          identifier: `91${cleanPhone}`,
          otp: cleanOTP,
          widgetId: this.widgetId,
          ...(reqId && { reqId })
        },
        {
          headers: {
            'authkey': this.authKey,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log(`📡 [MSG91] Verify response:`, JSON.stringify(response.data));

      if (response.data && response.data.type === 'success') {
        console.log(`✅ [MSG91] OTP verified for +91${cleanPhone}`);
        return {
          ok: true,
          uid: `msg91_${cleanPhone}_${Date.now()}`
        };
      } else {
        const errMsg = response.data?.message || 'Invalid OTP';
        console.error(`❌ [MSG91] Verify failed:`, errMsg);
        return { ok: false, error: errMsg };
      }

    } catch (error) {
      console.error('❌ [MSG91] verifyOTP error:', error.message);
      if (error.response) {
        console.error('Response:', JSON.stringify(error.response.data));
        const errMsg = error.response.data?.message || 'OTP verification failed';
        return { ok: false, error: errMsg };
      }
      return { ok: false, error: 'Failed to verify OTP. Please try again.' };
    }
  }

  async currentUser() { return null; }
  async logout() { return; }
  getName() { return 'MSG91'; }

  cleanup() {
    const now = Date.now();
    for (const [phone, limit] of this.rateLimits.entries()) {
      if (now > limit.resetAt) this.rateLimits.delete(phone);
    }
  }
}

module.exports = MSG91Provider;
