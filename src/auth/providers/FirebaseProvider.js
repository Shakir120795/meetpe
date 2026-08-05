/**
 * FirebaseProvider — Firebase Phone Authentication (STUB)
 * 
 * This is a stub for future Firebase Phone Auth implementation.
 * 
 * To implement:
 * 1. Install: npm install firebase firebase-admin
 * 2. Add environment variables:
 *    - FIREBASE_PROJECT_ID
 *    - FIREBASE_PRIVATE_KEY
 *    - FIREBASE_CLIENT_EMAIL
 *    - FIREBASE_API_KEY
 *    - FIREBASE_AUTH_DOMAIN
 * 3. Implement sendOTP() using Firebase Phone Auth with reCAPTCHA
 * 4. Implement verifyOTP() using Firebase verification
 * 5. Implement currentUser() using Firebase session tokens
 * 
 * Migration time: ~30 minutes (just change AUTH_PROVIDER=firebase in .env)
 */

const IAuthProvider = require('../auth.interface');

class FirebaseProvider extends IAuthProvider {
  constructor() {
    super();
    console.warn('⚠️ FirebaseProvider is a stub. Implement Firebase Phone Auth to use this provider.');
  }

  async sendOTP(phone, method = 'sms') {
    return { 
      ok: false, 
      error: 'Firebase provider not implemented. Please use MSG91 or implement Firebase Phone Auth.' 
    };
  }

  async verifyOTP(phone, otp, sessionInfo) {
    return { 
      ok: false, 
      error: 'Firebase provider not implemented.' 
    };
  }

  async currentUser() {
    return null;
  }

  async logout() {
    return;
  }

  getName() {
    return 'Firebase (Not Implemented)';
  }
}

module.exports = FirebaseProvider;
