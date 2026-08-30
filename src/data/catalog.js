// MeatPe Catalog
// =============================================================
// Catalog is now stored in /data/catalog.json (editable at runtime
// via the admin panel). The file is auto-seeded from the defaults
// below the first time the server starts.
// =============================================================

const fs = require('fs');
const path = require('path');

const DATA_DIR    = path.join(__dirname, '..', '..', 'data');
const CATALOG_FILE = path.join(DATA_DIR, 'catalog.json');
const STOCK_FILE   = path.join(DATA_DIR, 'stock.json');

const CATALOG_BACKUP_DIR = path.join(DATA_DIR, 'catalog-backups');
const MAX_CATALOG_BACKUPS = 20;

// ---- Defaults (used only on first run) ----
const defaultCatalog = [
  // ===== CHICKEN =====
  { 
    code: 'C1', cat: 'chicken', name: 'Premium Fresh Chicken (1kg)', price: 260, unit: '1kg', img: '', 
    isFresh: true, isHalal: true, isBestseller: true,
    weightOptions: ['500g - ₹135', '1kg - ₹260', '2kg - ₹510'],
    nutritionInfo: { protein: '21g', fat: '4g', calories: '165 kcal', carbs: '0g' },
    storageTips: 'Store in refrigerator at 0-4°C. Use within 24 hours of delivery. For longer storage, freeze immediately.',
    cutTypes: ['Whole', 'Curry Cut', 'Boneless', 'Drumsticks', 'Wings'],
    boneOptions: ['With Bone', 'Boneless'],
    freshnessGuarantee: 'Farm-fresh, delivered within 2 hours of processing. 100% freshness guaranteed or full refund.',
    returnPolicy: 'Not satisfied? Return within 30 minutes of delivery for full refund. No questions asked.'
  },
  { code: 'C2', cat: 'chicken', name: 'Half Chicken (500g)',          price: 135, unit: '500g', img: '', isFresh: true, isHalal: true },
  { code: 'C3', cat: 'chicken', name: 'Boneless Chicken (1kg)',       price: 335, unit: '1kg', img: '', isFresh: true, isHalal: true, isBestseller: true },
  { code: 'C4', cat: 'chicken', name: 'Chicken Curry Cut (1kg)',      price: 270, unit: '1kg', img: '', isFresh: true, isHalal: true },
  { code: 'C5', cat: 'chicken', name: 'Chicken Liver (500g)',         price: 140, unit: '500g', img: '', isFresh: true, isHalal: true },
  { code: 'C6', cat: 'chicken', name: 'Chicken Wings (500g)',         price: 160, unit: '500g', img: '', isFresh: true, isHalal: true },
  { code: 'C7', cat: 'chicken', name: 'Chicken Drumsticks (500g)',    price: 175, unit: '500g', img: '', isFresh: true, isHalal: true },
  { code: 'C8', cat: 'chicken', name: 'Chicken Keema (500g)',         price: 180, unit: '500g', img: '', isFresh: true, isHalal: true },
  // ===== MUTTON =====
  { code: 'M1', cat: 'mutton', name: 'Premium Fresh Mutton (1kg)',    price: 800, unit: '1kg', img: '', isFresh: true, isHalal: true, isBestseller: true },
  { code: 'M2', cat: 'mutton', name: 'Half Mutton (500g)',            price: 420, unit: '500g', img: '', isFresh: true, isHalal: true },
  { code: 'M3', cat: 'mutton', name: 'Curry Cut Mutton (1kg)',        price: 820, unit: '1kg', img: '', isFresh: true, isHalal: true },
  { code: 'M4', cat: 'mutton', name: 'Boneless Mutton (1kg)',         price: 925, unit: '1kg', img: '', isFresh: true, isHalal: true, isBestseller: true },
  { code: 'M5', cat: 'mutton', name: 'Mutton Keema (500g)',           price: 470, unit: '500g', img: '', isFresh: true, isHalal: true },
  { code: 'M6', cat: 'mutton', name: 'Mutton Liver (500g)',           price: 380, unit: '500g', img: '', isFresh: true, isHalal: true },
  { code: 'M7', cat: 'mutton', name: 'Mutton Chops (1kg)',            price: 950, unit: '1kg', img: '', isFresh: true, isHalal: true },
  // ===== FISH =====
  { code: 'F1', cat: 'fish', name: 'Rohu Fish - Cleaned (1kg)',       price: 280, unit: '1kg', img: '', isFresh: true },
  { code: 'F2', cat: 'fish', name: 'Katla Fish - Cleaned (1kg)',      price: 290, unit: '1kg', img: '', isFresh: true },
  { code: 'F3', cat: 'fish', name: 'Singhara Fish (1kg)',             price: 350, unit: '1kg', img: '', isFresh: true },
  { code: 'F4', cat: 'fish', name: 'Pomfret - Medium (1kg)',          price: 650, unit: '1kg', img: '', isFresh: true },
  { code: 'F5', cat: 'fish', name: 'Basa Fillet - Boneless (1kg)',    price: 480, unit: '1kg', img: '', isFresh: true },
  { code: 'F6', cat: 'fish', name: 'Tilapia (1kg)',                   price: 320, unit: '1kg', img: '', isFresh: true },
  { code: 'F7', cat: 'fish', name: 'Prawns - Medium (500g)',          price: 380, unit: '500g', img: '', isFresh: true },
  // ===== READY TO COOK =====
  { code: 'R1',  cat: 'ready_to_cook', name: 'Tandoori Chicken Marinated (500g)',   price: 220, unit: '500g', img: '', isHalal: true },
  { code: 'R2',  cat: 'ready_to_cook', name: 'Chicken Tikka Marinated (500g)',      price: 230, unit: '500g', img: '', isHalal: true },
  { code: 'R3',  cat: 'ready_to_cook', name: 'Chicken Seekh Kebab (500g)',          price: 240, unit: '500g', img: '', isHalal: true },
  { code: 'R4',  cat: 'ready_to_cook', name: 'Chicken Malai Tikka (500g)',          price: 250, unit: '500g', img: '', isHalal: true },
  { code: 'R5',  cat: 'ready_to_cook', name: 'Chicken Hariyali Kebab (500g)',       price: 245, unit: '500g', img: '', isHalal: true },
  { code: 'R6',  cat: 'ready_to_cook', name: 'Mutton Seekh Kebab (500g)',           price: 460, unit: '500g', img: '', isHalal: true },
  { code: 'R7',  cat: 'ready_to_cook', name: 'Mutton Galouti Kebab (500g)',         price: 520, unit: '500g', img: '', isHalal: true },
  { code: 'R8',  cat: 'ready_to_cook', name: 'Fish Tikka Marinated (500g)',         price: 280, unit: '500g', img: '' },
  { code: 'R9',  cat: 'ready_to_cook', name: 'Fish Fingers - Crumb Coated (500g)',  price: 260, unit: '500g', img: '' },
  { code: 'R10', cat: 'ready_to_cook', name: 'Chicken Nuggets (500g)',              price: 230, unit: '500g', img: '', isHalal: true },
  { code: 'R11', cat: 'ready_to_cook', name: 'Chicken Sausages (450g)',             price: 210, unit: '450g', img: '', isHalal: true },
  { code: 'R12', cat: 'ready_to_cook', name: 'Chicken Salami (200g)',               price: 180, unit: '200g', img: '', isHalal: true },
  { code: 'R13', cat: 'ready_to_cook', name: 'Chicken Lollipop Marinated (500g)',   price: 250, unit: '500g', img: '', isHalal: true },
  { code: 'R14', cat: 'ready_to_cook', name: 'Mutton Shami Kebab (400g)',           price: 380, unit: '400g', img: '', isHalal: true },
  // ===== FAMILY / COMBO PACKS =====
  { code: 'P1', cat: 'family_pack', name: 'Chicken Family Pack (2kg, cleaned + cut)', price: 519,  unit: '2kg', img: '', isFresh: true, isHalal: true },
  { code: 'P2', cat: 'family_pack', name: 'Mutton Family Pack (2kg, cleaned + cut)',  price: 1599, unit: '2kg', img: '', isFresh: true, isHalal: true },
  { code: 'P3', cat: 'family_pack', name: 'Weekend Party Pack (3kg mixed combo)',     price: 2199, unit: '3kg', img: '', isFresh: true, isHalal: true },
  { code: 'P4', cat: 'family_pack', name: 'BBQ Combo (Tikka + Kebab + Wings 1.2kg)',  price: 599,  unit: '1.2kg', img: '', isHalal: true },
  { code: 'P5', cat: 'family_pack', name: 'Fish Lovers Combo (Rohu + Basa + Prawns)', price: 899,  unit: '2kg', img: '', isFresh: true },
];

const categoryLabels = {
  chicken:       '🐔 Fresh Chicken',
  mutton:        '🐐 Fresh Mutton',
  fish:          '🐟 Fresh Fish',
  ready_to_cook: '🔥 Ready to Cook',
  family_pack:   '👨‍👩‍👧 Family / Combo Packs',
};
const VALID_CATEGORIES = Object.keys(categoryLabels);

// ===== CATALOG FILE I/O =====
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}
function ensureCatalogBackupDir() {
  ensureDataDir();

  if (!fs.existsSync(CATALOG_BACKUP_DIR)) {
    fs.mkdirSync(CATALOG_BACKUP_DIR, { recursive: true });
  }
}

function createCatalogBackup() {
  if (!fs.existsSync(CATALOG_FILE)) return null;

  ensureCatalogBackupDir();

  const now = new Date();
  const stamp =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + '-' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0') + '-' +
    String(now.getMilliseconds()).padStart(3, '0');

  const backupFile = path.join(
    CATALOG_BACKUP_DIR,
    `catalog-${stamp}.json`
  );

  fs.copyFileSync(CATALOG_FILE, backupFile);

  // Keep only the newest backups.
  const backups = fs.readdirSync(CATALOG_BACKUP_DIR)
    .filter(name => /^catalog-\d{8}-\d{6}-\d{3}\.json$/.test(name))
    .sort()
    .reverse();

  for (const oldBackup of backups.slice(MAX_CATALOG_BACKUPS)) {
    try {
      fs.unlinkSync(path.join(CATALOG_BACKUP_DIR, oldBackup));
    } catch (e) {
      console.warn('Could not remove old catalog backup:', e.message);
    }
  }

  return backupFile;
}

function getLatestCatalogBackup() {
  if (!fs.existsSync(CATALOG_BACKUP_DIR)) return null;

  const backups = fs.readdirSync(CATALOG_BACKUP_DIR)
    .filter(name => /^catalog-\d{8}-\d{6}-\d{3}\.json$/.test(name))
    .sort()
    .reverse();

  return backups.length
    ? path.join(CATALOG_BACKUP_DIR, backups[0])
    : null;
}

function readCatalog() {
  ensureDataDir();

  if (!fs.existsSync(CATALOG_FILE)) {
    const initial = defaultCatalog.map(item => ({ ...item }));

    fs.writeFileSync(
      CATALOG_FILE,
      JSON.stringify(initial, null, 2),
      'utf8'
    );

    return initial;
  }

  try {
    const raw = fs.readFileSync(CATALOG_FILE, 'utf8');
    const data = JSON.parse(raw);

    if (!Array.isArray(data)) {
      throw new Error('catalog.json must contain an array');
    }

    return data;
  } catch (e) {
    console.error('❌ catalog.json is invalid:', e.message);

    // Never silently replace real catalog data with defaultCatalog.
    const latestBackup = getLatestCatalogBackup();

    if (latestBackup) {
      try {
        const rawBackup = fs.readFileSync(latestBackup, 'utf8');
        const backupData = JSON.parse(rawBackup);

        if (!Array.isArray(backupData)) {
          throw new Error('Latest backup is not a valid catalog array');
        }

        // Restore the last known-good catalog.
        fs.copyFileSync(latestBackup, CATALOG_FILE);

        console.warn(
          '✅ catalog.json restored from backup:',
          path.basename(latestBackup)
        );

        return backupData;
      } catch (restoreError) {
        throw new Error(
          `Catalog recovery failed: ${restoreError.message}`
        );
      }
    }

    // No valid backup exists, so fail loudly instead of deleting/replacing
    // customer data with defaults.
    throw new Error(
      'catalog.json is corrupted and no valid catalog backup exists'
    );
  }
}

function writeCatalog(items) {
  ensureDataDir();
  ensureCatalogBackupDir();

  if (!Array.isArray(items)) {
    throw new TypeError('writeCatalog expects an array');
  }

  // Backup current catalog BEFORE changing it.
  createCatalogBackup();

  const tempFile = `${CATALOG_FILE}.tmp`;

  try {
    fs.writeFileSync(
      tempFile,
      JSON.stringify(items, null, 2),
      'utf8'
    );

    // Atomic replacement: catalog.json is replaced only after the
    // complete temporary file has been successfully written.
    fs.renameSync(tempFile, CATALOG_FILE);
  } catch (e) {
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch (_) {}

    throw new Error(`Failed to save catalog: ${e.message}`);
  }
}

// ===== STOCK FILE I/O =====
function loadStock() {
  try {
    if (!fs.existsSync(STOCK_FILE)) return { outOfStock: [] };
    const data = JSON.parse(fs.readFileSync(STOCK_FILE, 'utf8'));
    return { outOfStock: Array.isArray(data.outOfStock) ? data.outOfStock : [] };
  } catch (e) {
    console.warn('stock.json read failed:', e.message);
    return { outOfStock: [] };
  }
}
function saveStock(state) {
  ensureDataDir();
  fs.writeFileSync(STOCK_FILE, JSON.stringify(state, null, 2));
}

// ===== Public helpers =====
// Backwards-compatible getters — every call reads the latest file.
const catalog = new Proxy([], {
  get(_target, prop) {
    const data = readCatalog();
    return data[prop];
  },
  has(_target, prop) {
    return prop in readCatalog();
  },
  ownKeys() { return Reflect.ownKeys(readCatalog()); },
  getOwnPropertyDescriptor(_t, p) {
    return Reflect.getOwnPropertyDescriptor(readCatalog(), p);
  },
});

function getCatalog() {
  return readCatalog();
}

function findByCode(code) {
  if (!code) return null;
  return readCatalog().find(i => i.code.toLowerCase() === String(code).toLowerCase()) || null;
}
function byCategory(cat) {
  return readCatalog().filter(i => i.cat === cat);
}
function isInStock(code) {
  const { outOfStock } = loadStock();
  return !outOfStock.map(c => c.toUpperCase()).includes(String(code).toUpperCase());
}
function setStock(code, inStock) {
  const item = findByCode(code);
  if (!item) return { ok: false, error: `Item ${code} not found` };
  const state = loadStock();
  const upper = item.code.toUpperCase();
  if (inStock) {
    state.outOfStock = state.outOfStock.filter(c => c.toUpperCase() !== upper);
  } else if (!state.outOfStock.map(c => c.toUpperCase()).includes(upper)) {
    state.outOfStock.push(item.code);
  }
  saveStock(state);
  return { ok: true, code: item.code, inStock };
}
function catalogWithStock() {
  const items = readCatalog();
  const { outOfStock } = loadStock();
  const oosUpper = outOfStock.map(c => c.toUpperCase());
  return items.map(i => {
    // Normalize: support both old `img` (string) and new `images` (array)
    let images = [];
    if (Array.isArray(i.images) && i.images.length) images = i.images;
    else if (i.img && String(i.img).trim()) images = [String(i.img).trim()];
    return {
      ...i,
      images,
      description: i.description || '',
      inStock: !oosUpper.includes(i.code.toUpperCase()),
    };
  });
}

// ===== Item CRUD (admin) =====
function validateItem(input, { existingCode } = {}) {
  const errors = [];
  const code = String(input.code || '').trim().toUpperCase();
  if (!code || !/^[A-Z]\d+$/.test(code)) errors.push('Code must look like C1, M2, F3, R10, P5');
  const cat = String(input.cat || '').trim().toLowerCase();
  if (!VALID_CATEGORIES.includes(cat)) errors.push(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  const name = String(input.name || '').trim();
  if (!name || name.length < 2) errors.push('Name is required');
  const price = parseInt(input.price, 10);
  if (!Number.isFinite(price) || price <= 0 || price > 100000) errors.push('Price must be a positive integer (≤ 100000)');

  // Product pricing and offer fields
  const mrpRaw = input.mrp;
  const mrp = (mrpRaw === '' || mrpRaw === null || mrpRaw === undefined)
    ? price
    : parseInt(mrpRaw, 10);

  if (!Number.isFinite(mrp) || mrp <= 0 || mrp > 100000) {
    errors.push('MRP must be a positive integer (≤ 100000)');
  }

  if (mrp < price) {
    errors.push('MRP cannot be lower than selling price');
  }

  const discountRaw = input.discount;
  const discount = (
    discountRaw === '' ||
    discountRaw === null ||
    discountRaw === undefined
  )
    ? (mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0)
    : Math.max(0, Math.min(100, Number(discountRaw)));

  const pieces = String(input.pieces || '').trim().slice(0, 100);
  const serves = String(input.serves || '').trim().slice(0, 100);
  const unit = String(input.unit || '').trim();
  if (!unit) errors.push('Unit is required (e.g. 500g, 1kg)');
  const description = String(input.description || '').trim().slice(0, 500);

  // Images: accept array of URLs or single img string (backward compat)
  let images = [];
  if (Array.isArray(input.images)) {
    images = input.images.map(u => String(u).trim()).filter(u => u.length > 0).slice(0, 10);
  } else if (input.img && String(input.img).trim()) {
    images = [String(input.img).trim()];
  }

  // Badges: freshness, halal, bestseller
  const isFresh = input.isFresh === true || input.isFresh === 'true';
  const isHalal = input.isHalal === true || input.isHalal === 'true';
  const isBestseller = input.isBestseller === true || input.isBestseller === 'true';

  // NEW: Product detail fields
  const weightOptions = Array.isArray(input.weightOptions) ? input.weightOptions : [];
  const nutritionInfo = input.nutritionInfo || {};
  const freshnessGuarantee = String(input.freshnessGuarantee || '').trim().slice(0, 200);
  const marketedBy = String(input.marketedBy || '').trim().slice(0, 200);
  const returnPolicy = String(input.returnPolicy || '').trim().slice(0, 200);

  if (errors.length) return { ok: false, errors };
  return { 
    ok: true, 
    item: { 
      code, cat, name, price, mrp, discount, unit, pieces, serves, description, images, 
      isFresh, isHalal, isBestseller,
      freshnessGuarantee, marketedBy, returnPolicy
    } 
  };
}

function addItem(input) {
  const v = validateItem(input);
  if (!v.ok) return { ok: false, error: v.errors.join('; ') };
  const items = readCatalog();
  if (items.some(i => i.code.toUpperCase() === v.item.code)) {
    return { ok: false, error: `Code ${v.item.code} already exists` };
  }
  items.push(v.item);
  writeCatalog(items);
  return { ok: true, item: v.item };
}

function isMeaningfullyEmpty(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function updateItem(code, patch = {}) {
  const items = readCatalog();
  const idx = items.findIndex(
    i => i.code.toUpperCase() === String(code).toUpperCase()
  );

  if (idx === -1) {
    return { ok: false, error: 'Item not found' };
  }

  const existing = items[idx];
  const incoming =
    patch && typeof patch === 'object' ? { ...patch } : {};

  const clearFields = new Set(
    Array.isArray(incoming.__clearFields)
      ? incoming.__clearFields.map(String)
      : []
  );

  delete incoming.__clearFields;

  const protectedFields = [
    'description',
    'images',
    'img',
    'weightOptions',
    'nutritionInfo',
    'storageTips',
    'cutTypes',
    'boneOptions',
    'freshnessGuarantee',
    'returnPolicy'
  ];

  for (const field of protectedFields) {
    if (!Object.prototype.hasOwnProperty.call(incoming, field)) continue;
    if (clearFields.has(field)) continue;

    if (
      isMeaningfullyEmpty(incoming[field]) &&
      !isMeaningfullyEmpty(existing[field])
    ) {
      delete incoming[field];
    }
  }

  for (const field of ['name', 'unit', 'cat']) {
    if (
      Object.prototype.hasOwnProperty.call(incoming, field) &&
      typeof incoming[field] === 'string' &&
      incoming[field].trim() === '' &&
      existing[field] !== undefined
    ) {
      delete incoming[field];
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(incoming, 'price') &&
    (incoming.price === '' ||
      incoming.price === null ||
      incoming.price === undefined)
  ) {
    delete incoming.price;
  }

  const merged = {
    ...existing,
    ...incoming,
    code: existing.code
  };

  const v = validateItem(merged);

  if (!v.ok) {
    return {
      ok: false,
      error: v.errors.join('; ')
    };
  }

  const updated = {
    ...existing
  };

  for (const [key, value] of Object.entries(v.item)) {
    updated[key] = value;
  }

  for (const [key, value] of Object.entries(incoming)) {
    if (key !== 'code') {
      updated[key] = value;
    }
  }

  updated.code = existing.code;

  items[idx] = updated;
  writeCatalog(items);

  return {
    ok: true,
    item: updated
  };
}

function deleteItem(code) {
  const items = readCatalog();
  const idx = items.findIndex(i => i.code.toUpperCase() === String(code).toUpperCase());
  if (idx === -1) return { ok: false, error: 'Item not found' };
  const removed = items.splice(idx, 1)[0];
  writeCatalog(items);
  // Also clean up out-of-stock list
  const state = loadStock();
  state.outOfStock = state.outOfStock.filter(c => c.toUpperCase() !== removed.code.toUpperCase());
  saveStock(state);
  return { ok: true, code: removed.code };
}

function suggestNextCode(cat) {
  const prefix = { chicken: 'C', mutton: 'M', fish: 'F', ready_to_cook: 'R', family_pack: 'P' }[cat];
  if (!prefix) return null;
  const items = readCatalog().filter(i => i.code && i.code.toUpperCase().startsWith(prefix));
  let max = 0;
  for (const it of items) {
    const n = parseInt(it.code.slice(1), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return prefix + (max + 1);
}

module.exports = {
  catalog, // proxy for back-compat
  categoryLabels,
  VALID_CATEGORIES,
  findByCode,
  byCategory,
  isInStock,
  setStock,
  loadStock,
  catalogWithStock,
  // CRUD
  getCatalog,
  addItem,
  updateItem,
  deleteItem,
  suggestNextCode,
};


