// Coupons — discount codes managed via /admin/coupons.
// Stored in /data/coupons.json (auto-seeded with sample codes).

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'coupons.json');

// Default sample coupons (active by default, demo)
const defaults = [
  {
    code: 'WELCOME50',
    type: 'flat',           // 'flat' (₹) or 'percent' (%)
    value: 50,
    minOrder: 299,
    maxDiscount: null,
    description: 'First order — flat ₹50 off (min ₹299)',
    active: true,
    expiresAt: null,        // ISO date string or null
  },
  {
    code: 'MEATPE10',
    type: 'percent',
    value: 10,
    minOrder: 499,
    maxDiscount: 100,       // cap at ₹100
    description: '10% off, max ₹100 (min ₹499)',
    active: true,
    expiresAt: null,
  },
  {
    code: 'FRESH20',
    type: 'percent',
    value: 20,
    minOrder: 999,
    maxDiscount: 250,
    description: '20% off, max ₹250 (min ₹999)',
    active: true,
    expiresAt: null,
  },
];

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function read() {
  ensureDir();
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify(defaults, null, 2));
    return defaults.slice();
  }
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(data) ? data : defaults.slice();
  } catch (e) {
    console.warn('coupons.json read failed:', e.message);
    return defaults.slice();
  }
}
function write(items) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(items, null, 2));
}

function listAll() {
  return read();
}

function listActive() {
  const now = new Date();
  return read().filter(c => c.active && (!c.expiresAt || new Date(c.expiresAt) > now));
}

function findCoupon(code) {
  if (!code) return null;
  const norm = String(code).trim().toUpperCase();
  return read().find(c => c.code.toUpperCase() === norm) || null;
}

// Returns { ok, discount, error?, coupon? } based on a subtotal
function applyCoupon(code, subtotal) {
  const c = findCoupon(code);
  if (!c) return { ok: false, error: 'Invalid coupon code' };
  if (!c.active) return { ok: false, error: 'This coupon is currently inactive' };
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) {
    return { ok: false, error: 'This coupon has expired' };
  }
  if (subtotal < (c.minOrder || 0)) {
    return { ok: false, error: `Minimum order ₹${c.minOrder} required for this coupon` };
  }
  let discount = 0;
  if (c.type === 'flat') discount = Math.min(c.value, subtotal);
  else if (c.type === 'percent') {
    discount = Math.floor((subtotal * c.value) / 100);
    if (c.maxDiscount && discount > c.maxDiscount) discount = c.maxDiscount;
  }
  if (discount <= 0) return { ok: false, error: 'No discount applies' };
  return { ok: true, discount, coupon: c };
}

function validate(input) {
  const errors = [];
  const code = String(input.code || '').trim().toUpperCase();
  if (!code || !/^[A-Z0-9]{3,20}$/.test(code)) errors.push('Code must be 3–20 alphanumeric characters');
  const type = String(input.type || '').toLowerCase();
  if (!['flat', 'percent'].includes(type)) errors.push('Type must be flat or percent');
  const value = parseInt(input.value, 10);
  if (!Number.isFinite(value) || value <= 0) errors.push('Value must be a positive integer');
  if (type === 'percent' && value > 100) errors.push('Percent cannot exceed 100');
  const minOrder = input.minOrder == null || input.minOrder === '' ? 0 : parseInt(input.minOrder, 10);
  if (!Number.isFinite(minOrder) || minOrder < 0) errors.push('Min order must be 0 or more');
  const maxDiscount = input.maxDiscount == null || input.maxDiscount === '' ? null : parseInt(input.maxDiscount, 10);
  if (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount <= 0)) errors.push('Max discount must be positive');
  const expiresAt = input.expiresAt && String(input.expiresAt).trim() ? String(input.expiresAt) : null;
  const description = String(input.description || '').slice(0, 200);
  const active = !!input.active;
  if (errors.length) return { ok: false, errors };
  return { ok: true, item: { code, type, value, minOrder, maxDiscount, description, active, expiresAt } };
}

function add(input) {
  const v = validate(input);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const items = read();
  if (items.some(c => c.code.toUpperCase() === v.item.code)) return { ok: false, error: `Code ${v.item.code} already exists` };
  items.push(v.item);
  write(items);
  return { ok: true, item: v.item };
}

function update(code, patch) {
  const items = read();
  const idx = items.findIndex(c => c.code.toUpperCase() === String(code).toUpperCase());
  if (idx === -1) return { ok: false, error: 'Coupon not found' };
  const merged = { ...items[idx], ...patch, code: items[idx].code };
  const v = validate(merged);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  items[idx] = v.item;
  write(items);
  return { ok: true, item: v.item };
}

function remove(code) {
  const items = read();
  const idx = items.findIndex(c => c.code.toUpperCase() === String(code).toUpperCase());
  if (idx === -1) return { ok: false, error: 'Coupon not found' };
  const removed = items.splice(idx, 1)[0];
  write(items);
  return { ok: true, code: removed.code };
}

module.exports = { listAll, listActive, findCoupon, applyCoupon, add, update, remove };
