# 🔐 OTP Verification Setup Guide

This guide explains how to set up **real OTP verification** via SMS and WhatsApp for the NOW (Nonveg On Wheel) app.

---

## ✅ Features Implemented

1. **Two-step login flow**
   - Step 1: Enter phone number → Send OTP
   - Step 2: Enter OTP + select SMS/WhatsApp → Verify

2. **OTP delivery methods**
   - 💬 SMS (via Twilio)
   - 📱 WhatsApp (via Twilio)

3. **Security features**
   - 6-digit random OTP
   - 10-minute expiry
   - Resend OTP with 30-second cooldown
   - OTP cleared after verification

4. **Referral system**
   - New users get ₹20 bonus with referral code
   - Referrer gets ₹100 bonus

---

## 🚀 Setup Instructions

### Step 1: Get Twilio Account

1. Go to [Twilio Console](https://console.twilio.com/)
2. Sign up for a free account
3. Get your credentials:
   - **Account SID** (starts with `AC...`)
   - **Auth Token**

### Step 2: Enable SMS (Required)

1. In Twilio Console, go to **Phone Numbers** → **Buy a Number**
2. Select a phone number with **SMS capability**
3. Purchase the number (costs ~$1/month)
4. Note down your Twilio phone number (e.g., `+1234567890`)

### Step 3: Enable WhatsApp (Optional)

**Option A: WhatsApp Sandbox (Free, for testing)**
1. In Twilio Console, go to **Messaging** → **Try it out** → **Send a WhatsApp message**
2. Send the join code from your phone to Twilio's WhatsApp number
3. Use sandbox number: `whatsapp:+14155238886`

**Option B: Production WhatsApp (Requires approval)**
1. Go to **Messaging** → **WhatsApp** → **Senders**
2. Request access to WhatsApp Business API
3. Submit business details for approval
4. Use your approved WhatsApp number

### Step 4: Update Environment Variables

Edit your `.env` file:

```env
# Twilio Credentials
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here

# SMS: Your purchased Twilio phone number
TWILIO_SMS_FROM=+1234567890

# WhatsApp: Sandbox (testing) or approved number (production)
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

### Step 5: Update Twilio Helper (Optional)

If using separate numbers for SMS and WhatsApp, update `src/whatsapp/twilio.js`:

```javascript
const SMS_FROM = process.env.TWILIO_SMS_FROM || '+1234567890';
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

async function sendMessage(to, body) {
  if (!client) {
    console.warn('[twilio] client not configured; would send:', to, body.slice(0, 80));
    return null;
  }
  
  // Determine which number to use based on recipient format
  const from = to.startsWith('whatsapp:') ? WHATSAPP_FROM : SMS_FROM;
  
  return client.messages.create({ from, to, body });
}
```

### Step 6: Restart Server

```bash
npm start
```

---

## 📱 How It Works

### 1. User enters phone number
Frontend calls: `POST /api/auth/send-otp`
```json
{
  "phone": "8126812317",
  "otpMethod": "sms"  // or "whatsapp"
}
```

### 2. Backend generates & sends OTP
- Generates random 6-digit OTP
- Stores in memory with 10-minute expiry
- Sends via Twilio:
  - SMS: `+918126812317`
  - WhatsApp: `whatsapp:+918126812317`

### 3. User enters OTP
Frontend calls: `POST /api/auth/verify-otp`
```json
{
  "phone": "8126812317",
  "otp": "123456",
  "referralCode": "ABC123"  // optional
}
```

### 4. Backend verifies OTP
- Checks if OTP matches
- Checks if not expired
- Creates/logs in user
- Applies referral bonus if new user
- Clears OTP from storage

---

## 🔒 Security Features

1. **OTP Expiry**: 10 minutes (configurable)
2. **Rate Limiting**: 30-second cooldown between resends
3. **One-time use**: OTP cleared after verification
4. **In-memory storage**: OTPs not saved to database

### Production Recommendations

For production, use **Redis** instead of in-memory storage:

```javascript
const redis = require('redis');
const client = redis.createClient();

// Store OTP
await client.setex(`otp:${phone}`, 600, JSON.stringify({ otp, method }));

// Verify OTP
const stored = await client.get(`otp:${phone}`);

// Clear OTP
await client.del(`otp:${phone}`);
```

---

## 💰 Referral System

### New User (with referral code)
1. Gets **₹20** in wallet
2. Referrer gets **₹100** in wallet

### Implementation
```javascript
// In /api/auth/verify-otp endpoint
if (isNewUser && referralCode) {
  const referrer = db.prepare('SELECT phone FROM customers WHERE referral_code = ?').get(referralCode);
  
  if (referrer) {
    // Give ₹20 to new user
    db.prepare('INSERT INTO customers (phone, wallet_balance, referred_by) VALUES (?, 20, ?)').run(waPhone, referrer.phone);
    
    // Give ₹100 to referrer
    db.prepare('UPDATE customers SET wallet_balance = wallet_balance + 100 WHERE phone = ?').run(referrer.phone);
  }
}
```

---

## 🧪 Testing

### Development Mode
- Console logs OTP: `🔐 OTP for 8126812317: 123456 (sms)`
- Works offline (no Twilio required)
- Demo OTP included in response if `NODE_ENV=development`

### Production Mode
- OTP sent via Twilio
- No OTP in response
- Logs only show success/failure

---

## 💳 Pricing (Twilio)

### SMS
- **India**: ~₹0.50 per SMS (~$0.006)
- **Bulk discount**: Available for high volume

### WhatsApp
- **Sandbox**: FREE (testing only)
- **Production**: ~₹0.30 per message (~$0.004)
- **No inbound charges**: Receiving is free

### Estimate
- 1000 OTPs/month: ~₹500 ($6)
- 10,000 OTPs/month: ~₹5,000 ($60)

---

## 🐛 Troubleshooting

### "OTP not found"
- OTP expired (>10 minutes)
- Server restarted (in-memory cleared)
- Solution: Request new OTP

### "Twilio error"
- Check credentials in `.env`
- Verify Twilio account is active
- Check account balance
- Ensure phone number is verified (sandbox mode)

### WhatsApp not working
- Sandbox: Send join code first
- Production: Ensure approved by WhatsApp
- Check `TWILIO_WHATSAPP_FROM` format: `whatsapp:+14155238886`

### SMS not working
- Check `TWILIO_SMS_FROM` is valid purchased number
- Verify number has SMS capability
- Check recipient country is supported

---

## 📚 API Reference

### Send OTP
```http
POST /api/auth/send-otp
Content-Type: application/json

{
  "phone": "8126812317",
  "otpMethod": "sms"
}

Response:
{
  "ok": true,
  "message": "OTP sent successfully",
  "dev_otp": "123456"  // only in development
}
```

### Verify OTP
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "phone": "8126812317",
  "otp": "123456",
  "referralCode": "ABC123"
}

Response:
{
  "ok": true,
  "customer": {
    "phone": "8126812317",
    "name": "",
    "wallet": 20,
    "membership_active": false
  },
  "referralBonus": "₹20",
  "isNewUser": true
}
```

---

## ✅ Checklist

- [ ] Twilio account created
- [ ] Account SID and Auth Token obtained
- [ ] Phone number purchased (SMS)
- [ ] WhatsApp sandbox joined (testing) or approved (production)
- [ ] `.env` file updated with credentials
- [ ] Server restarted
- [ ] Test OTP via SMS
- [ ] Test OTP via WhatsApp
- [ ] Test referral system

---

## 🎯 Next Steps

1. **Production**: Switch from in-memory to Redis for OTP storage
2. **Rate limiting**: Add IP-based rate limiting to prevent abuse
3. **Analytics**: Track OTP success/failure rates
4. **Multi-language**: Add regional language support in OTP messages
5. **Voice OTP**: Add voice call option for users who can't receive SMS/WhatsApp

---

**Need help?** Check [Twilio Documentation](https://www.twilio.com/docs)
