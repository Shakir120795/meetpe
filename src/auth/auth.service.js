/**
 * AuthService — Centralized authentication service
 * 
 * This is the ONLY interface the application should use for authentication.
 * 
 * Routes, controllers, and frontend must call ONLY:
 * - authService.sendOTP(phone, method)
 * - authService.verifyOTP(phone, otp, sessionInfo)
 * - authService.currentUser()
 * - authService.logout()
 * 
 * The provider is selected using AUTH_PROVIDER environment variable:
 * - AUTH_PROVIDER=msg91 (default, production-ready)
 * - AUTH_PROVIDER=firebase (stub)
 * - AUTH_PROVIDER=twilio (stub)
 * 
 * Changing providers requires changing ONLY ONE environment variable.
 * NO code changes in routes, controllers, or frontend.
 */

const MSG91Provider = require('./providers/MSG91Provider');
const FirebaseProvider = require('./providers/FirebaseProvider');
const TwilioProvider = require('./providers/TwilioProvider');

class AuthService {
  constructor() {
    this.provider = null;
    this._initializeProvider();
    
    // Start cleanup job for session management
    this._startCleanupJob();
  }

  /**
   * Initialize the authentication provider based on AUTH_PROVIDER env variable
   */
  _initializeProvider() {
    const providerName = (process.env.AUTH_PROVIDER || 'msg91').toLowerCase();
    
    switch (providerName) {
      case 'msg91':
        this.provider = new MSG91Provider();
        console.log('✅ [AuthService] Using MSG91 provider');
        break;
      
      case 'firebase':
        this.provider = new FirebaseProvider();
        console.log('⚠️ [AuthService] Using Firebase provider (stub)');
        break;
      
      case 'twilio':
        this.provider = new TwilioProvider();
        console.log('⚠️ [AuthService] Using Twilio provider (stub)');
        break;
      
      default:
        console.error(`❌ [AuthService] Unknown provider: ${providerName}. Falling back to MSG91.`);
        this.provider = new MSG91Provider();
    }
    
    console.log(`📱 [AuthService] Active provider: ${this.provider.getName()}`);
  }

  /**
   * Send OTP to phone number
   * @param {string} phone - 10-digit phone number
   * @param {string} method - 'sms' or 'whatsapp'
   * @returns {Promise<{ok: boolean, error?: string, sessionInfo?: any}>}
   */
  async sendOTP(phone, method = 'sms') {
    try {
      console.log(`📤 [AuthService] Sending OTP to ${phone} via ${method}`);
      const result = await this.provider.sendOTP(phone, method);
      
      if (result.ok) {
        console.log(`✅ [AuthService] OTP sent successfully via ${this.provider.getName()}`);
      } else {
        console.warn(`⚠️ [AuthService] Failed to send OTP: ${result.error}`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ [AuthService] sendOTP error:', error);
      return { 
        ok: false, 
        error: 'Failed to send OTP. Please try again.' 
      };
    }
  }

  /**
   * Verify OTP entered by user
   * @param {string} phone - 10-digit phone number
   * @param {string} otp - OTP code
   * @param {any} sessionInfo - Session data from sendOTP
   * @returns {Promise<{ok: boolean, error?: string, uid?: string}>}
   */
  async verifyOTP(phone, otp, sessionInfo) {
    try {
      console.log(`🔍 [AuthService] Verifying OTP for ${phone}`);
      const result = await this.provider.verifyOTP(phone, otp, sessionInfo);
      
      if (result.ok) {
        console.log(`✅ [AuthService] OTP verified successfully via ${this.provider.getName()}`);
      } else {
        console.warn(`⚠️ [AuthService] OTP verification failed: ${result.error}`);
      }
      
      return result;
    } catch (error) {
      console.error('❌ [AuthService] verifyOTP error:', error);
      return { 
        ok: false, 
        error: 'Failed to verify OTP. Please try again.' 
      };
    }
  }

  /**
   * Get current authenticated user
   * @returns {Promise<{phone: string, uid: string} | null>}
   */
  async currentUser() {
    try {
      return await this.provider.currentUser();
    } catch (error) {
      console.error('❌ [AuthService] currentUser error:', error);
      return null;
    }
  }

  /**
   * Logout current user
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      console.log('👋 [AuthService] Logging out user');
      await this.provider.logout();
    } catch (error) {
      console.error('❌ [AuthService] logout error:', error);
    }
  }

  /**
   * Get provider name (for debugging)
   * @returns {string}
   */
  getProviderName() {
    return this.provider.getName();
  }

  /**
   * Start cleanup job to remove expired sessions
   * Runs every 5 minutes
   */
  _startCleanupJob() {
    setInterval(() => {
      if (this.provider && typeof this.provider.cleanup === 'function') {
        this.provider.cleanup();
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}

// Export singleton instance
module.exports = new AuthService();
