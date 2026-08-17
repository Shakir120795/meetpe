// SQLite init — creates tables if not exist
// SAFE MODE: Never drops tables or deletes data
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './data/meatpe.db';
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
db.pragma('synchronous = NORMAL'); // Balance between safety and performance
db.pragma('foreign_keys = ON'); // Enable foreign key constraints

// Import backup and migration utilities
const { createBackup } = require('./backup');
const { applyMigrations, verifyIntegrity } = require('./migrations');

// Create initial backup on startup (if not already done today)
const backupDir = path.join(dir, 'backups');
if (fs.existsSync(backupDir)) {
  const today = new Date().toISOString().split('T')[0];
  const todayBackups = fs.readdirSync(backupDir).filter(f => f.includes(today));
  if (todayBackups.length === 0) {
    console.log('📦 Creating daily backup...');
    createBackup();
  }
} else {
  console.log('📦 First-time backup...');
  createBackup();
}

// Create base tables (NEVER use DROP TABLE)
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    phone        TEXT PRIMARY KEY,
    name         TEXT,
    address      TEXT,
    reward_cash  INTEGER DEFAULT 0,
    wallet_balance INTEGER DEFAULT 0,
    is_plus      INTEGER DEFAULT 0,
    plus_until   TEXT,
    created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at   TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    phone        TEXT PRIMARY KEY,
    state        TEXT,
    cart_json    TEXT,
    updated_at   TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    phone          TEXT,
    items_json     TEXT,
    subtotal       INTEGER,
    delivery_fee   INTEGER,
    total          INTEGER,
    address        TEXT,
    status         TEXT DEFAULT 'placed',
    source         TEXT DEFAULT 'web',
    created_at     TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS saved_addresses (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    phone      TEXT NOT NULL,
    tag        TEXT DEFAULT 'Home',
    address    TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rewards (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    phone        TEXT,
    amount       INTEGER,
    expires_at   TEXT,
    used         INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id     INTEGER,
    phone        TEXT,
    item_code    TEXT,
    rating       INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment      TEXT,
    status       TEXT DEFAULT 'pending',
    created_at   TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rider_locations (
    order_id     INTEGER PRIMARY KEY,
    rider_name   TEXT,
    rider_phone  TEXT,
    latitude     REAL NOT NULL,
    longitude    REAL NOT NULL,
    accuracy     REAL,
    heading      REAL,
    speed        REAL,
    updated_at   TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );
`);

// Apply all safe migrations (adds missing columns)
applyMigrations(db);

// Verify database integrity
const integrity = verifyIntegrity(db);
if (!integrity.ok) {
  console.error('❌ DATABASE INTEGRITY CHECK FAILED!');
  console.error('Errors:', integrity.errors);
  process.exit(1);
}

console.log(`✅ DB ready at ${dbPath}`);
console.log(`📊 Stats: ${Object.keys(integrity.tables).length} tables verified`);

module.exports = db;
