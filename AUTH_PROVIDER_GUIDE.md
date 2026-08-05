# Authentication Provider Architecture Guide

## Overview

The NOW (Nonveg On Wheel) application uses a **provider-based authentication architecture** that completely decouples the application from any specific OTP service.

This means:
- ✅ **Zero coupling** - Application never calls MSG91, Firebase, or Twilio directly
- ✅ **One variable switch** - Change `AUTH_PROVIDER` in `.env` to migrate providers
- ✅ **No code changes** - Routes, controllers, and frontend remain unchanged
- ✅ **Future-proof** - Add new providers without touching existing code

---

## Architecture

```
Application Layer (Routes, Controllers, Frontend)
              ↓
        auth.service.js (Single Interface)
              ↓
      IAuthProvider (Interface)
              ↓
    ┌─────────┴─────────┬──────────┐
    ↓                   ↓          ↓
MSG91Provider   FirebaseProvider  TwilioProvider
```

### Key Components

1. **`auth.service.js`** - Singleton service that the entire application uses
2. **`auth.interface.js`** - Interface defining required methods for all providers
3. **`providers/MSG91Provider.js`** - Production-ready MSG91 implementation
4. **`providers/FirebaseProvider.js`** - Stub for Firebase Phone Auth
5. **`providers/TwilioProvider.js`** - Stub for Twilio SMS/WhatsApp

---

## Current Provider: MSG91

### Features Implemented

✅ **OTP Expiry** - 10 minutes
✅ **Resend Timer** - 30 seconds between resends
✅ **Rate Limiting** - Max 3 OTPs per 15 minutes per phone
✅ **Retry Tracking** - Max 5 verification attempts per OTP
✅ **SMS & WhatsApp** - Both delivery methods supported
✅ **Error Handling** - Proper user-friendly error messages
✅ **Cleanup Job** - Auto-removes expired sessions every 5 minutes
✅ **Demo Mode** - Works without API key for development

### Setup MSG91

1. **Sign up**: https://control.msg91.com/signup/
2. **Get your AUTH_KEY**: https://control.msg91.com/user/index.php#api
3. **Create SMS template** (if required by MSG91)
4. **Update `.env`**:

```env
AUTH_PROVIDER=msg91
MSG91_AUTH_KEY=your_actual_auth_key
MSG91_TEMPLATE_ID=your_template_id
MSG91_SENDER_ID=MSGIND
MSG91_WHATSAPP_NUMBER=919876543210
```

5. **Restart server**: `npm start`

That's it! Your app now sends real OTPs via MSG91.

---

## How the Application Uses Auth

### Backend Routes (`src/server.js`)

```javascript
const authService = require('./auth/auth.service');

// Send OTP
app.post('/api/auth/send-otp', async (req, res) => {
  const result = await authService.sendOTP(phone, method);
  // ...
});

// Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  const result = await authService.verifyOTP(phone, otp, sessionInfo);
  // ...
});
```

### Frontend (`public/index.html`)

```javascript
// Send OTP
async function sendOTP() {
  const res = await fetch('/api/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otpMethod: 'sms' })
  });
  // ...
}

// Verify OTP
async function verifyOTP() {
  const res = await fetch('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp, sessionInfo })
  });
  // ...
}
```

**Notice**: The application never knows which provider is active.

---

## Migrating to Another Provider

### Scenario: Switch from MSG91 to Firebase

**Time Required**: 5 minutes (if Firebase provider is implemented)

**Steps**:

1. Update `.env`:
```env
AUTH_PROVIDER=firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_API_KEY=your-api-key
# ... other Firebase config
```

2. Restart server: `npm start`

**That's it!** No code changes needed.

---

## Provider Comparison

| Feature | MSG91 | Firebase | Twilio |
|---------|-------|----------|--------|
| Status | ✅ Implemented | 🚧 Stub | 🚧 Stub |
| SMS | ✅ Yes | ✅ Yes | ✅ Yes |
| WhatsApp | ✅ Yes | ❌ No | ✅ Yes |
| Rate Limiting | ✅ Built-in | ⚠️ Manual | ⚠️ Manual |
| Retry Tracking | ✅ Built-in | ⚠️ Manual | ⚠️ Manual |
| India-first | ✅ Yes | ❌ No | ❌ No |
| Cost | Low | Free tier | Expensive |
| Migration Time | - | ~30 min | ~15 min |

---

## Implementing a New Provider

### Example: Adding Twilio Provider

1. **Open `src/auth/providers/TwilioProvider.js`**

2. **Install dependencies** (if needed):
```bash
npm install twilio
```

3. **Implement the interface**:

```javascript
const IAuthProvider = require('../auth.interface');
const twilio = require('twilio');

class TwilioProvider extends IAuthProvider {
  constructor() {
    super();
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.sessions = new Map();
  }

  async sendOTP(phone, method = 'sms') {
    // 1. Generate OTP
    const otp = this._generateOTP();
    
    // 2. Store session
    this.sessions.set(phone, { otp, expiry: Date.now() + 600000 });
    
    // 3. Send via Twilio
    await this.client.messages.create({
      body: `Your OTP is: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: `+91${phone}`
    });
    
    return { ok: true, sessionInfo: { sessionId: phone } };
  }

  async verifyOTP(phone, otp, sessionInfo) {
    const session = this.sessions.get(phone);
    if (!session) return { ok: false, error: 'OTP not found' };
    if (Date.now() > session.expiry) return { ok: false, error: 'OTP expired' };
    if (session.otp !== otp) return { ok: false, error: 'Invalid OTP' };
    
    this.sessions.delete(phone);
    return { ok: true, uid: `twilio_${phone}` };
  }

  async currentUser() { return null; }
  async logout() { return; }
  getName() { return 'Twilio'; }
  
  _generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

module.exports = TwilioProvider;
```

4. **Update `.env`**:
```env
AUTH_PROVIDER=twilio
```

5. **Done!** Application now uses Twilio.

---

## Error Handling

### MSG91 Provider Errors

| Error | User Message | Cause |
|-------|-------------|-------|
| Rate limit | "Too many OTP requests. Try again in X minutes." | More than 3 OTPs in 15 min |
| Invalid phone | "Invalid phone number" | Phone not 10 digits |
| OTP expired | "OTP expired. Please request a new one." | 10 minutes passed |
| Too many attempts | "Too many failed attempts. Request new OTP." | 5 wrong OTP entries |
| API error | "Failed to send OTP. Please try again." | MSG91 API issue |
| Network error | "Network error. Please try again." | No internet connection |

All errors are logged to console with `❌` prefix for debugging.

---

## Security Features

### Rate Limiting
- **Max 3 OTPs** per phone number in 15 minutes
- Automatic reset after 15 minutes
- Prevents SMS bombing attacks

### Retry Tracking
- **Max 5 attempts** to verify each OTP
- Shows remaining attempts to user
- Prevents brute-force attacks

### OTP Expiry
- **10 minutes** validity
- Automatic cleanup of expired sessions
- Reduces attack window

### Session Management
- Provider-specific session storage
- Cleanup job runs every 5 minutes
- No session leaks

---

## Testing

### Demo Mode (Without MSG91 API Key)

If `MSG91_AUTH_KEY` is not set in `.env`:

1. OTP is generated but not sent to MSG91 API
2. OTP is logged to console: `🔐 [MSG91] OTP for +91XXXXXXXXXX: 123456`
3. In development mode, OTP is shown in frontend toast
4. Verification still works normally

This allows full testing without API costs.

### Testing Rate Limiting

```bash
# Request 4 OTPs quickly
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","otpMethod":"sms"}'

# 4th request will fail with rate limit error
```

### Testing OTP Expiry

1. Request OTP
2. Wait 11 minutes
3. Try to verify - will get "OTP expired" error

---

## Production Deployment

### Checklist

- [ ] Add valid `MSG91_AUTH_KEY` to production `.env`
- [ ] Set `AUTH_PROVIDER=msg91` in production `.env`
- [ ] Create SMS template in MSG91 dashboard
- [ ] Configure sender ID (optional)
- [ ] Test OTP delivery in production
- [ ] Monitor MSG91 API usage in dashboard
- [ ] Set up alerts for failed deliveries
- [ ] Consider Redis for session storage (scalability)

### Scaling Considerations

**Current Implementation**: In-memory session storage (Map)

**For Production at Scale**:
- Replace `Map` with **Redis** for session storage
- Add Redis connection in `MSG91Provider` constructor
- Update `sendOTP()` and `verifyOTP()` to use Redis
- Benefit: Sessions work across multiple server instances

---

## Why This Architecture?

### ❌ Before (Tightly Coupled)

```javascript
// Server.js directly calling Twilio
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

app.post('/api/auth/send-otp', async (req, res) => {
  await client.messages.create({ ... }); // Coupled to Twilio!
});
```

**Problems**:
- To switch to MSG91, must rewrite all routes
- Frontend might need changes too
- Testing requires mocking Twilio
- Can't A/B test different providers

### ✅ After (Provider Pattern)

```javascript
// Server.js using auth service
const authService = require('./auth/auth.service');

app.post('/api/auth/send-otp', async (req, res) => {
  await authService.sendOTP(phone, method); // Provider-agnostic!
});
```

**Benefits**:
- Switch providers by changing ONE env variable
- Easy to test with mock provider
- Can A/B test different providers
- Future-proof for new services

---

## Troubleshooting

### "Failed to send OTP" Error

**Check**:
1. Is `MSG91_AUTH_KEY` correct in `.env`?
2. Is your MSG91 account active?
3. Do you have SMS credits?
4. Check console logs for detailed error

### Rate Limit Not Working

**Check**:
1. Server restarted recently? (In-memory map is cleared)
2. Testing with same phone number?
3. Wait 15 minutes for reset

### OTP Not Received

**Check**:
1. Phone number is correct (10 digits, no country code)?
2. MSG91 sender ID is approved?
3. Check MSG91 dashboard for delivery status
4. Try with different number

### Demo Mode Not Showing OTP

**Check**:
1. `MSG91_AUTH_KEY` should be empty or invalid
2. Check browser console for OTP log
3. Look for server console log: `🔐 [MSG91] OTP for...`

---

## Summary

| Aspect | Implementation |
|--------|----------------|
| **Current Provider** | MSG91 (production-ready) |
| **Switch Method** | Change `AUTH_PROVIDER` in `.env` |
| **Code Changes Required** | ZERO |
| **Migration Time** | < 5 minutes (if provider implemented) |
| **OTP Expiry** | 10 minutes |
| **Rate Limit** | 3 OTPs / 15 min |
| **Max Attempts** | 5 per OTP |
| **SMS Support** | ✅ Yes |
| **WhatsApp Support** | ✅ Yes |
| **Demo Mode** | ✅ Yes (no API key needed) |

---

## Next Steps

1. **For Production**: Add your MSG91 API key to `.env`
2. **For Firebase**: Implement `FirebaseProvider.js` (~30 min)
3. **For Twilio**: Implement `TwilioProvider.js` (~15 min)
4. **For Scale**: Add Redis for session storage
5. **For Testing**: Keep demo mode enabled in dev environment

---

**Remember**: The entire application is 100% decoupled from the OTP provider. Change providers anytime by changing ONE environment variable. No code changes. Ever.
