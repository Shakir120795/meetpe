# Database Safety & Backup System

## 🛡️ DATA PROTECTION GUARANTEE

**RULE #1: Data NEVER gets deleted automatically**
- No DROP TABLE commands anywhere in code
- No TRUNCATE or DELETE FROM without WHERE clause
- All migrations only ADD columns, never remove
- Backups created before any schema changes

## 📦 Automatic Backup System

### How It Works
1. **Daily Backup**: First server start each day creates a backup
2. **Scheduled Backups**: Every 6 hours (configurable)
3. **Pre-Migration Backups**: Before any schema changes
4. **Retention**: Backups kept for 30 days, then auto-deleted

### Backup Location
```
data/backups/
├── meatpe-2026-08-17T08-30-00.db
├── meatpe-2026-08-17T14-30-00.db
└── export-1723890000000.json
```

## 🔄 Migration System

### Safe Migration Rules
- **ONLY ADD** columns/tables
- **NEVER DROP** or DELETE
- **ALWAYS BACKUP** before migrations
- **TRACK** applied migrations in database

### How to Add New Migration

Edit `src/db/migrations.js`:

```javascript
{
  name: '009_add_new_feature',
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

## 🚨 Recovery Procedures

### Restore from Backup

**Via Command Line:**
```bash
cd ~/meetpe
node -e "const {restoreBackup, listBackups} = require('./src/db/backup'); console.log(listBackups()); restoreBackup('meatpe-2026-08-17T08-30-00.db')"
```

**Via Admin Panel:**
1. Go to `/admin/database`
2. Click "View Backups"
3. Select backup and click "Restore"

### Export to JSON (Emergency)
```bash
node src/db/scheduled-backup.js
```

Creates JSON export with all data for manual recovery.

## 🔍 Integrity Checks

### Automatic Checks
- Run on every server start
- Verify all tables exist
- Check for missing columns
- Validate row counts

### Manual Check
```bash
node -e "const db = require('./src/db/init'); const {verifyIntegrity} = require('./src/db/migrations'); console.log(verifyIntegrity(db))"
```

## ⚙️ Configuration

### Environment Variables

```env
# Database location
DB_PATH=./data/meatpe.db

# Backup settings (optional)
BACKUP_RETENTION_DAYS=30
BACKUP_INTERVAL_HOURS=6
```

### PM2 Backup Task (Optional)

Add to `ecosystem.config.js`:

```javascript
{
  name: 'meetpe-backup',
  script: 'src/db/scheduled-backup.js',
  cron_restart: '0 */6 * * *',  // Every 6 hours
  autorestart: false
}
```

## 📊 Monitoring

### Check Backup Status
```bash
ls -lah data/backups/ | tail -10
```

### Check Disk Usage
```bash
du -sh data/backups/
```

### Backup Logs
```bash
pm2 logs meetpe | grep -i backup
```

## 🔐 Best Practices

1. **Never edit database directly** - use admin panel or API
2. **Test backups regularly** - restore to test environment
3. **Monitor backup size** - ensure backups are completing
4. **Keep VPS backups** - snapshot entire server weekly
5. **Document schema changes** - add migration for every change

## 🆘 Emergency Contacts

If data loss occurs:
1. **STOP** the server immediately: `pm2 stop meetpe`
2. Check latest backup: `ls -lt data/backups/ | head -5`
3. Restore backup (see above)
4. Verify data: Check admin panel → Users/Orders
5. Restart server: `pm2 restart meetpe`

## ✅ System Guarantees

- ✅ **No auto-deletion** of user data
- ✅ **Backup before** schema changes
- ✅ **30-day retention** of backups
- ✅ **Integrity checks** on startup
- ✅ **Migration tracking** in database
- ✅ **JSON export** for emergency recovery

---

**Last Updated:** August 2026  
**System Version:** 2.0 (Data-Safe)
