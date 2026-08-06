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
  // NEW: Vendor Location for distance calculation
  vendorLocation: {
    lat: 27.1767,  // Agra, UP (Default)
    lon: 78.0081,
    address: 'Agra, Uttar Pradesh',
    name: 'MeatPe Main Warehouse'
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
  // NEW: Checkout Settings (admin-editable)
  checkout: {
    deliverySlots: [
      { id: 'asap', label: 'ASAP (30-45 min)', enabled: true },
      { id: 'morning', label: '8:00 AM - 12:00 PM', enabled: true },
      { id: 'afternoon', label: '12:00 PM - 4:00 PM', enabled: true },
      { id: 'evening', label: '4:00 PM - 8:00 PM', enabled: true },
      { id: 'night', label: '8:00 PM - 10:00 PM', enabled: true }
    ],
    paymentMethods: [
      { id: 'cod', label: 'Cash on Delivery', icon: '💵', enabled: true, description: 'Pay when order arrives' },
      { id: 'upi', label: 'UPI / QR Code', icon: '📱', enabled: true, description: 'Pay via UPI apps' },
      { id: 'online', label: 'Pay Online', icon: '💳', enabled: true, description: 'Cards, Wallets, NetBanking' }
    ],
    enableSavedAddresses: true,
    maxSavedAddresses: 5,
    requirePhone: true,
    allowGuestCheckout: false
  },
  // NEW: Payment Gateway Settings (admin-editable)
  paymentGateway: {
    provider: 'razorpay', // razorpay, stripe, paytm, mock
    mode: 'test', // test or live
    mockPaymentEnabled: true, // For testing - auto-approves payments
    razorpay: {
      keyId: '', // Razorpay Key ID (from dashboard)
      keySecret: '', // Razorpay Key Secret (from dashboard)
      webhookSecret: '' // For webhook verification
    },
    stripe: {
      publishableKey: '',
      secretKey: '',
      webhookSecret: ''
    },
    paytm: {
      merchantId: '',
      merchantKey: '',
      websiteName: 'WEBSTAGING',
      industryType: 'Retail'
    },
    upiOptions: {
      enabled: true,
      merchantVpa: 'meatpe@paytm', // Your UPI ID
      merchantName: 'MeatPe',
      showQrCode: true
    },
    cardOptions: {
      enabled: true,
      acceptedCards: ['visa', 'mastercard', 'rupay', 'amex'],
      saveCardOption: false
    },
    netBankingOptions: {
      enabled: true,
      banks: [
        { id: 'sbi', name: 'State Bank of India', icon: '🏦' },
        { id: 'hdfc', name: 'HDFC Bank', icon: '🏦' },
        { id: 'icici', name: 'ICICI Bank', icon: '🏦' },
        { id: 'axis', name: 'Axis Bank', icon: '🏦' },
        { id: 'pnb', name: 'Punjab National Bank', icon: '🏦' },
        { id: 'bob', name: 'Bank of Baroda', icon: '🏦' },
        { id: 'kotak', name: 'Kotak Mahindra Bank', icon: '🏦' }
      ]
    },
    walletOptions: {
      enabled: true,
      allowWalletPayment: true,
      minWalletBalance: 10
    },
    codOptions: {
      enabled: true,
      maxOrderAmount: 5000, // Max COD order value
      minOrderAmount: 100,
      extraCharge: 0 // Extra charge for COD (₹)
    }
  },
  // NEW: Order Tracking Settings (admin-editable)
  orderTracking: {
    enableLiveTracking: true, // Show live map tracking
    enableDeliveryBoyDetails: true, // Show delivery boy info
    enableCallButton: true, // Show call delivery boy button
    enableChatButton: true, // Show chat with delivery boy button
    supportPhone: '+917617555488', // Support phone number
    supportWhatsApp: '+917617555488', // Support WhatsApp number
    mapProvider: 'google', // google, mapbox, or placeholder
    googleMapsApiKey: '', // Google Maps API key
    mapboxToken: '', // Mapbox token
    defaultETA: 30, // Default ETA in minutes
    etaUpdateInterval: 30, // Update ETA every N seconds
    deliveryBoys: [
      {
        id: 'DB001',
        name: 'Raj Kumar',
        phone: '+919876543210',
        photo: '', // URL to photo
        rating: 4.8,
        totalDeliveries: 450,
        vehicleNumber: 'UP 16 AB 1234',
        vehicleType: 'Bike',
        status: 'available' // available, busy, offline
      },
      {
        id: 'DB002',
        name: 'Amit Singh',
        phone: '+919876543211',
        photo: '',
        rating: 4.9,
        totalDeliveries: 520,
        vehicleNumber: 'UP 16 CD 5678',
        vehicleType: 'Bike',
        status: 'available'
      }
    ]
  },
  // NEW: Trending Searches (admin-editable)
  trendingSearches: [
    'chicken breast',
    'boneless mutton',
    'fresh fish',
    'marinated chicken',
    'tandoori',
  ],
  // NEW: Cart & Checkout Settings (admin-editable)
  cart: {
    enableMembershipDiscount: true,
    membershipDiscountPercent: 5,
    showTaxesBreakdown: true,
    gstPercent: 5,
    packagingCharge: 10,
    enableTipDeliveryPartner: true,
    tipOptions: [10, 20, 30, 50], // In rupees
    deliveryCharges: {
      freeAbove: 699,
      belowThreshold: 399,
      lowOrderFee: 29,
      regularOrderFee: 19
    }
  },
  // NEW: Distance-Based Delivery Zones (admin-editable)
  deliveryZones: [
    {
      id: 'zone_a',
      name: 'Zone A',
      distanceRange: '0-3 km',
      minDistance: 0,
      maxDistance: 3,
      deliveryTime: '20-30 Minutes',
      deliveryFee: 29,
      freeDeliveryAbove: 699
    },
    {
      id: 'zone_b',
      name: 'Zone B',
      distanceRange: '3-7 km',
      minDistance: 3,
      maxDistance: 7,
      deliveryTime: '30-45 Minutes',
      deliveryFee: 39,
      freeDeliveryAbove: 899
    },
    {
      id: 'zone_c',
      name: 'Zone C',
      distanceRange: '7-12 km',
      minDistance: 7,
      maxDistance: 12,
      deliveryTime: '45-60 Minutes',
      deliveryFee: 59,
      freeDeliveryAbove: 1199
    },
    {
      id: 'zone_d',
      name: 'Zone D',
      distanceRange: '12-20 km',
      minDistance: 12,
      maxDistance: 20,
      deliveryTime: '60-90 Minutes',
      deliveryFee: 79,
      freeDeliveryAbove: 1499
    }
  ],
  // NEW: Zone-Based Membership Plans (admin-editable)
  membershipPlans: [
    {
      zoneId: 'zone_a',
      zoneName: 'Zone A (0-3 km)',
      price: 249,
      deliveryCredits: 10,
      saving: 41,
      benefits: ['10 delivery credits', 'Priority order processing', 'Exclusive member-only offers']
    },
    {
      zoneId: 'zone_b',
      zoneName: 'Zone B (3-7 km)',
      price: 349,
      deliveryCredits: 10,
      saving: 41,
      benefits: ['10 delivery credits', 'Priority order processing', 'Exclusive member-only offers']
    },
    {
      zoneId: 'zone_c',
      zoneName: 'Zone C (7-12 km)',
      price: 529,
      deliveryCredits: 10,
      saving: 61,
      benefits: ['10 delivery credits', 'Premium support', 'Exclusive member-only offers']
    },
    {
      zoneId: 'zone_d',
      zoneName: 'Zone D (12-20 km)',
      price: 699,
      deliveryCredits: 10,
      saving: 91,
      benefits: ['10 delivery credits', 'Priority handling', 'Premium customer support']
    }
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
      vendorLocation: { ...defaults.vendorLocation, ...data.vendorLocation },
      socials: Array.isArray(data.socials) ? data.socials : defaults.socials,
      pages: { ...defaults.pages, ...data.pages },
      trendingSearches: Array.isArray(data.trendingSearches) ? data.trendingSearches : defaults.trendingSearches,
      cart: { ...defaults.cart, ...data.cart, deliveryCharges: { ...defaults.cart.deliveryCharges, ...(data.cart?.deliveryCharges || {}) } },
      checkout: { 
        ...defaults.checkout, 
        ...data.checkout,
        deliverySlots: Array.isArray(data.checkout?.deliverySlots) ? data.checkout.deliverySlots : defaults.checkout.deliverySlots,
        paymentMethods: Array.isArray(data.checkout?.paymentMethods) ? data.checkout.paymentMethods : defaults.checkout.paymentMethods
      },
      paymentGateway: { 
        ...defaults.paymentGateway, 
        ...data.paymentGateway,
        razorpay: { ...defaults.paymentGateway.razorpay, ...(data.paymentGateway?.razorpay || {}) },
        stripe: { ...defaults.paymentGateway.stripe, ...(data.paymentGateway?.stripe || {}) },
        paytm: { ...defaults.paymentGateway.paytm, ...(data.paymentGateway?.paytm || {}) },
        upiOptions: { ...defaults.paymentGateway.upiOptions, ...(data.paymentGateway?.upiOptions || {}) },
        cardOptions: { ...defaults.paymentGateway.cardOptions, ...(data.paymentGateway?.cardOptions || {}) },
        netBankingOptions: { 
          ...defaults.paymentGateway.netBankingOptions, 
          ...(data.paymentGateway?.netBankingOptions || {}),
          banks: Array.isArray(data.paymentGateway?.netBankingOptions?.banks) ? data.paymentGateway.netBankingOptions.banks : defaults.paymentGateway.netBankingOptions.banks
        },
        walletOptions: { ...defaults.paymentGateway.walletOptions, ...(data.paymentGateway?.walletOptions || {}) },
        codOptions: { ...defaults.paymentGateway.codOptions, ...(data.paymentGateway?.codOptions || {}) }
      },
      orderTracking: {
        ...defaults.orderTracking,
        ...data.orderTracking,
        deliveryBoys: Array.isArray(data.orderTracking?.deliveryBoys) ? data.orderTracking.deliveryBoys : defaults.orderTracking.deliveryBoys
      },
      deliveryZones: Array.isArray(data.deliveryZones) ? data.deliveryZones : defaults.deliveryZones,
      membershipPlans: Array.isArray(data.membershipPlans) ? data.membershipPlans : defaults.membershipPlans,
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
  if (patch.vendorLocation) current.vendorLocation = { ...current.vendorLocation, ...patch.vendorLocation };
  if (Array.isArray(patch.socials)) current.socials = patch.socials;
  if (patch.pages) current.pages = { ...current.pages, ...patch.pages };
  if (patch.trendingSearches) current.trendingSearches = patch.trendingSearches;
  if (patch.cart) current.cart = { ...current.cart, ...patch.cart, deliveryCharges: { ...current.cart.deliveryCharges, ...(patch.cart.deliveryCharges || {}) } };
  if (patch.checkout) current.checkout = { 
    ...current.checkout, 
    ...patch.checkout,
    deliverySlots: Array.isArray(patch.checkout.deliverySlots) ? patch.checkout.deliverySlots : current.checkout.deliverySlots,
    paymentMethods: Array.isArray(patch.checkout.paymentMethods) ? patch.checkout.paymentMethods : current.checkout.paymentMethods
  };
  if (patch.paymentGateway) current.paymentGateway = {
    ...current.paymentGateway,
    ...patch.paymentGateway,
    razorpay: { ...current.paymentGateway.razorpay, ...(patch.paymentGateway.razorpay || {}) },
    stripe: { ...current.paymentGateway.stripe, ...(patch.paymentGateway.stripe || {}) },
    paytm: { ...current.paymentGateway.paytm, ...(patch.paymentGateway.paytm || {}) },
    upiOptions: { ...current.paymentGateway.upiOptions, ...(patch.paymentGateway.upiOptions || {}) },
    cardOptions: { ...current.paymentGateway.cardOptions, ...(patch.paymentGateway.cardOptions || {}) },
    netBankingOptions: { 
      ...current.paymentGateway.netBankingOptions, 
      ...(patch.paymentGateway.netBankingOptions || {}),
      banks: Array.isArray(patch.paymentGateway?.netBankingOptions?.banks) ? patch.paymentGateway.netBankingOptions.banks : current.paymentGateway.netBankingOptions.banks
    },
    walletOptions: { ...current.paymentGateway.walletOptions, ...(patch.paymentGateway.walletOptions || {}) },
    codOptions: { ...current.paymentGateway.codOptions, ...(patch.paymentGateway.codOptions || {}) }
  };
  if (patch.orderTracking) current.orderTracking = {
    ...current.orderTracking,
    ...patch.orderTracking,
    deliveryBoys: Array.isArray(patch.orderTracking.deliveryBoys) ? patch.orderTracking.deliveryBoys : current.orderTracking.deliveryBoys
  };
  if (Array.isArray(patch.deliveryZones)) current.deliveryZones = patch.deliveryZones;
  if (Array.isArray(patch.membershipPlans)) current.membershipPlans = patch.membershipPlans;
  write(current);
  return { ok: true, settings: current };
}

module.exports = { get, update, defaults };
