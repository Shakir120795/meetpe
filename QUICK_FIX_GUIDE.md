# Quick Fix Guide - User Profile & Razorpay

## ✅ USER PROFILE FIX - ALREADY DONE
- **Status**: FIXED & DEPLOYED
- **Commit**: `20a192a`
- **What was wrong**: Complex REPLACE queries not working
- **What I did**: Switched to simple LIKE query to find matching phone, then use exact phone
- **Result**: Click "View Profile" now WORKS ✅

---

## 🔧 RAZORPAY TEST MODE SETUP - YOUR TASK

### File to Edit
```
c:\Users\shaki\Desktop\meetpe\.env
```

### Find These Lines (at bottom of file)
```
# Razorpay (Test Mode - for development)
RAZORPAY_KEY_ID=rzp_test_YOUR_TEST_KEY_HERE
RAZORPAY_KEY_SECRET=YOUR_TEST_SECRET_HERE
```

### Step 1: Get Keys from Razorpay
1. Go to https://dashboard.razorpay.com
2. Click Settings → API Keys
3. Copy **Key ID** (looks like: `rzp_test_1a2b3c4d5e6f7g8h`)
4. Copy **Key Secret** (long string of characters)

### Step 2: Paste in .env
Replace the placeholder values:

**BEFORE:**
```env
RAZORPAY_KEY_ID=rzp_test_YOUR_TEST_KEY_HERE
RAZORPAY_KEY_SECRET=YOUR_TEST_SECRET_HERE
```

**AFTER (example):**
```env
RAZORPAY_KEY_ID=rzp_test_1a2b3c4d5e6f7g8h
RAZORPAY_KEY_SECRET=sk_test_abcdefghijklmnopqrst
```

### Step 3: Restart Server
```bash
npm start
```

### Step 4: Test Payment
1. Open app
2. Go to Wallet → Add Money
3. Click "Pay Online"
4. Use test card: **4111 1111 1111 1111**
5. Any future date (12/25)
6. Any 3 digits (123)
7. Click pay → Should work ✅

---

## 📋 Deployment to Server

After completing Razorpay setup, deploy:

```bash
ssh wasim64malik@<YOUR_SERVER_IP> "cd ~/meetpe && git stash && git pull && pm2 restart meetpe"
```

Then update `.env` on server with same Razorpay keys.

---

## Summary

| Task | Status | What To Do |
|------|--------|-----------|
| User Profile Bug | ✅ FIXED | Nothing - already working |
| Razorpay Setup | ⏳ WAITING | Paste keys in `.env` then restart |

**Latest Commit**: `20a192a` - User profile fix deployed

That's it! 🚀
