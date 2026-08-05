# 🚨 FIX: Login 500 Internal Server Error

## Problem Identified ✅

The **customers table was missing two critical columns**:
1. `updated_at` - Tracks last login time
2. `referral_code` - Unique referral code for each customer

When verify-otp endpoint tried to UPDATE or SELECT these columns, SQLite threw an error causing **500 Internal Server Error**.

---

## Solution: Run Migration Script 🔧

### Step 1: Push Code to Git

The fix has been applied to:
- `src/db/init.js` - Updated schema for new installs
- `src/server.js` - Generate referral codes for new users
- `scripts/fix-customers-table.js` - **Migration script (RUN THIS ON SERVER)**

```bash
git add .
git commit -m "Fix: Add missing columns to customers table (updated_at, referral_code)"
git push
```

### Step 2: Run on Production Server

After git push triggers deployment, SSH into your production server and run:

```bash
cd /path/to/meetpe
node scripts/fix-customers-table.js
```

**This will:**
- Add `updated_at` column (defaults to created_at for existing users)
- Add `referral_code` column (generates MEET#### codes for existing users)
- Show before/after schema for verification

### Step 3: Restart PM2

```bash
pm2 restart meetpe
```

### Step 4: Test Login

Now test with your phone numbers:
- 8126812317
- 8077372462
- 7669080706

**Expected behavior:**
1. Send OTP → Returns 200 OK
2. Verify with 123456 → Returns 200 OK with customer data
3. Logout and repeat → Should work UNLIMITED times

---

## What Was Fixed? 🛠️

### Before (Broken):
```sql
CREATE TABLE customers (
  phone TEXT PRIMARY KEY,
  name TEXT,
  address TEXT,
  reward_cash INTEGER,
  wallet_balance INTEGER,
  is_plus INTEGER,
  plus_until TEXT,
  referred_by TEXT,  
  created_at TEXT
  -- ❌ Missing: updated_at
  -- ❌ Missing: referral_code
);
```

### After (Fixed):
```sql
CREATE TABLE customers (
  phone TEXT PRIMARY KEY,
  name TEXT,
  address TEXT,
  reward_cash INTEGER,
  wallet_balance INTEGER,
  is_plus INTEGER,
  plus_until TEXT,
  referred_by TEXT,
  referral_code TEXT UNIQUE,    -- ✅ Added
  created_at TEXT,
  updated_at TEXT               -- ✅ Added
);
```

---

## Why Did This Happen? 🤔

The verify-otp endpoint code was trying to:

```javascript
// Line 898: Update last login timestamp
db.prepare(`UPDATE customers SET updated_at = datetime('now') WHERE phone = ?`).run(waPhone);
//                                 ^^^^^^^^^^
//                                 Column didn't exist!

// Line 877: Check referral code
const referrer = db.prepare('SELECT phone FROM customers WHERE referral_code = ?').get(referralCode);
//                                                               ^^^^^^^^^^^^^
//                                                               Column didn't exist!
```

When SQLite tried to access non-existent columns, it threw an error which crashed the endpoint with **500 Internal Server Error**.

---

## Demo OTP Still Works ✅

The fix maintains demo OTP functionality:
- **OTP: 123456** (works for ANY phone number)
- No rate limiting in demo mode
- Same phone can login UNLIMITED times
- Sessions clear on server restart (expected behavior until Redis is added)

---

## Next Steps After Fix 📋

Once login is working:
1. ✅ Test with all three phone numbers
2. ✅ Verify logout/re-login works
3. ✅ Check that referral codes are generated (check database)
4. Later: Add Redis for persistent sessions across PM2 restarts
5. Later: Configure real MSG91 API key for production OTPs

---

## Verification Commands 🔍

Check if migration worked:

```bash
# Connect to SQLite
sqlite3 data/meatpe.db

# Check schema
.schema customers

# Should show updated_at and referral_code columns
```

Check customer data:

```sql
SELECT phone, referral_code, created_at, updated_at 
FROM customers 
LIMIT 5;
```

---

## Troubleshooting 🚑

### If migration script fails:

**Error: "Column already exists"**
- Safe to ignore - means migration already ran

**Error: "Database is locked"**
- Stop PM2: `pm2 stop meetpe`
- Run migration
- Start PM2: `pm2 start meetpe`

**Error: "Cannot find module 'better-sqlite3'"**
- Install dependencies: `npm install`

### If login still fails after migration:

1. Check PM2 logs:
```bash
pm2 logs meetpe --lines 100
```

2. Look for the detailed logs added:
- `📞 [VERIFY-OTP] Request for phone: ...`
- `🔐 [VERIFY-OTP] Calling authService.verifyOTP...`
- `📦 [VERIFY-OTP] Looking up customer: ...`

3. The exact error line will be visible in logs

---

## Contact 📞

If issues persist after running migration, send me:
1. Output of `node scripts/fix-customers-table.js`
2. Output of `pm2 logs meetpe --lines 50`
3. Which step is failing (send OTP or verify OTP?)
