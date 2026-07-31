// Per-customer chat session + cart, persisted in SQLite
const db = require('../db/init');

function getSession(phone) {
  const row = db.prepare('SELECT * FROM sessions WHERE phone = ?').get(phone);
  if (!row) {
    return { phone, state: 'new', cart: [] };
  }
  return {
    phone,
    state: row.state || 'new',
    cart: row.cart_json ? JSON.parse(row.cart_json) : [],
  };
}

function saveSession(phone, state, cart) {
  const stmt = db.prepare(`
    INSERT INTO sessions (phone, state, cart_json, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(phone) DO UPDATE SET
      state = excluded.state,
      cart_json = excluded.cart_json,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(phone, state, JSON.stringify(cart || []));
}

function clearSession(phone) {
  db.prepare('DELETE FROM sessions WHERE phone = ?').run(phone);
}

function upsertCustomer(phone, fields = {}) {
  const existing = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone);
  if (!existing) {
    db.prepare('INSERT INTO customers (phone, name, address) VALUES (?, ?, ?)')
      .run(phone, fields.name || null, fields.address || null);
    return;
  }
  if (fields.name)    db.prepare('UPDATE customers SET name = ? WHERE phone = ?').run(fields.name, phone);
  if (fields.address) db.prepare('UPDATE customers SET address = ? WHERE phone = ?').run(fields.address, phone);
}

function getCustomer(phone) {
  return db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone);
}

module.exports = { getSession, saveSession, clearSession, upsertCustomer, getCustomer };
