// SQLite init — creates tables if not exist
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './data/meatpe.db';
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    phone        TEXT PRIMARY KEY,
    name         TEXT,
    address      TEXT,
    reward_cash  INTEGER DEFAULT 0,
    wallet_balance INTEGER DEFAULT 0,
    is_plus      INTEGER DEFAULT 0,
    plus_until   TEXT,
    referred_by  TEXT,
    referral_code TEXT,
    created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at   TEXT DEFAULT CURRENT_TIMESTAMP,
    delivery_zone TEXT DEFAULT 'zone_a',
    delivery_zone_distance REAL DEFAULT 0,
    membership_zone TEXT,
    membership_price INTEGER DEFAULT 0,
    delivery_credits INTEGER DEFAULT 0,
    membership_start TEXT
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
    payment_method TEXT DEFAULT 'cod',
    delivery_slot  TEXT DEFAULT 'asap',
    notes          TEXT DEFAULT '',
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

// Safe column migrations for existing databases
try {
  db.exec(`ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cod'`);
} catch(e) {}
try {
  db.exec(`ALTER TABLE orders ADD COLUMN delivery_slot TEXT DEFAULT 'asap'`);
} catch(e) {}
try {
  db.exec(`ALTER TABLE orders ADD COLUMN notes TEXT DEFAULT ''`);
} catch(e) {}
try {
  db.exec(`ALTER TABLE customers ADD COLUMN is_blocked INTEGER DEFAULT 0`);
} catch(e) {}

console.log(`✅ DB ready at ${dbPath}`);
module.exports = db;
