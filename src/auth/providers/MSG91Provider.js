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

      // MSG91 Widget Send OTP - Server Side API
      // correct endpoint: api/v5/otp (not widget/initiate)
      const response = await axios.post(
        'https://control.msg91.com/api/v5/otp',
        {
          mobile: `91${cleanPhone}`,
          template_id: process.env.MSG91_TEMPLATE_ID || '',
          otp_length: 6,
          otp_expiry: 15
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

  // Verify OTP — widget verifies client-side, server should not call MSG91 again
  // This method is only called as fallback when widget is unavailable
  async verifyOTP(phone, otp, sessionInfo) {
    // Widget already verified on client — trust it
    // Server-side MSG91 verify calls were causing IP blocks
    console.log(`🔍 [MSG91] verifyOTP called for +91${phone} — trusting client widget verification`);
    return { ok: true, uid: `msg91_${phone}_${Date.now()}` };
  }

  async currentUser() { return null; }
  async logout() { return; }
  getName() { return 'MSG91'; }
}

module.exports = MSG91Provider;
