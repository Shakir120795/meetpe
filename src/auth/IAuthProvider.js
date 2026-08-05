/**
 * IAuthProvider — Interface for authentication providers
 * 
 * All providers (Firebase, MSG91, Twilio, Custom OTP API) must implement this interface.
 * This ensures the rest of the application never depends on a specific provider.
 */

class IAuthProvider {
  /**
   * Send OTP to the given phone number
   * @param {string} phone - 10-digit phone number (without country code)
   * @param {string} method - 'sms' or 'whatsapp'
   * @returns {Promise<{ok: boolean, error?: string, sessionInfo?: any}>}
   */
  async sendOTP(phone, method = 'sms') {
    throw new Error('sendOTP() must be implemented by provider');
  }

  /**
   * Verify OTP entered by user
   * @param {string} phone - 10-digit phone number
   * @param {string} otp - OTP code entered by user
   * @param {any} sessionInfo - Session data returned by sendOTP (provider-specific)
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  async verifyOTP(phone, otp, sessionInfo) {
    throw new Error('verifyOTP() must be implemented by provider');
  }

  /**
   * Get current authenticated user (if any)
   * @returns {Promise<{phone: string, uid: string} | null>}
   */
  async currentUser() {
    throw new Error('currentUser() must be implemented by provider');
  }

  /**
   * Logout current user
   * @returns {Promise<void>}
   */
  async logout() {
    throw new Error('logout() must be implemented by provider');
  }

  /**
   * Get provider name
   * @returns {string}
   */
  getName() {
    throw new Error('getName() must be implemented by provider');
  }
}

module.exports = IAuthProvider;
