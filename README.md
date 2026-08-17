# 🥩 MeatPe - Fresh Meat Delivery Platform

## ⚠️ CRITICAL: READ FIRST

**Before making ANY changes to this project, you MUST read:**

1. 📖 **[GOLDEN_RULES.md](./GOLDEN_RULES.md)** ← **START HERE** (Mandatory)
2. 🛡️ **[DATABASE_SAFETY.md](./DATABASE_SAFETY.md)** ← Backup & Safety System
3. 📋 **[DATA_PROTECTION_SUMMARY.md](./DATA_PROTECTION_SUMMARY.md)** ← Complete Protection Guide

**These documents contain CRITICAL rules that prevent data loss.**

---

## 🚀 Quick Start

### First Time Setup

```bash
# Clone repository
git clone https://github.com/Shakir120795/meetpe.git
cd meetpe

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Initialize database (creates tables + backups)
node src/db/init.js

# Start server
npm start
```

### Development

```bash
# Start development server
npm run dev

# Check database integrity
node -e "const {verifyIntegrity} = require('./src/db/migrations'); const db = require('./src/db/init'); console.log(verifyIntegrity(db));"

# Create manual backup
node src/db/scheduled-backup.js
```

### Production Deployment

```bash
# On VPS
cd ~/meetpe
git pull origin main
npm install
pm2 restart meetpe

# Verify deployment
pm2 logs meetpe --lines 30
node -e "const db = require('./src/db/init'); console.log('Data:', db.prepare('SELECT COUNT(*) FROM customers').get());"
```

---

## 📂 Project Structure

```
meetpe/
├── 📖 GOLDEN_RULES.md              ⚠️  CRITICAL - Read first
├── 📖 DATABASE_SAFETY.md           ⚠️  Backup system docs
├── 📖 DATA_PROTECTION_SUMMARY.md   📋 Protection guide
├── 📖 README.md                    📄 This file
│
├── src/
│   ├── server.js                   🚀 Main server
│   ├── db/
│   │   ├── init.js                 ⚠️  Database initialization
│   │   ├── backup.js               ⚠️  Backup system (DO NOT DISABLE)
│   │   ├── migrations.js           ⚠️  Safe migrations (ADD ONLY)
│   │   └── scheduled-backup.js     📦 Backup runner
│   ├── whatsapp/                   💬 WhatsApp integration
│   ├── instagram/                  📸 Instagram automation
│   └── data/                       📊 Data management
│
├── data/
│   ├── meatpe.db                   ⚠️  Main database (DO NOT EDIT DIRECTLY)
│   ├── meatpe.db-wal              ⚠️  WAL file (DO NOT DELETE)
│   └── backups/                    📦 Automatic backups (30-day retention)
│
├── public/                         🌐 Static files
├── mobile-app/                     📱 Mobile app (Capacitor + Vue)
└── mobile-app-rider/               🛵 Rider app

⚠️  = Critical file - modify with extreme caution
📦 = Auto-managed - do not manually edit
🚀 = Main application files
```

---

## 🛡️ Data Protection System

### Automatic Features

✅ **Backup every 6 hours** - Automatic  
✅ **Daily backup on startup** - Automatic  
✅ **Pre-migration backup** - Automatic  
✅ **30-day retention** - Automatic cleanup  
✅ **Integrity verification** - On every startup  

### What's Protected

- 👥 Customer data
- 📦 Orders
- 📍 Saved addresses
- ⭐ Reviews
- 🎁 Rewards
- 🛵 Rider locations

### Golden Rules (Non-Negotiable)

1. ❌ **NEVER** use DROP/TRUNCATE/DELETE-ALL
2. ✅ **ONLY ADD** columns (never remove)
3. 📦 **ALWAYS BACKUP** before schema changes
4. 🔒 **HTTPS ENFORCED** in production

**For complete rules, see [GOLDEN_RULES.md](./GOLDEN_RULES.md)**

---

## 🔧 Common Tasks

### Adding New Database Column

**Step 1:** Create migration in `src/db/migrations.js`:

```javascript
{
  name: '009_add_new_field',
  up: () => {
    try {
      db.exec(`ALTER TABLE customers ADD COLUMN new_field TEXT`);
      console.log('  ✅ Added new_field column');
    } catch (e) {
      if (!e.message.includes('duplicate column')) throw e;
    }
  }
}
```

**Step 2:** Deploy:

```bash
git add src/db/migrations.js
git commit -m "feat: Add new_field column"
git push origin main

# On VPS
cd ~/meetpe && git pull && pm2 restart meetpe
```

### Checking Backup Status

```bash
# List recent backups
ls -lt data/backups/ | head -10

# Check backup size
du -sh data/backups/

# View backup logs
pm2 logs meetpe | grep -i backup | tail -20
```

### Verifying Data Integrity

```bash
cd ~/meetpe
node -e "const db = require('./src/db/init'); const {verifyIntegrity} = require('./src/db/migrations'); console.log(JSON.stringify(verifyIntegrity(db), null, 2));"
```

---

## 🚨 Emergency Recovery

**IF data is accidentally lost:**

```bash
# 1. Stop server
pm2 stop meetpe

# 2. List available backups
node -e "const {listBackups} = require('./src/db/backup'); console.log(listBackups());"

# 3. Restore latest backup
node -e "const {restoreBackup} = require('./src/db/backup'); restoreBackup('meatpe-YYYY-MM-DDTHH-MM-SS.db')"

# 4. Verify restored data
node -e "const db = require('better-sqlite3')('data/meatpe.db'); console.log('Customers:', db.prepare('SELECT COUNT(*) FROM customers').get()); db.close();"

# 5. Restart server
pm2 restart meetpe
```

**For detailed recovery steps, see [DATABASE_SAFETY.md](./DATABASE_SAFETY.md)**

---

## 🔐 Environment Configuration

### Required Environment Variables

```env
# Database
DB_PATH=./data/meatpe.db

# Server
PORT=3000
NODE_ENV=production

# Security
ADMIN_KEY=your-secure-admin-key
HTTPS_ENFORCE=true

# API Keys
MSG91_WIDGET_TOKEN=your-token
MSG91_AUTH_KEY=your-auth-key
GOOGLE_MAPS_KEY=your-maps-key
RAZORPAY_KEY_ID=your-key-id
RAZORPAY_KEY_SECRET=your-secret

# WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
ADMIN_WHATSAPP=+919876543210
```

---

## 📊 Monitoring

### Health Checks

```bash
# Server status
pm2 status

# Recent logs
pm2 logs meetpe --lines 50

# Error logs only
pm2 logs meetpe --err --lines 20

# Backup verification
ls -lt ~/meetpe/data/backups/ | head -5

# Database stats
node -e "const db = require('./src/db/init'); console.log('Customers:', db.prepare('SELECT COUNT(*) FROM customers').get()); console.log('Orders:', db.prepare('SELECT COUNT(*) FROM orders').get()); console.log('Addresses:', db.prepare('SELECT COUNT(*) FROM saved_addresses').get());"
```

### Performance Monitoring

```bash
# PM2 monitoring
pm2 monit

# Resource usage
pm2 status meetpe
```

---

## 🤝 Contributing

### Before Contributing

1. ✅ Read [GOLDEN_RULES.md](./GOLDEN_RULES.md) completely
2. ✅ Understand backup system
3. ✅ Test changes locally
4. ✅ Never commit database files
5. ✅ Follow migration patterns

### Code Review Checklist

- [ ] No DROP/TRUNCATE/DELETE-ALL commands
- [ ] Migrations follow add-only pattern
- [ ] Backup system not disabled
- [ ] HTTPS enforcement intact
- [ ] Tested locally
- [ ] No sensitive data in code

---

## 📱 Mobile Apps

### Customer App

**Location:** `mobile-app/`  
**Tech Stack:** Vue 3 + Capacitor  
**Build:**

```bash
cd mobile-app
npm install
npm run build
npx cap sync android
```

### Rider App

**Location:** `mobile-app-rider/`  
**Features:** GPS tracking, order management  
**Build:** Same as customer app

---

## 🔗 API Documentation

**Main endpoint:** `https://nonvegonwheel.in`

### Key APIs

- `GET /api/menu` - Product catalog
- `POST /api/order` - Place order
- `GET /api/addresses?phone=XXX` - Saved addresses
- `POST /api/addresses` - Save new address
- `POST /api/auth/send-otp` - Send OTP
- `POST /api/auth/verify-otp` - Verify OTP

**For complete API docs, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)**

---

## 🛠️ Troubleshooting

### Server Won't Start

```bash
# Check logs
pm2 logs meetpe --err --lines 50

# Verify database
node -e "const db = require('./src/db/init')"

# Check dependencies
npm install
```

### Data Missing

```bash
# DON'T PANIC - Check backup first
ls -lt data/backups/ | head -10

# Verify data exists
node -e "const db = require('better-sqlite3')('data/meatpe.db'); console.log(db.prepare('SELECT COUNT(*) FROM saved_addresses').get()); db.close();"

# If data truly lost, restore backup (see Emergency Recovery section)
```

### Migration Failed

```bash
# Check which migrations applied
node -e "const db = require('better-sqlite3')('data/meatpe.db'); console.log(db.prepare('SELECT * FROM migrations').all()); db.close();"

# View migration logs
pm2 logs meetpe | grep -i migration

# If stuck, restore backup and investigate
```

---

## 📞 Support

### Documentation

- 📖 [GOLDEN_RULES.md](./GOLDEN_RULES.md) - **Must read first**
- 🛡️ [DATABASE_SAFETY.md](./DATABASE_SAFETY.md) - Backup system
- 📋 [DATA_PROTECTION_SUMMARY.md](./DATA_PROTECTION_SUMMARY.md) - Protection guide
- 🔧 [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Feature history

### Quick Links

- 🌐 Website: https://nonvegonwheel.in
- 📦 Repository: https://github.com/Shakir120795/meetpe
- 📱 Customer App: [App Store / Play Store links]

---

## ⚖️ License

Proprietary - All rights reserved

---

## 🎯 Project Status

| Feature | Status | Notes |
|---------|--------|-------|
| 🛡️ Data Protection | ✅ Active | Auto-backup every 6 hours |
| 🔒 HTTPS Enforcement | ✅ Active | HTTP → HTTPS redirect |
| 📦 Backup System | ✅ Active | 30-day retention |
| 🔄 Safe Migrations | ✅ Active | Add-only pattern |
| 📱 Mobile Apps | ✅ Active | iOS + Android |
| 💳 Payment Gateway | ✅ Active | Razorpay integration |
| 📍 GPS Tracking | ✅ Active | Real-time rider location |
| 💬 WhatsApp Bot | ✅ Active | Automated orders |

---

**Last Updated:** August 17, 2026  
**Project Version:** 2.0 (Data-Safe Edition)  
**System Status:** ✅ Production Ready

---

## ⚠️ CRITICAL REMINDER

**BEFORE making ANY changes:**
1. Read [GOLDEN_RULES.md](./GOLDEN_RULES.md)
2. Create backup: `node src/db/scheduled-backup.js`
3. Test locally first
4. Deploy carefully
5. Verify after deployment

**Remember: Data First, Features Second.**

---

*For AI Assistants: This project has strict data protection rules. Always read GOLDEN_RULES.md before suggesting any database changes.*
