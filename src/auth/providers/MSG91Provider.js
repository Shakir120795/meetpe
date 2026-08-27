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
    // Widget token is used as tokenAuth in widget API calls (different from authKey)
    this.widgetToken = process.env.MSG91_WIDGET_TOKEN || this.authKey;

    // Rate limiting — DB backed so restart doesn't bypass it
    // Table created lazily via ensureRateLimitTable()
    this._rateLimitTableReady = false;

    if (!this.authKey || this.authKey === 'your_msg91_auth_key_here') {
      console.warn('⚠️ MSG91_AUTH_KEY not configured. OTP will not be sent.');
    } else {
      console.log(`✅ [MSG91] Widget OTP Provider ready. Widget: ${this.widgetId}`);
    }
  }

  // Ensure otp_rate_limits table exists
  _ensureTable() {
    if (this._rateLimitTableReady) return;
    try {
      const db = require('../../db/init');
      db.exec(`CREATE TABLE IF NOT EXISTS otp_rate_limits (
        phone TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        reset_at INTEGER NOT NULL
      )`);
      this._rateLimitTableReady = true;
    } catch(e) {}
  }

  // Rate limit check: max 3 OTP requests per 15 minutes per phone
  _checkRateLimit(phone) {
    try {
      this._ensureTable();
      const db = require('../../db/init');
      const now = Date.now();
      const resetAt = now + 15 * 60 * 1000;

      const row = db.prepare('SELECT count, reset_at FROM otp_rate_limits WHERE phone = ?').get(phone);

      if (!row || now > row.reset_at) {
        // First request or window expired
        db.prepare('INSERT OR REPLACE INTO otp_rate_limits (phone, count, reset_at) VALUES (?, 1, ?)').run(phone, resetAt);
        return { ok: true };
      }

      if (row.count >= 3) {
        const mins = Math.ceil((row.reset_at - now) / 60000);
        return { ok: false, error: `Too many OTP requests. Try again in ${mins} minutes.` };
      }

      db.prepare('UPDATE otp_rate_limits SET count = count + 1 WHERE phone = ?').run(phone);
      return { ok: true };
    } catch(e) {
      return { ok: true }; // fail open — don't block user if DB error
    }
  }

  cleanup() {
    try {
      this._ensureTable();
      const db = require('../../db/init');
      db.prepare('DELETE FROM otp_rate_limits WHERE reset_at < ?').run(Date.now());
    } catch(e) {}
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

      // MSG91 OTP Widget Send OTP
      // Widget controls the configured channel (WhatsApp in this widget).
      const response = await axios.post(
        'https://api.msg91.com/api/v5/widget/sendOtp',
        {
          widgetId: this.widgetId,
          identifier: `91${cleanPhone}`
        },
        {
          headers: {
            'authkey': this.authKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log(`📡 [MSG91] Send response:`, JSON.stringify(response.data));

      if (response.data && response.data.type === 'success') {
        const reqId = response.data.data?.reqId || response.data.reqId || response.data.request_id || response.data.message || '';
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

  // Verify OTP with MSG91 Widget API — never trust client input alone
  async verifyOTP(phone, otp, sessionInfo = {}) {
    try {
      const cleanPhone = String(phone).replace(/\D/g, '');

      if (cleanPhone.length !== 10) {
        return { ok: false, error: 'Invalid phone number' };
      }

      if (!/^\d{6}$/.test(String(otp))) {
        return { ok: false, error: 'Invalid OTP' };
      }

      const reqId = sessionInfo?.reqId || sessionInfo?.request_id || '';

      if (!reqId) {
        console.error(`❌ [MSG91] Missing reqId for +91${cleanPhone}`);
        return { ok: false, error: 'OTP session expired. Please request a new OTP.' };
      }

      const response = await axios.post(
        'https://api.msg91.com/api/v5/widget/verifyOtp',
        {
          widgetId: this.widgetId,
          reqId,
          otp: String(otp)
        },
        {
          headers: {
            authkey: this.authKey,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          timeout: 10000
        }
      );

      console.log(`📡 [MSG91] Verify response:`, JSON.stringify(response.data));

      const data = response.data || {};
      const success =
        data.type === 'success' ||
        data.message === 'OTP verified successfully' ||
        data.status === 'success';

      if (!success) {
        const errMsg =
          data.message ||
          data.error ||
          data.msg ||
          'Invalid OTP';

        console.warn(`❌ [MSG91] OTP verification failed: ${errMsg}`);
        return { ok: false, error: errMsg };
      }

      console.log(`✅ [MSG91] OTP verified for +91${cleanPhone}`);

      return {
        ok: true,
        uid: `msg91_${cleanPhone}_${Date.now()}`,
        accessToken: data.data?.accessToken || data.accessToken || null
      };

    } catch (error) {
      console.error('❌ [MSG91] verifyOTP error:', error.message);

      if (error.response) {
        console.error('Response:', JSON.stringify(error.response.data));

        const providerError =
          error.response.data?.message ||
          error.response.data?.error ||
          error.response.data?.msg;

        if (error.response.status === 401 || error.response.status === 403) {
          return { ok: false, error: 'OTP service authentication failed.' };
        }

        if (error.response.status === 429) {
          return { ok: false, error: 'Too many OTP attempts. Please try again later.' };
        }

        if (providerError) {
          return { ok: false, error: providerError };
        }
      }

      return { ok: false, error: 'Failed to verify OTP. Please try again.' };
    }
  }

  async currentUser() { return null; }
  async logout() { return; }
  getName() { return 'MSG91'; }
}

module.exports = MSG91Provider;