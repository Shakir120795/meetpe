// Site Settings — editable from admin panel
// Stored in /data/settings.json

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const FILE = path.join(DATA_DIR, 'settings.json');

const defaults = {
  branding: {
    name: 'MeatPe',
    tagline: 'Fresh Meat in 30 Minutes — Taaza, Tezz, Trusted',
    logo: '/logo.png',
    topbar: '🚚 Free delivery on orders ₹699+ • 30-min delivery',
  },
  categories: [
    { key: 'chicken', label: 'Fresh Chicken', icon: '🐔' },
    { key: 'mutton', label: 'Fresh Mutton', icon: '🐐' },
    { key: 'fish', label: 'Fresh Fish', icon: '🐟' },
    { key: 'ready_to_cook', label: 'Ready to Cook', icon: '🔥' },
    { key: 'family_pack', label: 'Family / Combo Packs', icon: '👨‍👩‍👧' },
  ],
  contact: {
    phone: '+917617555488',
    phoneDisplay: '+91 76175 55488',
    email: '',
    timing: '8:00 AM – 9:30 PM, all days',
    location: 'Live now, expanding to all major cities 🚀',
  },
  socials: [
    // { platform: 'instagram', handle: '@meatpe', url: 'https://instagram.com/meatpe', icon: '📷' },
    // { platform: 'facebook', handle: 'MeatPe', url: 'https://facebook.com/meatpe', icon: '👍' },
    // { platform: 'twitter', handle: '@meatpe', url: 'https://twitter.com/meatpe', icon: '🐦' },
    // { platform: 'youtube', handle: 'MeatPe', url: 'https://youtube.com/@meatpe', icon: '▶️' },
    // { platform: 'linkedin', handle: 'MeatPe', url: 'https://linkedin.com/company/meatpe', icon: '💼' },
  ],
  pages: {
    about: 'MeatPe is a fresh meat delivery service built for households who care about quality, hygiene, and convenience. We deliver freshly cut chicken, mutton, fish, and ready-to-cook items to your doorstep in 30 minutes — cleaned, cut, and packed exactly the way you want.',
    safety: 'Food safety is non-negotiable at MeatPe. Every item that reaches your home goes through a strict quality and hygiene process. We work with licensed suppliers, maintain cold chain, use food-grade packaging, and offer a 2-hour replacement guarantee if anything is wrong.',
    privacy: 'We collect only what is needed to deliver your order: name, phone, address, and order history. We do not sell your data. You can request deletion anytime by messaging us on WhatsApp.',
    terms: 'Orders can be cancelled before processing begins (within 5 minutes). Once meat is cleaned/cut, cancellation is not possible. Quality issues reported within 2 hours with a photo will be replaced or refunded.',
  },
  // NEW: Trending Searches (admin-editable)
  trendingSearches: [
    'chicken breast',
    'boneless mutton',
    'fresh fish',
    'marinated chicken',
    'tandoori',
  ],
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function read() {
  ensureDir();
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify(defaults, null, 2));
    return JSON.parse(JSON.stringify(defaults));
  }
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    // Merge with defaults to ensure all keys exist
    return {
      branding: { ...defaults.branding, ...data.branding },
      categories: Array.isArray(data.categories) ? data.categories : defaults.categories,
      contact: { ...defaults.contact, ...data.contact },
      socials: Array.isArray(data.socials) ? data.socials : defaults.socials,
      pages: { ...defaults.pages, ...data.pages },
      trendingSearches: Array.isArray(data.trendingSearches) ? data.trendingSearches : defaults.trendingSearches,
    };
  } catch (e) {
    console.warn('settings.json read failed:', e.message);
    return JSON.parse(JSON.stringify(defaults));
  }
}

function write(data) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function get() {
  return read();
}

function update(patch) {
  const current = read();
  // Deep merge each section
  if (patch.branding) current.branding = { ...current.branding, ...patch.branding };
  if (Array.isArray(patch.categories)) current.categories = patch.categories;
  if (patch.contact) current.contact = { ...current.contact, ...patch.contact };
  if (Array.isArray(patch.socials)) current.socials = patch.socials;
  if (patch.pages) current.pages = { ...current.pages, ...patch.pages };
  if (Array.isArray(patch.trendingSearches)) current.trendingSearches = patch.trendingSearches;
  write(current);
  return { ok: true, settings: current };
}

module.exports = { get, update, defaults };
