// Database Permissions Checker & Fixer
// Ensures proper file permissions on database files

const fs = require('fs');
const path = require('path');

/**
 * Check and fix database file permissions
 * SQLite requires proper file permissions for security
 */
function checkAndFixPermissions() {
  const dbPath = path.join(__dirname, '..', '..', 'data', 'meatpe.db');
  const backupDir = path.join(__dirname, '..', '..', 'data', 'backups');
  
  const results = {
    ok: true,
    checks: [],
    fixes: [],
    errors: []
  };
  
  try {
    // Check if database file exists
    if (!fs.existsSync(dbPath)) {
      results.errors.push('Database file not found: ' + dbPath);
      results.ok = false;
      return results;
    }
    
    // Get current permissions
    const stats = fs.statSync(dbPath);
    const mode = (stats.mode & parseInt('777', 8)).toString(8);
    
    results.checks.push(`Database file permissions: ${mode}`);
    
    // Check if permissions are too open (should be 600 or 640)
    const idealMode = '600'; // Owner read/write only
    
    if (mode !== idealMode && mode !== '640') {
      results.checks.push(`⚠️ Permissions ${mode} are not ideal (should be ${idealMode})`);
      
      // On Windows, file permissions work differently
      if (process.platform === 'win32') {
        results.checks.push('ℹ️ Running on Windows - file permissions managed by NTFS');
      } else {
        // On Unix-like systems, fix permissions
        try {
          fs.chmodSync(dbPath, 0o600);
          results.fixes.push(`✅ Set database permissions to ${idealMode}`);
        } catch (e) {
          results.errors.push(`Failed to set permissions: ${e.message}`);
          results.ok = false;
        }
      }
    } else {
      results.checks.push(`✅ Database permissions are secure (${mode})`);
    }
    
    // Check backup directory exists and is writable
    if (fs.existsSync(backupDir)) {
      const backupStats = fs.statSync(backupDir);
      if (backupStats.isDirectory()) {
        results.checks.push('✅ Backup directory exists');
        
        // Check write access
        try {
          fs.accessSync(backupDir, fs.constants.W_OK);
          results.checks.push('✅ Backup directory is writable');
        } catch (e) {
          results.errors.push('⚠️ Backup directory is not writable');
          results.ok = false;
        }
      } else {
        results.errors.push('⚠️ Backup path exists but is not a directory');
        results.ok = false;
      }
    } else {
      // Create backup directory
      try {
        fs.mkdirSync(backupDir, { recursive: true, mode: 0o750 });
        results.fixes.push('✅ Created backup directory');
      } catch (e) {
        results.errors.push(`Failed to create backup directory: ${e.message}`);
        results.ok = false;
      }
    }
    
    // Check WAL and SHM files (SQLite write-ahead log)
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    
    if (fs.existsSync(walPath)) {
      results.checks.push('✅ WAL file exists (normal for active database)');
    }
    
    if (fs.existsSync(shmPath)) {
      results.checks.push('✅ SHM file exists (normal for active database)');
    }
    
  } catch (e) {
    results.errors.push(`Permission check failed: ${e.message}`);
    results.ok = false;
  }
  
  return results;
}

/**
 * Print permission check results
 */
function printResults(results) {
  console.log('\n🔐 Database Permissions Check:');
  console.log('================================');
  
  if (results.checks.length > 0) {
    console.log('\n📋 Checks:');
    results.checks.forEach(check => console.log('  ' + check));
  }
  
  if (results.fixes.length > 0) {
    console.log('\n🔧 Fixes Applied:');
    results.fixes.forEach(fix => console.log('  ' + fix));
  }
  
  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.forEach(error => console.log('  ' + error));
  }
  
  if (results.ok) {
    console.log('\n✅ Database permissions are secure\n');
  } else {
    console.log('\n⚠️ Some permission issues found\n');
  }
}

/**
 * Initialize and run permission checks on startup
 */
function initPermissionCheck() {
  const results = checkAndFixPermissions();
  printResults(results);
  return results.ok;
}

module.exports = {
  checkAndFixPermissions,
  printResults,
  initPermissionCheck
};
