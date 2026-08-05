/**
 * TwilioProvider — Twilio SMS/WhatsApp OTP (STUB)
 * 
 * This is a stub for Twilio implementation.
 * The old Twilio code from server.js can be migrated here.
 * 
 * To implement:
 * 1. Move Twilio credentials to .env:
 *    - TWILIO_ACCOUNT_SID (already exists)
 *    - TWILIO_AUTH_TOKEN (already exists)
 *    - TWILIO_PHONE_NUMBER or TWILIO_WHATSAPP_FROM
 * 2. Move the sendMessage() logic here
 * 3. Implement rate limiting and OTP expiry
 * 4. Add retry tracking
 * 
 * Migration time: ~15 minutes (just change AUTH_PROVIDER=twilio in .env)
 */

const IAuthProvider = require('../auth.interface');

class TwilioProvider extends IAuthProvider {
  constructor() {
    super();
    console.warn('⚠️ TwilioProvider is a stub. Implement to use Twilio for OTP.');
  }

  async sendOTP(phone, method = 'sms') {
    return { 
      ok: false, 
      error: 'Twilio provider not implemented. Please use MSG91 or implement Twilio OTP.' 
    };
  }

  async verifyOTP(phone, otp, sessionInfo) {
    return { 
      ok: false, 
      error: 'Twilio provider not implemented.' 
    };
  }

  async currentUser() {
    return null;
  }

  async logout() {
    return;
  }

  getName() {
    return 'Twilio (Not Implemented)';
  }
}

module.exports = TwilioProvider;
