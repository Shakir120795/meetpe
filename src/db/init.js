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
    created_at   TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    phone        TEXT PRIMARY KEY,
    state        TEXT,
    cart_json    TEXT,
    updated_at   TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    phone        TEXT,
    items_json   TEXT,
    subtotal     INTEGER,
    delivery_fee INTEGER,
    total        INTEGER,
    address      TEXT,
    status       TEXT DEFAULT 'placed',
    source       TEXT DEFAULT 'web',
    created_at   TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rewards (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    phone        TEXT,
    amount       INTEGER,
    expires_at   TEXT,
    used         INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

console.log(`✅ DB ready at ${dbPath}`);
module.exports = db;
