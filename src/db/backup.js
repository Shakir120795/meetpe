// Automatic database backup system
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || './data/meatpe.db';
const backupDir = path.join(path.dirname(dbPath), 'backups');

// Ensure backup directory exists
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

/**
 * Create a timestamped backup of the database
 * @returns {string} Path to backup file
 */
function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const backupPath = path.join(backupDir, `meatpe-${timestamp}.db`);
    
    // Copy main database file
    fs.copyFileSync(dbPath, backupPath);
    
    // Also copy WAL file if exists
    const walPath = `${dbPath}-wal`;
    if (fs.existsSync(walPath)) {
      fs.copyFileSync(walPath, `${backupPath}-wal`);
    }
    
    console.log(`✅ Database backup created: ${backupPath}`);
    
    // Clean old backups (keep last 30 days)
    cleanOldBackups();
    
    return backupPath;
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    return null;
  }
}

/**
 * Delete backups older than 30 days
 */
function cleanOldBackups() {
  try {
    const files = fs.readdirSync(backupDir);
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    
    let deletedCount = 0;
    files.forEach(file => {
      if (file.startsWith('meatpe-') && file.endsWith('.db')) {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        
        // Only delete if truly old (not just created in last hour)
        if (stats.mtimeMs < thirtyDaysAgo) {
          fs.unlinkSync(filePath);
          // Also delete WAL file if exists
          const walFile = `${filePath}-wal`;
          if (fs.existsSync(walFile)) {
            fs.unlinkSync(walFile);
          }
          console.log(`🗑️  Deleted old backup: ${file}`);
          deletedCount++;
        }
      }
    });
    
    if (deletedCount > 0) {
      console.log(`✅ Cleaned up ${deletedCount} old backups`);
    }
  } catch (error) {
    console.warn('⚠️  Backup cleanup warning:', error.message);
  }
}

/**
 * List all available backups
 * @returns {Array} List of backup files with metadata
 */
function listBackups() {
  try {
    const files = fs.readdirSync(backupDir);
    const backups = files
      .filter(file => file.startsWith('meatpe-') && file.endsWith('.db'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          path: filePath,
          size: stats.size,
          created: stats.mtime,
        };
      })
      .sort((a, b) => b.created - a.created);
    
    return backups;
  } catch (error) {
    console.error('❌ Failed to list backups:', error.message);
    return [];
  }
}

/**
 * Restore database from a backup
 * @param {string} backupFile - Backup filename or full path
 * @returns {boolean} Success status
 */
function restoreBackup(backupFile) {
  try {
    const backupPath = backupFile.includes(path.sep) 
      ? backupFile 
      : path.join(backupDir, backupFile);
    
    if (!fs.existsSync(backupPath)) {
      console.error('❌ Backup file not found:', backupPath);
      return false;
    }
    
    // Create a backup of current database before restoring
    const currentBackup = path.join(backupDir, `before-restore-${Date.now()}.db`);
    fs.copyFileSync(dbPath, currentBackup);
    
    // Restore from backup
    fs.copyFileSync(backupPath, dbPath);
    
    // Restore WAL file if exists
    const walBackup = `${backupPath}-wal`;
    if (fs.existsSync(walBackup)) {
      fs.copyFileSync(walBackup, `${dbPath}-wal`);
    }
    
    console.log(`✅ Database restored from: ${backupPath}`);
    console.log(`📦 Previous state saved to: ${currentBackup}`);
    
    return true;
  } catch (error) {
    console.error('❌ Restore failed:', error.message);
    return false;
  }
}

/**
 * Export data to JSON for emergency recovery
 * @returns {Object} Exported data
 */
function exportToJSON() {
  try {
    const db = new Database(dbPath, { readonly: true });
    
    const data = {
      exported_at: new Date().toISOString(),
      customers: db.prepare('SELECT * FROM customers').all(),
      orders: db.prepare('SELECT * FROM orders').all(),
      saved_addresses: db.prepare('SELECT * FROM saved_addresses').all(),
      reviews: db.prepare('SELECT * FROM reviews').all(),
      rewards: db.prepare('SELECT * FROM rewards').all(),
    };
    
    db.close();
    
    const jsonPath = path.join(backupDir, `export-${Date.now()}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
    
    console.log(`✅ Data exported to JSON: ${jsonPath}`);
    return data;
  } catch (error) {
    console.error('❌ JSON export failed:', error.message);
    return null;
  }
}

module.exports = {
  createBackup,
  cleanOldBackups,
  listBackups,
  restoreBackup,
  exportToJSON,
};
