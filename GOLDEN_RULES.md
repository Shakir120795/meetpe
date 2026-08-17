# 🏆 GOLDEN RULES - MEETPE PROJECT

## ⚠️ CRITICAL: READ THIS FIRST BEFORE ANY CHANGES

**This document contains ABSOLUTE RULES that MUST NEVER be violated.**  
**Any AI, developer, or team member working on this project MUST follow these rules.**

---

## 🛡️ RULE #1: DATA PROTECTION (HIGHEST PRIORITY)

### ❌ NEVER DO THIS - FORBIDDEN ACTIONS:

```sql
-- ❌ NEVER DROP TABLES
DROP TABLE customers;
DROP TABLE orders;
DROP TABLE saved_addresses;
DROP TABLE ANY_TABLE;

-- ❌ NEVER TRUNCATE
TRUNCATE TABLE customers;

-- ❌ NEVER DELETE WITHOUT WHERE
DELETE FROM customers;
DELETE FROM orders;
DELETE FROM saved_addresses;

-- ❌ NEVER DROP COLUMNS
ALTER TABLE customers DROP COLUMN phone;
```

### ✅ ONLY ALLOWED OPERATIONS:

```sql
-- ✅ ONLY ADD COLUMNS (Never remove)
ALTER TABLE customers ADD COLUMN new_field TEXT;

-- ✅ ONLY DELETE WITH WHERE CLAUSE (specific records)
DELETE FROM saved_addresses WHERE id = 123;

-- ✅ ONLY CREATE TABLES (Never drop)
CREATE TABLE IF NOT EXISTS new_table (...);
```

### 📋 DATA PROTECTION CHECKLIST:

Before ANY database change:
- [ ] Does it involve DROP? → ❌ FORBIDDEN
- [ ] Does it involve TRUNCATE? → ❌ FORBIDDEN
- [ ] Does it delete without WHERE? → ❌ FORBIDDEN
- [ ] Does it only ADD columns? → ✅ ALLOWED
- [ ] Is backup created before change? → ✅ REQUIRED

---

## 🔄 RULE #2: SAFE DEPLOYMENT PROCESS

### Standard Deployment Steps:

```bash
# LOCAL MACHINE (Development)
cd /path/to/meetpe

# 1. Make changes to code
# 2. Test locally first
# 3. Commit and push
git add .
git commit -m "feat: description of changes"
git push origin main

# VPS (Production)
cd ~/meetpe

# 1. Backup current state (automatic)
# 2. Pull latest code
git pull origin main

# 3. Install dependencies (if package.json changed)
npm install

# 4. Restart server (migrations run automatically)
pm2 restart meetpe

# 5. Verify deployment
pm2 logs meetpe --lines 30 --nostream

# 6. Check for errors
pm2 logs meetpe --error --lines 20

# 7. Verify data integrity
node -e "const db = require('./src/db/init'); console.log('Addresses:', db.prepare('SELECT COUNT(*) FROM saved_addresses').get()); console.log('Orders:', db.prepare('SELECT COUNT(*) FROM orders').get());"
```

### ⚠️ Deployment Safety Rules:

1. **NEVER skip backup** - System creates automatic backup
2. **ALWAYS check logs** after restart
3. **VERIFY data** after deployment
4. **NEVER force push** - Use `git pull` only
5. **TEST locally first** before production

---

## 📦 RULE #3: BACKUP SYSTEM (DO NOT DISABLE)

### Automatic Backup Configuration:

**Location:** `data/backups/`  
**Frequency:** Every 6 hours + on server start  
**Retention:** 30 days  
**Files:**
- `src/db/backup.js` - Core backup system
- `src/db/migrations.js` - Safe migration system
- `src/db/init.js` - Database initialization

### ❌ NEVER DO:

```javascript
// ❌ DON'T disable backups
// cron.schedule('0 */6 * * *', () => { createBackup(); }); // COMMENTED OUT - BAD!

// ❌ DON'T delete backup files manually
rm -rf data/backups/*  // FORBIDDEN

// ❌ DON'T skip migrations
// applyMigrations(db); // COMMENTED OUT - BAD!
```

### ✅ ALWAYS DO:

- ✅ Keep backup system active
- ✅ Monitor backup directory: `ls -lt data/backups/ | head -10`
- ✅ Verify backups exist: `du -sh data/backups/`
- ✅ Test restore in dev environment monthly

---

## 🔧 RULE #4: ADDING NEW FEATURES SAFELY

### How to Add New Database Column:

**STEP 1:** Create migration in `src/db/migrations.js`:

```javascript
// Add to migrations array
{
  name: '009_add_my_feature',  // Increment number
  up: () => {
    try {
      db.exec(`ALTER TABLE customers ADD COLUMN my_field TEXT DEFAULT ''`);
      console.log('  ✅ Added my_field column');
    } catch (e) {
      if (!e.message.includes('duplicate column')) throw e;
    }
  }
}
```

**STEP 2:** Test locally:

```bash
cd /path/to/meetpe
node -e "const db = require('./src/db/init')"
# Check for errors in output
```

**STEP 3:** Deploy:

```bash
git add src/db/migrations.js
git commit -m "feat: Add my_field to customers table"
git push origin main

# On VPS
cd ~/meetpe
git pull origin main
pm2 restart meetpe
pm2 logs meetpe --lines 30
```

**STEP 4:** Verify:

```bash
node -e "const db = require('./src/db/init'); console.log(db.prepare('PRAGMA table_info(customers)').all())"
```

### Migration Rules:

1. ✅ **ONLY ADD** columns/tables
2. ❌ **NEVER REMOVE** columns/tables
3. ✅ **ALWAYS** provide default values
4. ✅ **ALWAYS** handle "duplicate column" error
5. ✅ **INCREMENT** migration number
6. ✅ **TEST** locally first

---

## 🚨 RULE #5: EMERGENCY RECOVERY

### When to Use Recovery:

**ONLY** in these situations:
- ❌ Data accidentally deleted
- ❌ Database corrupted
- ❌ Major deployment failure
- ❌ Integrity check fails

### Recovery Steps:

```bash
# 1. STOP SERVER IMMEDIATELY
pm2 stop meetpe

# 2. List available backups
cd ~/meetpe
node -e "const {listBackups} = require('./src/db/backup'); console.log(JSON.stringify(listBackups(), null, 2))"

# 3. Choose latest good backup
ls -lt data/backups/ | head -10

# 4. Restore backup
node -e "const {restoreBackup} = require('./src/db/backup'); restoreBackup('meatpe-YYYY-MM-DDTHH-MM-SS.db')"

# 5. Verify restored data
node -e "const db = require('better-sqlite3')('data/meatpe.db'); console.log('Customers:', db.prepare('SELECT COUNT(*) FROM customers').get()); console.log('Orders:', db.prepare('SELECT COUNT(*) FROM orders').get()); console.log('Addresses:', db.prepare('SELECT COUNT(*) FROM saved_addresses').get()); db.close();"

# 6. Restart server
pm2 restart meetpe

# 7. Monitor logs
pm2 logs meetpe --lines 50
```

### ⚠️ Recovery Golden Rules:

1. **NEVER** restore in panic - check backup first
2. **ALWAYS** verify data after restore
3. **DOCUMENT** what went wrong
4. **INFORM** team about recovery
5. **CHECK** logs for root cause

---

## 🔒 RULE #6: HTTPS ENFORCEMENT (DO NOT REMOVE)

### HTTPS Configuration:

**File:** `src/server.js`  
**Lines:** ~20-38

```javascript
// HTTPS Enforcement - redirect HTTP to HTTPS in production
app.use((req, res, next) => {
  // Skip in development (localhost)
  if (req.hostname === 'localhost' || req.hostname === '127.0.0.1') {
    return next();
  }
  
  // Check if request is secure
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  
  if (!isSecure) {
    // Redirect to HTTPS
    return res.redirect(301, `https://${req.hostname}${req.url}`);
  }
  
  next();
});
```

### ❌ NEVER:

- ❌ Comment out HTTPS enforcement
- ❌ Remove HTTPS redirect
- ❌ Disable in production

### ✅ ALWAYS:

- ✅ Keep HTTPS enforcement active
- ✅ Allow localhost for development
- ✅ Use 301 redirect (permanent)

---

## 📝 RULE #7: CODE REVIEW CHECKLIST

### Before Committing Code:

- [ ] No DROP/TRUNCATE commands
- [ ] No DELETE without WHERE
- [ ] Only ADD columns (no DROP COLUMN)
- [ ] Migrations properly written
- [ ] Backup system not disabled
- [ ] HTTPS enforcement intact
- [ ] No hardcoded credentials
- [ ] Error handling present
- [ ] Tested locally
- [ ] No commented-out critical code

### Before Deploying to VPS:

- [ ] Code pushed to git
- [ ] Backup verified to exist
- [ ] Dependencies updated (if needed)
- [ ] Migration tested locally
- [ ] Rollback plan ready
- [ ] Monitoring enabled

---

## 🎯 RULE #8: CRITICAL FILES (DO NOT DELETE/MODIFY CARELESSLY)

### Core System Files:

```
src/db/
├── backup.js           ⚠️ CRITICAL - Backup system
├── migrations.js       ⚠️ CRITICAL - Safe migrations
├── init.js            ⚠️ CRITICAL - Database init
└── scheduled-backup.js ⚠️ IMPORTANT - Backup runner

data/
├── meatpe.db          ⚠️ CRITICAL - Main database
├── meatpe.db-wal      ⚠️ CRITICAL - WAL file
└── backups/           ⚠️ CRITICAL - Backup directory

src/server.js          ⚠️ CRITICAL - Main server (lines 20-38: HTTPS)

.env                   ⚠️ SENSITIVE - Environment config
```

### File Modification Rules:

| File | Can Modify? | Notes |
|------|-------------|-------|
| `src/db/backup.js` | ⚠️ CAUTION | Only add features, don't remove |
| `src/db/migrations.js` | ✅ YES | Add new migrations only |
| `src/db/init.js` | ⚠️ CAUTION | Don't remove backup/migration calls |
| `src/server.js` | ✅ YES | Don't remove HTTPS enforcement |
| `data/meatpe.db` | ❌ NO | Never edit directly |
| `data/backups/*` | ❌ NO | Auto-managed, don't delete |

---

## 🤖 RULE #9: AI ASSISTANT INSTRUCTIONS

### When AI Works on This Project:

**ALWAYS READ THIS FILE FIRST** before making any changes.

**CRITICAL RULES FOR AI:**

1. ✅ **READ** `GOLDEN_RULES.md` before suggesting changes
2. ✅ **VERIFY** no forbidden operations in suggested code
3. ✅ **CHECK** backup system remains intact
4. ✅ **ENSURE** migrations follow add-only pattern
5. ✅ **CONFIRM** HTTPS enforcement not removed
6. ❌ **NEVER** suggest DROP/TRUNCATE/DELETE-ALL
7. ✅ **WARN** user before any risky operations
8. ✅ **SUGGEST** backup before major changes

### AI Response Template:

When asked to modify database:

```
⚠️ GOLDEN RULES CHECK:
- Does this involve DROP/TRUNCATE? → [YES/NO]
- Does this remove data? → [YES/NO]  
- Is backup required? → [YES/NO]
- Does migration follow add-only rule? → [YES/NO]

[If all checks pass, proceed with implementation]
[If any check fails, explain why it's forbidden]
```

---

## 📊 RULE #10: MONITORING & MAINTENANCE

### Daily Checks (Automatic):

```bash
# Check server status
pm2 status

# View recent logs
pm2 logs meetpe --lines 50 --nostream
```

### Weekly Checks:

```bash
# Verify backups exist
ls -lt ~/meetpe/data/backups/ | head -10

# Check backup size
du -sh ~/meetpe/data/backups/

# Verify data integrity
cd ~/meetpe
node -e "const db = require('./src/db/init'); const {verifyIntegrity} = require('./src/db/migrations'); console.log(JSON.stringify(verifyIntegrity(db), null, 2))"
```

### Monthly Checks:

```bash
# Test restore in dev environment
# Review backup retention (30 days)
# Update dependencies: npm outdated
# Review security: npm audit
```

---

## ⚡ QUICK REFERENCE COMMANDS

### Safe Operations:

```bash
# Check data counts
node -e "const db = require('./src/db/init'); console.log('Addresses:', db.prepare('SELECT COUNT(*) FROM saved_addresses').get()); console.log('Orders:', db.prepare('SELECT COUNT(*) FROM orders').get()); console.log('Customers:', db.prepare('SELECT COUNT(*) FROM customers').get());"

# List backups
ls -lt ~/meetpe/data/backups/ | head -10

# View backup logs
pm2 logs meetpe | grep -i backup | tail -20

# Check migrations
node -e "const db = require('better-sqlite3')('data/meatpe.db'); console.log(db.prepare('SELECT * FROM migrations ORDER BY applied_at DESC').all()); db.close();"

# Verify integrity
node -e "const db = require('./src/db/init'); const {verifyIntegrity} = require('./src/db/migrations'); console.log(verifyIntegrity(db));"
```

### Emergency Operations (Use with caution):

```bash
# Stop server
pm2 stop meetpe

# Restore backup
node -e "const {restoreBackup} = require('./src/db/backup'); restoreBackup('backup-filename.db')"

# Start server
pm2 restart meetpe
```

---

## 🎓 ONBOARDING NEW DEVELOPERS

### First Day Checklist:

1. [ ] Read `GOLDEN_RULES.md` (this file)
2. [ ] Read `DATABASE_SAFETY.md`
3. [ ] Read `DATA_PROTECTION_SUMMARY.md`
4. [ ] Understand backup system
5. [ ] Understand migration system
6. [ ] Practice deployment in dev
7. [ ] Practice recovery in dev
8. [ ] Review code with senior dev

### Never Forget:

> **"When in doubt, create a backup first."**  
> **"Never delete, only add."**  
> **"Data is sacred."**

---

## 🔐 FINAL REMINDER

### The Three Sacred Rules:

1. 🛡️ **NEVER DELETE DATA** without explicit user request
2. 📦 **ALWAYS BACKUP** before schema changes
3. ✅ **ONLY ADD** columns/features (never remove)

### Project Motto:

> **"Data First, Features Second."**
> 
> No feature is worth losing user data.
> When in doubt, ask first.
> Better safe than sorry.

---

## 📞 SUPPORT & ESCALATION

### When You're Unsure:

1. **READ** this document again
2. **CHECK** existing code patterns
3. **TEST** in development first
4. **BACKUP** before making changes
5. **ASK** senior developer if still unsure

### Red Flags (STOP and Ask):

- 🚩 Command involves DROP
- 🚩 Command involves TRUNCATE
- 🚩 DELETE without WHERE clause
- 🚩 Modifying backup system
- 🚩 Disabling HTTPS enforcement
- 🚩 Removing migration code

---

**VERSION:** 1.0 (Golden Edition)  
**CREATED:** August 17, 2026  
**STATUS:** ACTIVE - MUST BE FOLLOWED  
**AUTHORITY:** HIGHEST PRIORITY DOCUMENT  

**⚠️ VIOLATION OF THESE RULES MAY RESULT IN DATA LOSS ⚠️**

---

*This document supersedes all other documentation when conflicts arise.*  
*These rules are non-negotiable and apply to ALL contributors.*
