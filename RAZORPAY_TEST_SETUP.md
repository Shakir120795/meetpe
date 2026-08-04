# Razorpay Test Mode Setup

## Quick Fix Applied ✅

1. **User Profile Bug Fixed**: Phone number normalization now works correctly
2. **Razorpay Support Added**: Test mode keys added to `.env`

## To Enable Razorpay Test Payments

### 1. Get Your Test Keys from Razorpay Dashboard

1. Go to https://dashboard.razorpay.com
2. Sign in with your Razorpay account (or create one - it's free)
3. Go to Settings → API Keys
4. Copy your **Test Key ID** (starts with `rzp_test_`)
5. Copy your **Test Key Secret**

### 2. Add Keys to `.env`

Edit `.env` and update:

```env
RAZORPAY_KEY_ID=rzp_test_YOUR_TEST_KEY_HERE
RAZORPAY_KEY_SECRET=YOUR_TEST_SECRET_HERE
```

Example:
```env
RAZORPAY_KEY_ID=rzp_test_1a2b3c4d5e6f7g8h9i0j
RAZORPAY_KEY_SECRET=abcdef1234567890ghijk
```

### 3. Restart Your Server

```bash
npm start
# or if using pm2 on server:
pm2 restart meetpe
```

### 4. Test Payment

1. Open the app
2. Go to Wallet → Add Money
3. Click "Pay Online"
4. Use this test card: **4111 1111 1111 1111**
5. Any future date for expiry (e.g., 12/25)
6. Any 3-digit CVV (e.g., 123)
7. Any OTP when asked

**Expected Result**: Payment should succeed and wallet updated ✅

## Test Card Numbers

### Successful Payment
- Card: `4111 1111 1111 1111`
- Expiry: Any future date (MM/YY)
- CVV: Any 3 digits

### Declined Payment (to test error handling)
- Card: `4000 0000 0000 0002`
- Will always fail

## Production Setup (Later)

When going live:
1. Get Live Keys from Razorpay Dashboard
2. Update `.env` with Live Keys:
   ```env
   RAZORPAY_KEY_ID=rzp_live_YOUR_LIVE_KEY
   RAZORPAY_KEY_SECRET=YOUR_LIVE_SECRET
   ```
3. Your customers will use real credit cards

## Note
- Test mode is safe - no real money charged
- Test payments don't appear in real bank accounts
- When deployed to production, use Live Keys instead

## Status
- ✅ Backend: Razorpay endpoints ready
- ✅ Frontend: Payment modal ready
- ✅ Test mode info: Added console warning
- ⏳ Waiting for: Your test keys from Razorpay dashboard
