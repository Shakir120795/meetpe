# 🚀 Deployment Instructions - Fix Login 500 Error

## What I Found 🔍

Your login was failing with **500 Internal Server Error** because the `customers` table was missing two columns:
1. `updated_at` - Line 898 in server.js tried to update this
2. `referral_code` - Line 877 in server.js tried to query this

When SQLite couldn't find these columns, it crashed the verify-otp endpoint.

---

## What I Fixed ✅

1. **Updated database schema** (`src/db/init.js`)
   - Added `updated_at` column
   - Added `referral_code` column (unique)

2. **Updated verify-otp endpoint** (`src/server.js`)
   - Auto-generates referral codes for new users (MEET#### format)
   - Example: Phone 8126812317 gets code MEET2317

3. **Created migration script** (`scripts/fix-customers-table.js`)
   - Adds missing columns to existing production database
   - Generates referral codes for existing customers

---

## 🔥 RUN THIS ON YOUR SERVER NOW 🔥

### Step 1: Code is Already Pushed ✅
```bash
# Already done - code is on GitHub
```

### Step 2: Run Migration on Production Server

**SSH into your production server and run:**

```bash
cd /path/to/meetpe

# Run the migration script
node scripts/fix-customers-table.js

# You should see:
# ➕ Adding updated_at column...
# ✅ updated_at column added
# ➕ Adding referral_code column...
# ✅ referral_code column added
# ✅ Migration completed successfully!
```

### Step 3: Restart PM2

```bash
pm2 restart meetpe
```

### Step 4: Test Login 🧪

Now test with your numbers:
- **8126812317**
- **8077372462**
- **7669080706**

**All should work now with OTP: 123456**

You can login/logout/login as many times as you want with the same number!

---

## Expected Output When Migration Runs 📋

```
🔧 Starting customers table migration...
📋 Current columns: phone, name, address, reward_cash, wallet_balance, is_plus, plus_until, referred_by, created_at
➕ Adding updated_at column...
✅ updated_at column added
➕ Adding referral_code column...
🔢 Generating referral codes for 3 existing customers...
✅ referral_code column added
📋 Final columns: phone, name, address, reward_cash, wallet_balance, is_plus, plus_until, referred_by, referral_code, created_at, updated_at

✅ Migration completed successfully!
🔄 Now restart your app: pm2 restart meetpe
```

---

## If You Still Get Errors 🚨

Send me the output of:

```bash
# 1. Check if migration worked
node scripts/fix-customers-table.js

# 2. Check PM2 logs
pm2 logs meetpe --lines 50

# 3. Try login and check what error shows
```

---

## Demo OTP Details 📱

- **OTP Code: 123456** (works for ANY phone number)
- **No rate limiting** in demo mode
- **Unlimited logins** with same number
- Works even after PM2 restart

Later when you buy MSG91 API:
- Just add `MSG91_AUTH_KEY=your_key` to `.env`
- Real OTPs will be sent automatically
- No code changes needed!

---

## Why This Happened 🤔

The referral system and login tracking were added to the code, but the database migration to add the columns was never run on production. This is a common issue when deploying with PM2 - schema changes need explicit migration scripts.

From now on, when adding new columns:
1. Update `src/db/init.js` schema
2. Create migration script in `scripts/`
3. Run migration on production before/after deployment

---

## Files Changed 📄

- ✅ `src/db/init.js` - Added columns to schema
- ✅ `src/server.js` - Generate referral codes for new users  
- ✅ `scripts/fix-customers-table.js` - **RUN THIS ON SERVER**
- ✅ `FIX_LOGIN_500_ERROR.md` - Detailed explanation
- ✅ `DEPLOY_INSTRUCTIONS.md` - This file

---

**After running the migration, your login should work perfectly! 🎉**
