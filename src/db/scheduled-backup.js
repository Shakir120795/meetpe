// Scheduled backup runner - to be called by cron or PM2
const { createBackup, exportToJSON, listBackups } = require('./backup');

console.log('🔄 Running scheduled backup...');
console.log('Time:', new Date().toISOString());

// Create database backup
const backupPath = createBackup();

if (backupPath) {
  console.log('✅ Backup created successfully');
  
  // Also create JSON export once a week (on Sundays)
  const today = new Date().getDay();
  if (today === 0) {
    console.log('📄 Creating weekly JSON export...');
    exportToJSON();
  }
  
  // List current backups
  const backups = listBackups();
  console.log(`📦 Total backups: ${backups.length}`);
  
  if (backups.length > 0) {
    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
    console.log(`💾 Total backup size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  }
} else {
  console.error('❌ Backup failed');
  process.exit(1);
}
