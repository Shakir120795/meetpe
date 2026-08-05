// Migration: Add delivery zone and membership columns to customers table
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './data/meatpe.db';
const db = new Database(dbPath);

console.log('🔧 Starting delivery zone migration...');

try {
  // Get current columns
  const columns = db.pragma('table_info(customers)').map(c => c.name);
  console.log('📋 Current columns:', columns.join(', '));
  
  // Add delivery_zone column if not exists
  if (!columns.includes('delivery_zone')) {
    console.log('➕ Adding delivery_zone column...');
    db.exec(`ALTER TABLE customers ADD COLUMN delivery_zone TEXT DEFAULT 'zone_a'`);
    console.log('✅ delivery_zone column added');
  } else {
    console.log('ℹ️  delivery_zone column already exists');
  }
  
  // Add delivery_zone_distance column if not exists
  if (!columns.includes('delivery_zone_distance')) {
    console.log('➕ Adding delivery_zone_distance column...');
    db.exec(`ALTER TABLE customers ADD COLUMN delivery_zone_distance REAL DEFAULT 0`);
    console.log('✅ delivery_zone_distance column added');
  } else {
    console.log('ℹ️  delivery_zone_distance column already exists');
  }
  
  // Add membership_zone column if not exists
  if (!columns.includes('membership_zone')) {
    console.log('➕ Adding membership_zone column...');
    db.exec(`ALTER TABLE customers ADD COLUMN membership_zone TEXT`);
    console.log('✅ membership_zone column added');
  } else {
    console.log('ℹ️  membership_zone column already exists');
  }
  
  // Add membership_price column if not exists
  if (!columns.includes('membership_price')) {
    console.log('➕ Adding membership_price column...');
    db.exec(`ALTER TABLE customers ADD COLUMN membership_price INTEGER DEFAULT 0`);
    console.log('✅ membership_price column added');
  } else {
    console.log('ℹ️  membership_price column already exists');
  }
  
  // Add delivery_credits column if not exists
  if (!columns.includes('delivery_credits')) {
    console.log('➕ Adding delivery_credits column...');
    db.exec(`ALTER TABLE customers ADD COLUMN delivery_credits INTEGER DEFAULT 0`);
    console.log('✅ delivery_credits column added');
  } else {
    console.log('ℹ️  delivery_credits column already exists');
  }
  
  // Add membership_start column if not exists
  if (!columns.includes('membership_start')) {
    console.log('➕ Adding membership_start column...');
    db.exec(`ALTER TABLE customers ADD COLUMN membership_start TEXT`);
    console.log('✅ membership_start column added');
  } else {
    console.log('ℹ️  membership_start column already exists');
  }
  
  // Verify new columns
  const newColumns = db.pragma('table_info(customers)').map(c => c.name);
  console.log('✅ Migration complete! New columns:', newColumns.join(', '));
  
} catch (e) {
  console.error('❌ Migration failed:', e.message);
  process.exit(1);
}

db.close();
console.log('✅ Database closed');
