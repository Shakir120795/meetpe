/**
 * Migration Script: Add missing columns to customers table
 * 
 * This fixes the 500 Internal Server Error in verify-otp endpoint
 * 
 * Missing columns:
 * - updated_at: Tracks last login time
 * - referral_code: Unique code for each customer to share with friends
 * 
 * Run this ONCE on production after deployment:
 * node scripts/fix-customers-table.js
 */

const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './data/meatpe.db';
const db = new Database(dbPath);

console.log('🔧 Starting customers table migration...');

try {
  // Check current schema
  const columns = db.prepare('PRAGMA table_info(customers)').all();
  console.log('📋 Current columns:', columns.map(c => c.name).join(', '));
  
  const hasUpdatedAt = columns.some(c => c.name === 'updated_at');
  const hasReferralCode = columns.some(c => c.name === 'referral_code');
  
  // Add updated_at column if missing
  if (!hasUpdatedAt) {
    console.log('➕ Adding updated_at column...');
    // SQLite doesn't allow non-constant defaults in ALTER TABLE, so add without default
    db.exec(`
      ALTER TABLE customers 
      ADD COLUMN updated_at TEXT;
    `);
    
    // Set updated_at = created_at for existing rows
    db.exec(`
      UPDATE customers 
      SET updated_at = COALESCE(created_at, datetime('now'))
      WHERE updated_at IS NULL;
    `);
    
    console.log('✅ updated_at column added');
  } else {
    console.log('✓ updated_at column already exists');
  }
  
  // Add referral_code column if missing
  if (!hasReferralCode) {
    console.log('➕ Adding referral_code column...');
    db.exec(`
      ALTER TABLE customers 
      ADD COLUMN referral_code TEXT UNIQUE;
    `);
    
    // Generate referral codes for existing customers
    const customers = db.prepare('SELECT phone FROM customers WHERE referral_code IS NULL').all();
    console.log(`🔢 Generating referral codes for ${customers.length} existing customers...`);
    
    for (const customer of customers) {
      // Extract last 10 digits from phone
      const digits = customer.phone.replace(/\D/g, '').slice(-10);
      // Create referral code: MEET + last 4 digits
      const referralCode = `MEET${digits.slice(-4)}`;
      
      try {
        db.prepare('UPDATE customers SET referral_code = ? WHERE phone = ?')
          .run(referralCode, customer.phone);
      } catch (err) {
        console.warn(`⚠️ Could not set referral code for ${customer.phone}: ${err.message}`);
      }
    }
    
    console.log('✅ referral_code column added');
  } else {
    console.log('✓ referral_code column already exists');
  }
  
  // Verify final schema
  const finalColumns = db.prepare('PRAGMA table_info(customers)').all();
  console.log('📋 Final columns:', finalColumns.map(c => c.name).join(', '));
  
  console.log('\n✅ Migration completed successfully!');
  console.log('🔄 Now restart your app: pm2 restart meetpe');
  
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  console.error(error);
  process.exit(1);
} finally {
  db.close();
}
