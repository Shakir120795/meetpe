// MeatPe — main server
require('dotenv').config();
require('./db/init'); // ensure DB ready

const path = require('path');
const express = require('express');
const cron = require('node-cron');
const multer = require('multer');
const axios = require('axios');

// File upload config — saves to public/photos/
const uploadDir = path.join(__dirname, '..', 'public', 'photos');
const fs = require('fs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // Unique name: timestamp + random + original extension
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only images allowed (jpg, png, webp, gif)'));
  },
});

const { handleMessage } = require('./whatsapp/bot');
const { twimlReply, sendMessage } = require('./whatsapp/twilio');
const { handleInstagramWebhook } = require('./instagram/replies');
const { postRandomSample } = require('./instagram/post');
const {
  catalogWithStock, setStock, findByCode, loadStock,
  getCatalog, addItem, updateItem, deleteItem, suggestNextCode, VALID_CATEGORIES,
} = require('./data/catalog');
const coupons = require('./data/coupons');
const settings = require('./data/settings');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ===== Static website =====
app.use(express.static(path.join(__dirname, '..', 'public')));

// ===== Public menu API for the website =====
app.get('/api/menu', (req, res) => {
  const items = catalogWithStock();
  
  // Add rating data for each item
  const itemsWithRatings = items.map(item => {
    const ratingData = db.prepare(`
      SELECT 
        COUNT(*) as review_count,
        AVG(rating) as avg_rating
      FROM reviews 
      WHERE item_code = ?
    `).get(item.code);
    
    return {
      ...item,
      rating: ratingData.avg_rating ? Number(ratingData.avg_rating.toFixed(1)) : 0,
      review_count: ratingData.review_count || 0
    };
  });
  
  res.json(itemsWithRatings);
});

// ===== Image upload endpoint =====
app.post('/api/upload', upload.array('images', 10), (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  if (!req.files || !req.files.length) return res.status(400).json({ ok: false, error: 'No files uploaded' });
  const urls = req.files.map(f => '/photos/' + f.filename);
  res.json({ ok: true, urls });
});

// ===== Public order API — used by website checkout form =====
const db = require('./db/init');

// Customer notification helper — sends WhatsApp messages on status changes
function buildCustomerMessage(status, order) {
  const SHOP = process.env.SHOP_NAME || 'MeatPe';
  switch (status) {
    case 'placed':
      return (
`✅ *Order Confirmed!* — ${SHOP}

Order #${order.id}
Total: ₹${order.total}
ETA: ~30 minutes 🛵

📍 Delivery to:
${order.address}

We'll keep you posted on each step.
Pay on delivery (Cash / UPI).

Thank you for ordering with ${SHOP} 🥩`
      );
    case 'preparing':
      return (
`👨‍🍳 *Your order is being prepared* — ${SHOP}

Order #${order.id}
We're cleaning + cutting your meat fresh right now. Will be on the way shortly!

Total: ₹${order.total}`
      );
    case 'out_for_delivery':
      return (
`🛵 *Out for delivery!* — ${SHOP}

Order #${order.id}
Your fresh meat is on the way. The rider will reach you in a few minutes.

Total: ₹${order.total}
Please keep ₹${order.total} ready (Cash or UPI).`
      );
    case 'delivered':
      return (
`✅ *Order Delivered* — ${SHOP}

Order #${order.id}
Thank you for ordering! We hope you enjoy your fresh meat 🥩

If anything is wrong with the order, please reply within 2 hours with a photo and we'll make it right.

🎁 Order again at wa.me/917617555488`
      );
    case 'cancelled':
      return (
`❌ *Order Cancelled* — ${SHOP}

Order #${order.id}
Your order has been cancelled. If you were charged, refund will be processed.

For help: wa.me/917617555488`
      );
    default:
      return null;
  }
}

async function notifyCustomer(order, status) {
  const msg = buildCustomerMessage(status, order);
  if (!msg) return;
  console.log(`📤 [${status.toUpperCase()}] Customer ${order.phone} — order #${order.id}`);

  // Auto-notification is OFF by default. We only auto-send when explicitly enabled
  // (i.e. when a real WhatsApp Business API is connected). For now, you reply
  // manually from your WhatsApp Business App on +91 76175 55488.
  const autoOn = String(process.env.WHATSAPP_AUTO_NOTIFY || 'off').toLowerCase() === 'on';
  if (!autoOn) {
    console.log('   (auto-notify OFF — manage manually via WhatsApp Business App)');
    return;
  }
  const isApiConfigured = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  if (!isApiConfigured) {
    console.log('   (skipped — no API credentials configured)');
    return;
  }
  try {
    await sendMessage(order.phone, msg);
    console.log(`   ✅ message sent to ${order.phone}`);
  } catch (e) {
    console.warn(`   ⚠️ send failed: ${e.message}`);
  }
}

app.post('/api/order', (req, res) => {
  try {
    const { name, phone, address, payment, delivery_slot, notes, items, couponCode, walletAmount } = req.body || {};
    if (!name || !phone || !address || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ ok: false, error: 'missing fields' });
    }
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });

    // Validate + price items server-side
    const cleanItems = [];
    for (const it of items) {
      const found = findByCode(it.code);
      if (!found) continue;
      const { outOfStock } = loadStock();
      if (outOfStock.map(c => c.toUpperCase()).includes(found.code.toUpperCase())) continue;
      const qty = Math.max(1, parseInt(it.qty, 10) || 1);
      cleanItems.push({ code: found.code, name: found.name, price: found.price, qty });
    }
    if (!cleanItems.length) return res.status(400).json({ ok: false, error: 'all items unavailable' });

    const subtotal = cleanItems.reduce((s, i) => s + i.price * i.qty, 0);

    // Apply coupon if provided
    let couponDiscount = 0;
    let appliedCouponCode = null;
    if (couponCode) {
      const result = coupons.applyCoupon(couponCode, subtotal);
      if (result.ok) {
        couponDiscount = result.discount;
        appliedCouponCode = result.coupon.code;
      }
    }

    const free = Number(process.env.DELIVERY_FREE_ABOVE || 699);
    const lowBelow = Number(process.env.DELIVERY_LOW_BELOW || 399);
    const feeLow = Number(process.env.DELIVERY_FEE_LOW || 29);
    const feeMid = Number(process.env.DELIVERY_FEE_MID || 19);
    let delivery = subtotal >= free ? 0 : (subtotal < lowBelow ? feeLow : feeMid);
    
    // Use web: prefix — consistent with auth/login
    const webPhone = `web:+91${cleanPhone}`;
    
    // Check for membership credits
    let usedCredit = false;
    const customer = db.prepare(`
      SELECT delivery_credits, membership_start, membership_zone 
      FROM customers WHERE phone = ?
    `).get(webPhone);
    
    if (customer && customer.delivery_credits > 0 && customer.membership_start) {
      // Check if membership is still valid (within 30 days)
      const startDate = new Date(customer.membership_start);
      const now = new Date();
      const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
      
      if (daysSinceStart < 30) {
        // Use credit - delivery becomes free
        delivery = 0;
        usedCredit = true;
      }
    }

    // Server-side wallet deduction (validated)
    const walletAmt = parseInt(walletAmount || 0, 10);
    let actualWalletDeducted = 0;

    if (walletAmt > 0) {
      const customerWallet = db.prepare('SELECT wallet_balance FROM customers WHERE phone = ?').get(webPhone);
      if (customerWallet && customerWallet.wallet_balance >= walletAmt) {
        actualWalletDeducted = walletAmt;
      }
    }

    const total = Math.max(0, subtotal - couponDiscount - actualWalletDeducted + delivery);

    // Get wallet/rewards settings from admin panel
    const siteSettings = require('./data/settings').get();
    const wr = siteSettings.walletRewards || {};
    const rewardThreshold = wr.rewardThreshold || Number(process.env.REWARD_THRESHOLD || 500);
    const rewardAmt = wr.rewardAmount || Number(process.env.REWARD_AMOUNT || 30);
    const rewardExpiry = wr.rewardExpiry || 15;
    const enableRewards = wr.enableRewards !== false;
    const enableCashback = wr.enableCashback === true;
    const cashbackPercent = wr.cashbackPercent || 5;
    const cashbackMax = wr.cashbackMaxAmount || 100;
    const cashbackMinOrder = wr.cashbackMinOrder || 299;

    // Upsert customer
    db.prepare(`
      INSERT INTO customers (phone, name, address) VALUES (?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET name = excluded.name, address = excluded.address
    `).run(webPhone, name, address);

    // Insert order
    const cleanSlot = delivery_slot || 'asap';
    const cleanPayment = payment || 'cod';
    const cleanNotes = (notes || '').trim();
    const info = db.prepare(`
      INSERT INTO orders (phone, items_json, subtotal, delivery_fee, total, address, source, payment_method, delivery_slot, notes)
      VALUES (?, ?, ?, ?, ?, ?, 'web', ?, ?, ?)
    `).run(webPhone, JSON.stringify(cleanItems), subtotal, delivery, total, address, cleanPayment, cleanSlot, cleanNotes);
    const orderId = info.lastInsertRowid;

    // Deduct wallet server-side
    if (actualWalletDeducted > 0) {
      db.prepare('UPDATE customers SET wallet_balance = wallet_balance - ? WHERE phone = ?')
        .run(actualWalletDeducted, webPhone);
    }
    
    // Deduct membership credit if used
    if (usedCredit) {
      db.prepare('UPDATE customers SET delivery_credits = delivery_credits - 1 WHERE phone = ?')
        .run(webPhone);
    }

    let earnedReward = 0;
    if (enableRewards && subtotal >= rewardThreshold) {
      db.prepare(`INSERT INTO rewards (phone, amount, expires_at) VALUES (?, ?, datetime('now', '+${rewardExpiry} days'))`)
        .run(webPhone, rewardAmt);
      earnedReward = rewardAmt;
    }
    
    // Cashback calculation
    let cashbackEarned = 0;
    if (enableCashback && subtotal >= cashbackMinOrder) {
      cashbackEarned = Math.min(Math.round(subtotal * cashbackPercent / 100), cashbackMax);
      if (cashbackEarned > 0) {
        // Credit cashback to wallet
        db.prepare('UPDATE customers SET wallet_balance = wallet_balance + ? WHERE phone = ?')
          .run(cashbackEarned, webPhone);
      }
    }

    const paymentLabel = payment === 'pay_online'
      ? 'Pay Online (UPI link sent)'
      : payment === 'upi'
      ? 'UPI Direct'
      : 'Pay on Delivery (Cash / UPI)';

    // Notify admin
    if (process.env.ADMIN_WHATSAPP) {
      const couponLine = appliedCouponCode ? `\n🏷️  Coupon: ${appliedCouponCode} (−₹${couponDiscount})` : '';
      const walletLine = actualWalletDeducted > 0 ? `\n💳 Wallet: −₹${actualWalletDeducted}` : '';
      const adminMsg =
`🆕 *New Order #${orderId}*

👤 ${name}
📞 +91${cleanPhone}
📍 ${address}
💳 ${paymentLabel}
${notes ? '📝 ' + notes + '\n' : ''}
${cleanItems.map(i => `• ${i.name} × ${i.qty} = ₹${i.price * i.qty}`).join('\n')}

Subtotal: ₹${subtotal}${couponLine}${walletLine}
Delivery: ₹${delivery}
*Total: ₹${total}*${earnedReward ? `\n🎁 +₹${earnedReward} reward issued` : ''}`;
      sendMessage(process.env.ADMIN_WHATSAPP, adminMsg).catch(err =>
        console.warn('admin notification failed:', err.message));
    }

    res.json({
      ok: true, orderId, subtotal,
      couponDiscount, couponCode: appliedCouponCode,
      walletDeducted: actualWalletDeducted,
      delivery, total, reward: earnedReward,
      cashback: cashbackEarned,
      creditUsed: usedCredit,
      creditsRemaining: usedCredit && customer ? customer.delivery_credits - 1 : null
    });

    // Notify customer
    setImmediate(() => {
      notifyCustomer({ id: orderId, phone: webPhone, address, total }, 'placed');
    });
  } catch (e) {
    console.error('order err:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// ===== Saved Addresses API =====

// GET /api/addresses?phone=XXXXXXXXXX — list saved addresses for a user
app.get('/api/addresses', (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ ok: false, error: 'phone required' });
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
    const waPhone = `web:+91${cleanPhone}`;
    const addresses = db.prepare('SELECT * FROM saved_addresses WHERE phone = ? ORDER BY is_default DESC, id DESC').all(waPhone);
    res.json({ ok: true, addresses });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/addresses — save a new address
app.post('/api/addresses', (req, res) => {
  try {
    const { phone, tag, address, is_default } = req.body || {};
    if (!phone || !address) return res.status(400).json({ ok: false, error: 'phone and address required' });
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
    const waPhone = `web:+91${cleanPhone}`;
    
    // Count existing addresses
    const count = db.prepare('SELECT COUNT(*) as cnt FROM saved_addresses WHERE phone = ?').get(waPhone);
    if (count.cnt >= 5) return res.status(400).json({ ok: false, error: 'Max 5 addresses allowed' });
    
    // If setting as default, unset others
    if (is_default) {
      db.prepare('UPDATE saved_addresses SET is_default = 0 WHERE phone = ?').run(waPhone);
    }
    
    const result = db.prepare(
      'INSERT INTO saved_addresses (phone, tag, address, is_default) VALUES (?, ?, ?, ?)'
    ).run(waPhone, tag || 'Home', address.trim(), is_default ? 1 : 0);
    
    res.json({ ok: true, id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// DELETE /api/addresses/:id — delete a saved address
app.delete('/api/addresses/:id', (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ ok: false, error: 'phone required' });
    const cleanPhone = String(phone).replace(/\D/g, '');
    const waPhone = `web:+91${cleanPhone}`;
    const id = parseInt(req.params.id, 10);
    const result = db.prepare('DELETE FROM saved_addresses WHERE id = ? AND phone = ?').run(id, waPhone);
    if (result.changes === 0) return res.status(404).json({ ok: false, error: 'not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// PUT /api/addresses/:id/default — set as default
app.put('/api/addresses/:id/default', (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone) return res.status(400).json({ ok: false, error: 'phone required' });
    const cleanPhone = String(phone).replace(/\D/g, '');
    const waPhone = `web:+91${cleanPhone}`;
    const id = parseInt(req.params.id, 10);
    db.prepare('UPDATE saved_addresses SET is_default = 0 WHERE phone = ?').run(waPhone);
    db.prepare('UPDATE saved_addresses SET is_default = 1 WHERE id = ? AND phone = ?').run(id, waPhone);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ===== Public coupon validation (used by website cart) =====
app.post('/api/coupon/validate', (req, res) => {
  const { code, subtotal } = req.body || {};
  if (!code) return res.status(400).json({ ok: false, error: 'code required' });
  const sub = parseInt(subtotal, 10) || 0;
  const result = coupons.applyCoupon(code, sub);
  res.json(result);
});

// ===== Public list of currently active coupons (for "Available offers" UI) =====
app.get('/api/coupons', (req, res) => {
  // Only show non-sensitive fields
  const list = coupons.listActive().map(c => ({
    code: c.code, type: c.type, value: c.value,
    minOrder: c.minOrder, maxDiscount: c.maxDiscount,
    description: c.description,
  }));
  res.json(list);
});

// ===== Distance-Based Delivery Zone Detection =====

// Haversine formula to calculate distance between two coordinates (in km)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

// POST /api/zone/detect - Calculate delivery zone based on customer location
app.post('/api/zone/detect', (req, res) => {
  try {
    const { lat, lon, phone } = req.body;
    
    if (!lat || !lon) {
      return res.status(400).json({ ok: false, error: 'Missing coordinates' });
    }
    
    // Get settings
    const settingsData = settings.get();
    const vendor = settingsData.vendorLocation;
    const zones = settingsData.deliveryZones;
    
    // Calculate distance
    const distance = calculateDistance(lat, lon, vendor.lat, vendor.lon);
    
    // Find matching zone
    let zone = zones.find(z => distance >= z.minDistance && distance < z.maxDistance);
    
    // If outside all zones, default to last zone
    if (!zone) {
      zone = zones[zones.length - 1];
    }
    
    // Update customer's zone if phone provided
    if (phone) {
      const cleanPhone = String(phone).replace(/\D/g, '');
      if (cleanPhone.length === 10) {
        const waPhone = `web:+91${cleanPhone}`;
        db.prepare(`
          UPDATE customers 
          SET delivery_zone = ?, delivery_zone_distance = ? 
          WHERE phone = ?
        `).run(zone.id, distance, waPhone);
      }
    }
    
    res.json({ 
      ok: true, 
      zone: {
        id: zone.id,
        name: zone.name,
        distanceRange: zone.distanceRange,
        deliveryTime: zone.deliveryTime,
        deliveryFee: zone.deliveryFee,
        freeDeliveryAbove: zone.freeDeliveryAbove
      },
      distance: Math.round(distance * 10) / 10 // Round to 1 decimal
    });
  } catch (e) {
    console.error('Zone detection error:', e);
    res.status(500).json({ ok: false, error: 'Zone detection failed' });
  }
});

// ===== Zone-Based Membership System =====

// GET /api/membership/plans - Get available membership plans for user's zone
app.get('/api/membership/plans', (req, res) => {
  try {
    const { phone } = req.query;
    
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'Phone required' });
    }
    
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ ok: false, error: 'Invalid phone' });
    }
    
    const waPhone = `web:+91${cleanPhone}`;
    
    // Get customer's zone
    const customer = db.prepare('SELECT delivery_zone FROM customers WHERE phone = ?').get(waPhone);
    
    if (!customer || !customer.delivery_zone) {
      return res.status(400).json({ ok: false, error: 'Zone not detected. Please set your location first.' });
    }
    
    // Get membership plans from settings
    const settingsData = settings.get();
    const allPlans = settingsData.membershipPlans || [];
    
    // Filter plan for user's zone
    const plan = allPlans.find(p => p.zoneId === customer.delivery_zone);
    
    if (!plan) {
      return res.status(404).json({ ok: false, error: 'No membership plan for your zone' });
    }
    
    res.json({ ok: true, plan, currentZone: customer.delivery_zone });
  } catch (e) {
    console.error('Get membership plans error:', e);
    res.status(500).json({ ok: false, error: 'Failed to fetch plans' });
  }
});

// POST /api/membership/purchase - Purchase membership (mock payment for now)
app.post('/api/membership/purchase', (req, res) => {
  try {
    const { phone, zoneId, paymentMethod } = req.body;
    
    if (!phone || !zoneId) {
      return res.status(400).json({ ok: false, error: 'Phone and zone required' });
    }
    
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ ok: false, error: 'Invalid phone' });
    }
    
    const waPhone = `web:+91${cleanPhone}`;
    
    // Get membership plan
    const settingsData = settings.get();
    const plan = (settingsData.membershipPlans || []).find(p => p.zoneId === zoneId);
    
    if (!plan) {
      return res.status(404).json({ ok: false, error: 'Invalid membership plan' });
    }
    
    // Check if customer exists
    const customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(waPhone);
    
    if (!customer) {
      return res.status(404).json({ ok: false, error: 'Customer not found' });
    }
    
    // Check if already has active membership
    if (customer.membership_zone && customer.membership_start) {
      const startDate = new Date(customer.membership_start);
      const now = new Date();
      const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
      
      if (daysSinceStart < 30 && customer.delivery_credits > 0) {
        return res.status(400).json({ 
          ok: false, 
          error: 'You already have an active membership',
          daysRemaining: 30 - daysSinceStart,
          creditsRemaining: customer.delivery_credits
        });
      }
    }
    
    // TODO: Real payment integration (Razorpay, etc.)
    // For now, we'll just activate membership
    
    // Activate membership
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE customers 
      SET membership_zone = ?,
          membership_price = ?,
          delivery_credits = ?,
          membership_start = ?
      WHERE phone = ?
    `).run(zoneId, plan.price, plan.deliveryCredits, now, waPhone);
    
    // Notify admin (optional)
    if (process.env.ADMIN_WHATSAPP) {
      const adminMsg = `🎉 *New Membership Purchased!*

👤 ${customer.name || 'Customer'}
📞 +91${cleanPhone}
💳 ${plan.zoneName} Membership
💰 ₹${plan.price}/month
🎟️ ${plan.deliveryCredits} delivery credits activated

Valid for 30 days from today.`;
      
      sendMessage(process.env.ADMIN_WHATSAPP, adminMsg).catch(err =>
        console.warn('Admin membership notification failed:', err.message));
    }
    
    res.json({ 
      ok: true, 
      message: 'Membership activated successfully!',
      membership: {
        zone: zoneId,
        zoneName: plan.zoneName,
        price: plan.price,
        credits: plan.deliveryCredits,
        startDate: now,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    });
  } catch (e) {
    console.error('Purchase membership error:', e);
    res.status(500).json({ ok: false, error: 'Failed to purchase membership' });
  }
});

// GET /api/membership/status - Get membership status for customer
app.get('/api/membership/status', (req, res) => {
  try {
    const { phone } = req.query;
    
    if (!phone) {
      return res.status(400).json({ ok: false, error: 'Phone required' });
    }
    
    const cleanPhone = String(phone).replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ ok: false, error: 'Invalid phone' });
    }
    
    const waPhone = `web:+91${cleanPhone}`;
    
    const customer = db.prepare(`
      SELECT membership_zone, membership_price, delivery_credits, membership_start
      FROM customers WHERE phone = ?
    `).get(waPhone);
    
    if (!customer || !customer.membership_zone) {
      return res.json({ ok: true, hasActiveMembership: false });
    }
    
    const startDate = new Date(customer.membership_start);
    const now = new Date();
    const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, 30 - daysSinceStart);
    
    // Check if expired
    if (daysRemaining === 0 || customer.delivery_credits === 0) {
      return res.json({ 
        ok: true, 
        hasActiveMembership: false,
        expired: true
      });
    }
    
    // Get zone name
    const settingsData = settings.get();
    const plan = (settingsData.membershipPlans || []).find(p => p.zoneId === customer.membership_zone);
    
    res.json({ 
      ok: true, 
      hasActiveMembership: true,
      membership: {
        zone: customer.membership_zone,
        zoneName: plan ? plan.zoneName : customer.membership_zone,
        price: customer.membership_price,
        credits: customer.delivery_credits,
        startDate: customer.membership_start,
        daysRemaining,
        benefits: plan ? plan.benefits : []
      }
    });
  } catch (e) {
    console.error('Get membership status error:', e);
    res.status(500).json({ ok: false, error: 'Failed to fetch status' });
  }
});

// ===== Admin: toggle stock (protected by ADMIN_KEY) =====
// Examples:
//   POST /admin/stock/C1?key=meatpe_admin_123&inStock=false
//   POST /admin/stock/C1?key=meatpe_admin_123&inStock=true
app.post('/admin/stock/:code', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const code = req.params.code;
  const inStock = String(req.query.inStock || 'true').toLowerCase() !== 'false';
  const result = setStock(code, inStock);
  if (!result.ok) return res.status(404).json(result);
  res.json(result);
});

// ===== Admin: view current stock state =====
app.get('/admin/stock', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  res.json(loadStock());
});

// ===== Admin: catalog CRUD =====

// List all items (with stock state) — admin only
app.get('/admin/items', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  res.json({ ok: true, items: catalogWithStock(), categories: VALID_CATEGORIES });
});

// Suggest next code for a category (e.g. 'chicken' -> 'C9')
app.get('/admin/items/next-code', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const code = suggestNextCode(req.query.cat);
  res.json({ ok: !!code, code: code || null });
});

// Add new item
app.post('/admin/items', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const result = addItem(req.body || {});
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

// Update existing item (price, name, unit, category, img)
app.put('/admin/items/:code', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const result = updateItem(req.params.code, req.body || {});
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

// Delete item
app.delete('/admin/items/:code', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const result = deleteItem(req.params.code);
  if (!result.ok) return res.status(404).json(result);
  res.json(result);
});

// ===== Admin: coupons CRUD =====
app.get('/admin/coupons', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  res.json({ ok: true, coupons: coupons.listAll() });
});
app.post('/admin/coupons', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const r = coupons.add(req.body || {});
  res.status(r.ok ? 200 : 400).json(r);
});
app.put('/admin/coupons/:code', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const r = coupons.update(req.params.code, req.body || {});
  res.status(r.ok ? 200 : 400).json(r);
});
app.delete('/admin/coupons/:code', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const r = coupons.remove(req.params.code);
  res.status(r.ok ? 200 : 404).json(r);
});

// ===== Admin: site settings =====
app.get('/admin/settings', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  res.json({ ok: true, settings: settings.get() });
});
app.put('/admin/settings', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const result = settings.update(req.body || {});
  res.json(result);
});
// Public settings (for frontend rendering)
app.get('/api/settings', (req, res) => {
  res.json(settings.get());
});

// ===== Admin: list orders =====
app.get('/admin/orders', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const status = req.query.status; // optional filter
  const source = req.query.source; // 'web' | 'whatsapp' | undefined
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const where = [];
  const params = [];
  if (status) { where.push('o.status = ?'); params.push(status); }
  if (source) { where.push('o.source = ?'); params.push(source); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = db.prepare(`
    SELECT o.*, c.name AS customer_name
    FROM orders o LEFT JOIN customers c ON c.phone = o.phone
    ${whereSql}
    ORDER BY o.id DESC LIMIT ?
  `).all(...params, limit);

  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(total),0) AS revenue,
      SUM(CASE WHEN status='placed'   THEN 1 ELSE 0 END) AS placed,
      SUM(CASE WHEN status='preparing' THEN 1 ELSE 0 END) AS preparing,
      SUM(CASE WHEN status='out_for_delivery' THEN 1 ELSE 0 END) AS out_for_delivery,
      SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
      SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled,
      SUM(CASE WHEN source='web'      THEN 1 ELSE 0 END) AS source_web,
      SUM(CASE WHEN source='whatsapp' THEN 1 ELSE 0 END) AS source_whatsapp
    FROM orders
  `).get();
  const today = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS revenue
    FROM orders WHERE date(created_at) = date('now', 'localtime')
  `).get();

  const orders = rows.map(r => ({
    id: r.id,
    phone: r.phone,
    name: r.customer_name || '',
    address: r.address,
    items: JSON.parse(r.items_json || '[]'),
    subtotal: r.subtotal,
    delivery_fee: r.delivery_fee,
    total: r.total,
    status: r.status,
    source: r.source || 'web',
    payment_method: r.payment_method || 'cod',
    delivery_slot: r.delivery_slot || 'asap',
    notes: r.notes || '',
    created_at: r.created_at,
  }));
  res.json({ ok: true, orders, stats, today });
});

// ===== Admin: update order status =====
app.post('/admin/orders/:id/status', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const id = parseInt(req.params.id, 10);
  const status = String(req.query.status || '').toLowerCase();
  const allowed = ['placed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: 'invalid status' });
  const info = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  if (info.changes === 0) return res.status(404).json({ ok: false, error: 'order not found' });

  // Fetch the updated order to notify customer
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  res.json({ ok: true, id, status });

  // Notify customer asynchronously
  if (order) {
    setImmediate(() => notifyCustomer(order, status));
  }
});

// ===== Admin: list all users =====
app.get('/admin/users', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  
  // Get unique users by normalized phone (remove prefixes like web:/whatsapp:)
  // Use clean_phone for grouping but also aggregate data from customers table
  const users = db.prepare(`
    SELECT 
      REPLACE(REPLACE(o.phone, 'whatsapp:', ''), 'web:', '') AS clean_phone,
      COUNT(DISTINCT o.id) AS total_orders,
      COALESCE(SUM(o.total), 0) AS total_spent,
      MAX(o.created_at) AS last_order_date,
      MAX(c.name) AS customer_name,
      MAX(c.wallet_balance) AS wallet_balance
    FROM orders o
    LEFT JOIN customers c ON REPLACE(REPLACE(c.phone, 'whatsapp:', ''), 'web:', '') = REPLACE(REPLACE(o.phone, 'whatsapp:', ''), 'web:', '')
    GROUP BY clean_phone
    ORDER BY total_orders DESC, last_order_date DESC
  `).all();

  const formatted = users.map(u => ({
    phone: u.clean_phone, // Return clean phone without prefix
    name: u.customer_name || 'Customer',
    wallet_balance: u.wallet_balance || 0,
    total_orders: u.total_orders || 0,
    total_spent: u.total_spent || 0,
    last_order_date: u.last_order_date
  }));

  res.json({ ok: true, users: formatted });
});

// ===== Admin: get user detail =====
app.get('/admin/users/:phone/detail', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  
  let phone = req.params.phone;
  
  // Clean: remove non-digits
  phone = phone.replace(/\D/g, '');
  if (phone.length !== 10) {
    return res.status(400).json({ ok: false, error: 'invalid phone' });
  }
  
  // Build the clean pattern for matching
  const cleanPattern = `%${phone}%`;
  
  try {
    // Get first matching phone from orders table with this clean phone
    const firstMatch = db.prepare(`
      SELECT phone FROM orders
      WHERE phone LIKE ?
      LIMIT 1
    `).get(cleanPattern);
    
    if (!firstMatch) {
      return res.status(404).json({ ok: false, error: 'user not found' });
    }
    
    const matchPhone = firstMatch.phone; // e.g., "web:+918126812317"
    
    // Now fetch all data using this exact phone
    const user = db.prepare(`
      SELECT 
        c.phone,
        c.name,
        c.wallet_balance,
        COUNT(DISTINCT o.id) AS total_orders,
        COALESCE(SUM(o.total), 0) AS total_spent,
        MIN(o.created_at) AS first_order_date,
        MAX(o.created_at) AS last_order_date
      FROM customers c
      LEFT JOIN orders o ON o.phone = c.phone
      WHERE c.phone = ?
      GROUP BY c.phone
    `).get(matchPhone);
    
    if (!user) {
      return res.status(404).json({ ok: false, error: 'user not found' });
    }
    
    // Recent orders
    const orders = db.prepare(`
      SELECT id, items_json, total, status, created_at, address
      FROM orders
      WHERE phone = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(matchPhone);
    
    // Top items
    const topItems = db.prepare(`
      SELECT 
        json_extract(value, '$.code') AS item_code,
        json_extract(value, '$.name') AS item_name,
        SUM(json_extract(value, '$.qty')) AS count
      FROM orders, json_each(orders.items_json)
      WHERE orders.phone = ?
      GROUP BY item_code
      ORDER BY count DESC
      LIMIT 5
    `).all(matchPhone);
    
    // Reviews
    const reviews = db.prepare(`
      SELECT r.id, r.item_code, r.rating, r.comment, r.created_at
      FROM reviews r
      WHERE r.phone = ?
      ORDER BY r.created_at DESC
      LIMIT 10
    `).all(matchPhone);
    
    // Add item names
    const catalogItems = getCatalog();
    const reviewsWithNames = reviews.map(r => {
      const item = catalogItems.find(i => i.code === r.item_code);
      return { ...r, item_name: item ? item.name : r.item_code };
    });
    
    // Average rating
    const avgRating = db.prepare(`
      SELECT AVG(rating) as avg_rating FROM reviews WHERE phone = ?
    `).get(matchPhone);
    
    // Addresses
    const addresses = db.prepare(`
      SELECT DISTINCT address, COUNT(*) as order_count
      FROM orders
      WHERE phone = ?
      GROUP BY address
      ORDER BY order_count DESC
    `).all(matchPhone);
    
    // Address breakdown
    const addressBreakdown = addresses.map(addr => {
      const addrOrders = db.prepare(`
        SELECT id, items_json, total, status, created_at
        FROM orders
        WHERE phone = ? AND address = ?
        ORDER BY created_at DESC
      `).all(matchPhone, addr.address);
      
      const addrTopItems = db.prepare(`
        SELECT 
          json_extract(value, '$.code') AS item_code,
          json_extract(value, '$.name') AS item_name,
          SUM(json_extract(value, '$.qty')) AS count
        FROM orders, json_each(orders.items_json)
        WHERE orders.phone = ? AND orders.address = ?
        GROUP BY item_code
        ORDER BY count DESC
        LIMIT 3
      `).all(matchPhone, addr.address);
      
      return {
        address: addr.address,
        order_count: addr.order_count,
        orders: addrOrders,
        top_items: addrTopItems
      };
    });
    
    const userDetail = {
      phone: phone, // Return clean 10 digits
      name: user.name || 'Customer',
      wallet_balance: user.wallet_balance || 0,
      total_orders: user.total_orders,
      total_spent: user.total_spent,
      first_order_date: user.first_order_date,
      last_order_date: user.last_order_date,
      orders,
      top_items: topItems,
      reviews: reviewsWithNames,
      avg_rating: avgRating?.avg_rating || 0,
      addresses: addresses,
      address_breakdown: addressBreakdown
    };
    
    res.json({ ok: true, user: userDetail });
  } catch (e) {
    console.error('User detail error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ===== Admin: list all reviews =====
app.get('/admin/reviews', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  
  try {
    const reviews = db.prepare(`
      SELECT 
        r.id,
        r.order_id,
        r.phone,
        r.item_code,
        r.rating,
        r.comment,
        r.created_at,
        c.name AS customer_name
      FROM reviews r
      LEFT JOIN customers c ON c.phone = r.phone
      ORDER BY r.created_at DESC
      LIMIT 100
    `).all();

    // Add item names from catalog
    const catalogItems = getCatalog();
    const reviewsWithItems = reviews.map(r => {
      const item = catalogItems.find(i => i.code === r.item_code);
      return {
        ...r,
        item_name: item ? item.name : r.item_code
      };
    });

    res.json({ ok: true, reviews: reviewsWithItems });
  } catch (e) {
    console.error('Reviews API error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ===== Admin: list all returns/refunds =====
app.get('/admin/returns', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  
  const returns = db.prepare(`
    SELECT 
      ret.id,
      ret.order_id,
      ret.phone,
      ret.reason,
      ret.description,
      ret.items_json,
      ret.status,
      ret.refund_amount,
      ret.refund_method,
      ret.admin_note,
      ret.created_at,
      ret.updated_at,
      c.name AS customer_name,
      o.total AS order_total
    FROM returns ret
    LEFT JOIN customers c ON c.phone = ret.phone
    LEFT JOIN orders o ON o.id = ret.order_id
    ORDER BY ret.created_at DESC
    LIMIT 100
  `).all();

  const formatted = returns.map(r => ({
    ...r,
    items: JSON.parse(r.items_json || '[]'),
  }));

  res.json({ ok: true, returns: formatted });
});

// ===== Admin: update return/refund status =====
app.post('/admin/returns/:id/status', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  
  const id = parseInt(req.params.id, 10);
  const { status, refund_amount, refund_method, admin_note } = req.body || {};
  
  const allowed = ['requested', 'approved', 'rejected', 'refunded'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ ok: false, error: 'invalid status' });
  }
  
  try {
    // Update return status
    const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [status];
    
    if (refund_amount !== undefined) {
      updates.push('refund_amount = ?');
      params.push(refund_amount);
    }
    if (refund_method) {
      updates.push('refund_method = ?');
      params.push(refund_method);
    }
    if (admin_note) {
      updates.push('admin_note = ?');
      params.push(admin_note);
    }
    
    params.push(id);
    
    const info = db.prepare(`UPDATE returns SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    
    if (info.changes === 0) {
      return res.status(404).json({ ok: false, error: 'return not found' });
    }
    
    res.json({ ok: true, id, status });
  } catch (e) {
    console.error('Update return status error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ===== Auth Service (Provider-based architecture) =====
const authService = require('./auth/auth.service');

// ===== Send OTP endpoint =====
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { phone, otpMethod } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ ok: false, error: 'Invalid phone number' });
    }
    
    // Use auth service (provider-agnostic)
    const result = await authService.sendOTP(cleanPhone, otpMethod || 'sms');
    
    if (result.ok) {
      return res.json({ 
        ok: true, 
        message: 'OTP sent successfully',
        sessionInfo: result.sessionInfo,
        dev_otp: result.dev_otp // Only in development
      });
    } else {
      return res.status(400).json({ ok: false, error: result.error });
    }
  } catch (error) {
    console.error('❌ Send OTP error:', error);
    return res.status(500).json({ ok: false, error: 'Failed to send OTP' });
  }
});

// ===== Verify OTP endpoint =====
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { phone, otp, referralCode, sessionInfo } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    
    console.log(`📞 [VERIFY-OTP] Request for phone: ${cleanPhone}, otp: ${otp}`);
    
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ ok: false, error: 'Invalid phone number' });
    }
    
    if (!otp || otp.length !== 6) {
      return res.status(400).json({ ok: false, error: 'Invalid OTP' });
    }
    
    // Use auth service (provider-agnostic)
    console.log(`🔐 [VERIFY-OTP] Calling authService.verifyOTP...`);
    const result = await authService.verifyOTP(cleanPhone, otp, sessionInfo);
    console.log(`🔐 [VERIFY-OTP] Result:`, result);
    
    if (!result.ok) {
      console.log(`❌ [VERIFY-OTP] Verification failed: ${result.error}`);
      return res.status(400).json({ ok: false, error: result.error });
    }
    
    console.log(`✅ [VERIFY-OTP] OTP verified successfully`);
    
    // OTP verified! Now handle customer creation/update
    const waPhone = `web:+91${cleanPhone}`;
    console.log(`📦 [VERIFY-OTP] Looking up customer: ${waPhone}`);
    
    // Check if new user
    let customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(waPhone);
    const isNewUser = !customer;
    
    console.log(`👤 [VERIFY-OTP] Customer found:`, isNewUser ? 'NEW USER' : 'EXISTING USER');
    
    let referralBonus = null;
    
    // Create or update customer
    if (isNewUser) {
      console.log(`🆕 [VERIFY-OTP] Creating new customer...`);
      // Handle referral code for new users
      let referredBy = null;
      if (referralCode) {
        const referrer = db.prepare('SELECT phone FROM customers WHERE referral_code = ?').get(referralCode);
        if (referrer) {
          referredBy = referrer.phone;
          
          // Give ₹20 bonus to new user
          const userReferralCode = `MEET${cleanPhone.slice(-4)}`;
          db.prepare(`
            INSERT INTO customers (phone, name, wallet_balance, referred_by, referral_code) 
            VALUES (?, '', 20, ?, ?)
          `).run(waPhone, referredBy, userReferralCode);
          
          // Give ₹100 bonus to referrer
          db.prepare(`
            UPDATE customers 
            SET wallet_balance = wallet_balance + 100 
            WHERE phone = ?
          `).run(referredBy);
          
          referralBonus = '₹20';
          console.log(`🎁 Referral: ${cleanPhone} used code ${referralCode}, got ₹20. Referrer got ₹100`);
        }
      }
      
      if (!referredBy) {
        // No referral - generate referral code for new user
        console.log(`📝 [VERIFY-OTP] Inserting customer without referral...`);
        const userReferralCode = `MEET${cleanPhone.slice(-4)}`;
        db.prepare(`INSERT INTO customers (phone, name, referral_code) VALUES (?, '', ?)`).run(waPhone, userReferralCode);
      }
    } else {
      // Existing user - just update last login
      console.log(`🔄 [VERIFY-OTP] Updating existing customer last login...`);
      db.prepare(`UPDATE customers SET updated_at = datetime('now') WHERE phone = ?`).run(waPhone);
    }
    
    // Get customer data
    console.log(`📊 [VERIFY-OTP] Fetching final customer data...`);
    customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(waPhone);
    
    if (!customer) {
      console.error(`❌ [VERIFY-OTP] Customer not found after insert! Phone: ${waPhone}`);
      return res.status(500).json({ ok: false, error: 'Failed to create customer account' });
    }
    
    console.log(`✅ [VERIFY-OTP] Success! Returning customer data...`);
    
    res.json({ 
      ok: true, 
      customer: { 
        phone: cleanPhone, 
        name: customer.name || '', 
        wallet: customer.wallet_balance || 0,
        membership_active: customer.is_plus && customer.plus_until && new Date(customer.plus_until) > new Date(),
        membership_expiry: customer.plus_until
      },
      referralBonus,
      isNewUser
    });
    
  } catch (error) {
    console.error('❌❌❌ [VERIFY-OTP] FATAL ERROR:', error);
    console.error('Stack:', error.stack);
    return res.status(500).json({ ok: false, error: 'Failed to verify OTP: ' + error.message });
  }
});

// ===== Customer auth (OLD - Keep for backward compatibility) =====
app.post('/api/auth/login', (req, res) => {
  const { phone, name } = req.body || {};
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
  const waPhone = `web:+91${cleanPhone}`;
  db.prepare(`INSERT INTO customers (phone, name) VALUES (?, ?) ON CONFLICT(phone) DO UPDATE SET name = COALESCE(excluded.name, name)`).run(waPhone, name || null);
  const customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(waPhone);
  res.json({ ok: true, customer: { phone: cleanPhone, name: customer.name || '', wallet: customer.wallet_balance || 0 } });
});

// ===== Get customer profile =====
app.get('/api/customer/:phone', (req, res) => {
  const cleanPhone = String(req.params.phone).replace(/\D/g, '');
  const waPhone = `web:+91${cleanPhone}`;
  const customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(waPhone);
  if (!customer) return res.json({ ok: true, customer: { phone: cleanPhone, name: '', wallet: 0, orders: 0, membership_active: false, referral_earnings: 0, referred_count: 0 } });
  const rewards = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM rewards WHERE phone = ? AND used = 0 AND expires_at > datetime('now')`).get(waPhone);
  const orderCount = db.prepare('SELECT COUNT(*) as cnt FROM orders WHERE phone = ?').get(waPhone);
  
  // Check if membership is still active
  const isMembershipActive = customer.is_plus && customer.plus_until && new Date(customer.plus_until) > new Date();
  
  // Count successful referrals
  const referredList = db.prepare(`
    SELECT COALESCE(COUNT(*), 0) as cnt FROM customers 
    WHERE referred_by = ? AND phone IN (SELECT DISTINCT phone FROM orders)
  `).get(customer.phone);
  const referralEarnings = (referredList?.cnt || 0) * 100;
  
  res.json({ 
    ok: true, 
    customer: { 
      phone: cleanPhone, 
      name: customer.name || '', 
      wallet: customer.wallet_balance || 0, 
      rewards: rewards.total, 
      orders: orderCount.cnt,
      membership_active: isMembershipActive,
      membership_expiry: customer.plus_until,
      referral_earnings: referralEarnings,
      referred_count: referredList?.cnt || 0
    } 
  });
});

// ===== Delete customer account =====
app.post('/api/customer/delete', (req, res) => {
  try {
    const { phone } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
    
    const waPhone = `web:+91${cleanPhone}`;
    const customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(waPhone);
    if (!customer) return res.status(404).json({ ok: false, error: 'customer not found' });
    
    // Delete customer data
    db.prepare('DELETE FROM customers WHERE phone = ?').run(waPhone);
    db.prepare('DELETE FROM orders WHERE phone = ?').run(waPhone);
    db.prepare('DELETE FROM reviews WHERE phone = ?').run(waPhone);
    db.prepare('DELETE FROM rewards WHERE phone = ?').run(waPhone);
    db.prepare('DELETE FROM sessions WHERE phone = ?').run(waPhone);
    
    console.log(`🗑️ Account deleted: ${cleanPhone}`);
    res.json({ ok: true, message: 'Account deleted successfully' });
  } catch (e) {
    console.error('Delete account error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to delete account' });
  }
});

// ===== Get customer orders (last 20) =====
app.get('/api/orders/:phone', (req, res) => {
  const cleanPhone = String(req.params.phone).replace(/\D/g, '');
  // Check both prefixes for backward compatibility
  const webPhone = `web:+91${cleanPhone}`;
  const waPhone = `whatsapp:+91${cleanPhone}`;
  const orders = db.prepare(`
    SELECT * FROM orders WHERE phone IN (?, ?)
    ORDER BY id DESC LIMIT 20
  `).all(webPhone, waPhone);
  res.json({ ok: true, orders: orders.map(o => ({ ...o, items: JSON.parse(o.items_json || '[]') })) });
});

// ===== Use wallet balance =====
app.post('/api/wallet/use', (req, res) => {
  const { phone, amount } = req.body || {};
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
  const deduct = parseInt(amount, 10) || 0;
  if (deduct <= 0) return res.status(400).json({ ok: false, error: 'invalid amount' });
  const waPhone = `web:+91${cleanPhone}`;
  const customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(waPhone);
  if (!customer) return res.status(404).json({ ok: false, error: 'customer not found' });
  if ((customer.wallet_balance || 0) < deduct) return res.status(400).json({ ok: false, error: 'insufficient wallet balance' });
  db.prepare('UPDATE customers SET wallet_balance = wallet_balance - ? WHERE phone = ?').run(deduct, waPhone);
  const updated = db.prepare('SELECT wallet_balance FROM customers WHERE phone = ?').get(waPhone);
  res.json({ ok: true, deducted: deduct, remaining: updated.wallet_balance });
});

// ===== Health (still works at /health) =====
app.get('/health', (req, res) => {
  res.send('🥩 MeatPe bot is running.');
});

// ===== Twilio WhatsApp inbound webhook =====
// Configure in Twilio Console → WhatsApp Sandbox → "When a message comes in":
//   POST https://<your-domain>/webhook/whatsapp
// Disable by setting WHATSAPP_BOT_ENABLED=off in .env
app.post('/webhook/whatsapp', (req, res) => {
  if (String(process.env.WHATSAPP_BOT_ENABLED || 'on').toLowerCase() === 'off') {
    res.set('Content-Type', 'text/xml');
    return res.send(twimlReply('Hi! For orders, please visit our website or message us on +91 76175 55488.'));
  }
  try {
    const from = req.body.From;        // "whatsapp:+91..."
    const body = req.body.Body || '';
    const reply = handleMessage({ from, body });
    res.set('Content-Type', 'text/xml');
    res.send(twimlReply(reply));

    // Notify admin on order keywords (optional; needs Twilio creds + admin number)
    if (/^✅ \*Order Placed/.test(reply) && process.env.ADMIN_WHATSAPP) {
      sendMessage(process.env.ADMIN_WHATSAPP, `🆕 New order from ${from}\n\n${reply}`).catch(() => {});
    }
  } catch (e) {
    console.error('whatsapp webhook err:', e);
    res.set('Content-Type', 'text/xml');
    res.send(twimlReply('Sorry, something went wrong. Type *hi* to start again.'));
  }
});

// ===== Instagram webhook (comments) =====
app.all('/webhook/instagram', handleInstagramWebhook);

// ===== Manual trigger: post to Instagram now =====
app.post('/admin/ig-post', async (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).send('forbidden');
  try {
    const r = await postRandomSample();
    res.json({ ok: true, result: r });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.response?.data || e.message });
  }
});

// ===== Auto-post schedule =====
// Daily 11:00 AM IST (= 05:30 UTC) — change as you wish
if (process.env.IG_ACCESS_TOKEN && process.env.IG_USER_ID) {
  cron.schedule('30 5 * * *', async () => {
    try {
      const r = await postRandomSample();
      console.log('🕚 Auto-posted:', r);
    } catch (e) {
      console.error('Auto-post failed:', e.response?.data || e.message);
    }
  });
  console.log('📅 IG auto-post scheduled (11:00 AM IST daily)');
}

// ===== Location debug (temp) =====
app.get('/api/location/debug', async (req, res) => {
  const gKey = process.env.GOOGLE_MAPS_KEY;
  const lKey = process.env.LOCATIONIQ_KEY;
  if (!gKey && !lKey) return res.json({ error: 'No API key set' });
  try {
    let url, r;
    if (lKey) {
      url = `https://us1.locationiq.com/v1/search?key=${lKey}&q=agra&format=json&limit=1`;
      r = await axios.get(url, { timeout: 8000 });
      return res.json({ provider: 'locationiq', count: (r.data||[]).length, sample: (r.data||[])[0] });
    } else {
      url = `https://maps.googleapis.com/maps/api/geocode/json?address=agra&region=in&key=${gKey}`;
      r = await axios.get(url, { timeout: 8000 });
      return res.json({ provider: 'google', status: r.data.status, count: (r.data.results||[]).length, error_message: r.data.error_message || null });
    }
  } catch(e) {
    res.json({ error: e.message });
  }
});

// ===== Location proxy =====
app.get('/api/location/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);
  const gKey = process.env.GOOGLE_MAPS_KEY;
  const lKey = process.env.LOCATIONIQ_KEY;
  if (!gKey && !lKey) return res.json([]);
  try {
    let results = [];
    if (lKey) {
      const url = `https://us1.locationiq.com/v1/search?key=${lKey}&q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6&countrycodes=in&normalizecity=1`;
      const r = await axios.get(url, { timeout: 8000 });
      results = (r.data || []).map(d => {
        const addr = d.address || {};
        const name = addr.road || addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city || (d.display_name||'').split(',')[0];
        return { lat: parseFloat(d.lat), lon: parseFloat(d.lon), name: name||'Location', city: addr.city||addr.town||'', state: addr.state||'', display: d.display_name||'' };
      });
    } else {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=in&language=en&key=${gKey}`;
      const r = await axios.get(url, { timeout: 8000 });
      results = (r.data.results || []).slice(0,6).map(d => {
        const comps = d.address_components || [];
        const get = (type) => (comps.find(c => c.types.includes(type)) || {}).long_name || '';
        const name = get('sublocality_level_1') || get('sublocality') || get('neighborhood') || get('route') || get('locality') || d.formatted_address.split(',')[0];
        return { lat: d.geometry.location.lat, lon: d.geometry.location.lng, name: name||'Location', city: get('locality')||'', state: get('administrative_area_level_1')||'', display: d.formatted_address||'' };
      });
    }
    res.json(results);
  } catch (e) {
    console.warn('location search error:', e.message);
    res.json([]);
  }
});

app.get('/api/location/reverse', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (isNaN(lat) || isNaN(lon)) return res.json({ ok: false });
  
  try {
    let area = '', city = '', state = '', displayName = '';
    const gKey = process.env.GOOGLE_MAPS_KEY;
    const lKey = process.env.LOCATIONIQ_KEY;
    
    if (lKey) {
      // LocationIQ API
      const url = `https://us1.locationiq.com/v1/reverse?key=${lKey}&lat=${lat}&lon=${lon}&format=json&normalizecity=1`;
      const r = await axios.get(url, { timeout: 8000 });
      const addr = r.data.address || {};
      area = addr.suburb || addr.neighbourhood || addr.quarter || addr.village || addr.road || '';
      city = addr.city || addr.town || addr.county || '';
      state = addr.state || '';
      displayName = r.data.display_name || '';
    } else if (gKey) {
      // Google Maps API
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&language=en&key=${gKey}`;
      const r = await axios.get(url, { timeout: 8000 });
      const result = (r.data.results||[])[0];
      if (result) {
        const comps = result.address_components || [];
        const get = (type) => (comps.find(c => c.types.includes(type)) || {}).long_name || '';
        area = get('sublocality_level_1') || get('sublocality') || get('neighborhood') || get('route') || '';
        city = get('locality') || get('administrative_area_level_2') || '';
        state = get('administrative_area_level_1') || '';
        displayName = result.formatted_address || '';
      }
    } else {
      // FREE: Use OpenStreetMap Nominatim (no API key needed)
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&zoom=16&accept-language=en`;
      const r = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'NOW-MeatPe' } });
      const addr = r.data.address || {};
      area = addr.neighbourhood || addr.suburb || addr.quarter || addr.village || addr.road || addr.hamlet || '';
      city = addr.city || addr.town || addr.county || '';
      state = addr.state || '';
      displayName = r.data.display_name || '';
    }
    
    const stateAbbr = state.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,3);
    const shortLabel = area && city && area !== city ? `${area}, ${city}` : (city || area || 'My Location');
    const label = stateAbbr ? `${shortLabel}, ${stateAbbr}` : shortLabel;
    res.json({ ok: true, label, full: displayName, area, city, state });
  } catch (e) {
    console.warn('reverse geocode error:', e.message);
    res.json({ ok: false, label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, full: 'Location detected' });
  }
});

// GET /admin/customers?key=X - list all customers with order count + wallet
app.get('/admin/customers', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const search = req.query.search || '';
  let sql = `SELECT c.*, 
    COUNT(o.id) as order_count,
    COALESCE(SUM(o.total),0) as lifetime_value,
    MAX(o.created_at) as last_order
    FROM customers c
    LEFT JOIN orders o ON o.phone = c.phone
    ${search ? "WHERE c.phone LIKE ? OR c.name LIKE ?" : ""}
    GROUP BY c.phone
    ORDER BY last_order DESC LIMIT ?`;
  const params = search ? [`%${search}%`, `%${search}%`, limit] : [limit];
  const customers = db.prepare(sql).all(...params);
  res.json({ ok: true, customers });
});

// PUT /admin/customers/:phone/wallet?key=X - add/set wallet balance
app.put('/admin/customers/:phone/wallet', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const phone = decodeURIComponent(req.params.phone);
  const { amount, action } = req.body || {}; // action: 'add' | 'set'
  const val = parseInt(amount, 10) || 0;
  if (action === 'add') {
    db.prepare('UPDATE customers SET wallet_balance = wallet_balance + ? WHERE phone = ?').run(val, phone);
  } else {
    db.prepare('UPDATE customers SET wallet_balance = ? WHERE phone = ?').run(val, phone);
  }
  const c = db.prepare('SELECT wallet_balance FROM customers WHERE phone = ?').get(phone);
  res.json({ ok: true, wallet: c ? c.wallet_balance : 0 });
});

// GET /admin/analytics?key=X - comprehensive analytics
app.get('/admin/analytics', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  
  // Revenue by day (last 30 days)
  const daily = db.prepare(`
    SELECT date(created_at, 'localtime') as day,
    COUNT(*) as orders, COALESCE(SUM(total),0) as revenue
    FROM orders WHERE status != 'cancelled'
    AND created_at >= datetime('now', '-30 days')
    GROUP BY day ORDER BY day ASC
  `).all();

  // Top selling items
  const allOrders = db.prepare(`SELECT items_json FROM orders WHERE status != 'cancelled'`).all();
  const itemSales = {};
  for (const o of allOrders) {
    try {
      const items = JSON.parse(o.items_json || '[]');
      for (const i of items) {
        if (!itemSales[i.name]) itemSales[i.name] = { qty: 0, revenue: 0 };
        itemSales[i.name].qty += i.qty;
        itemSales[i.name].revenue += i.price * i.qty;
      }
    } catch {}
  }
  const topItems = Object.entries(itemSales)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Orders by hour
  const byHour = db.prepare(`
    SELECT strftime('%H', created_at, 'localtime') as hour, COUNT(*) as count
    FROM orders GROUP BY hour ORDER BY hour
  `).all();

  // Summary stats
  const summary = db.prepare(`
    SELECT COUNT(*) as total_orders,
    COALESCE(SUM(CASE WHEN status!='cancelled' THEN total ELSE 0 END),0) as total_revenue,
    COUNT(DISTINCT phone) as unique_customers,
    COALESCE(AVG(CASE WHEN status!='cancelled' THEN total END),0) as avg_order_value
    FROM orders
  `).get();

  // This week vs last week
  const thisWeek = db.prepare(`SELECT COUNT(*) as orders, COALESCE(SUM(total),0) as revenue FROM orders WHERE status!='cancelled' AND created_at >= datetime('now', '-7 days')`).get();
  const lastWeek = db.prepare(`SELECT COUNT(*) as orders, COALESCE(SUM(total),0) as revenue FROM orders WHERE status!='cancelled' AND created_at BETWEEN datetime('now', '-14 days') AND datetime('now', '-7 days')`).get();

  res.json({ ok: true, daily, topItems, byHour, summary, thisWeek, lastWeek });
});

// ===== Returns & Refunds =====

// DB table created in init.js — adding via ALTER if not exists
try {
  db.exec(`CREATE TABLE IF NOT EXISTS returns (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id     INTEGER NOT NULL,
    phone        TEXT NOT NULL,
    reason       TEXT NOT NULL,
    description  TEXT,
    items_json   TEXT,
    status       TEXT DEFAULT 'requested',
    refund_amount INTEGER DEFAULT 0,
    refund_method TEXT,
    admin_note   TEXT,
    created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at   TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
} catch(e) { console.warn('returns table:', e.message); }

// POST /api/returns — customer submits return request
app.post('/api/returns', (req, res) => {
  const { phone, order_id, reason, description, items } = req.body || {};
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
  if (!order_id || !reason) return res.status(400).json({ ok: false, error: 'order_id and reason required' });

  const webPhone = `web:+91${cleanPhone}`;
  const waPhone = `whatsapp:+91${cleanPhone}`;

  // Verify order belongs to customer (both phone formats)
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND (phone = ? OR phone = ?)').get(order_id, webPhone, waPhone);
  if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
  if (order.status === 'cancelled') return res.status(400).json({ ok: false, error: 'Cannot return a cancelled order' });

  // Check if return already exists
  const existing = db.prepare('SELECT id FROM returns WHERE order_id = ? AND (phone = ? OR phone = ?)').get(order_id, webPhone, waPhone);
  if (existing) return res.status(400).json({ ok: false, error: 'Return request already submitted for this order' });

  const info = db.prepare(`INSERT INTO returns (order_id, phone, reason, description, items_json) VALUES (?, ?, ?, ?, ?)`)
    .run(order_id, webPhone, reason.trim(), (description || '').trim(), JSON.stringify(items || []));
  res.json({ ok: true, id: info.lastInsertRowid });
});

// GET /api/returns/:phone — customer's return requests
app.get('/api/returns/:phone', (req, res) => {
  const cleanPhone = String(req.params.phone).replace(/\D/g, '');
  const waPhone = `web:+91${cleanPhone}`;
  const returns = db.prepare('SELECT * FROM returns WHERE phone = ? ORDER BY id DESC').all(waPhone);
  res.json({ ok: true, returns });
});

// GET /admin/returns?key=X — list all returns
app.get('/admin/returns', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const status = req.query.status || '';
  const rows = db.prepare(`
    SELECT r.*, c.name as customer_name, o.total as order_total
    FROM returns r
    LEFT JOIN customers c ON c.phone = r.phone
    LEFT JOIN orders o ON o.id = r.order_id
    ${status ? 'WHERE r.status = ?' : ''}
    ORDER BY r.id DESC LIMIT 100
  `).all(...(status ? [status] : []));
  const stats = db.prepare(`SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status='requested' THEN 1 ELSE 0 END) as requested,
    SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved,
    SUM(CASE WHEN status='refunded' THEN 1 ELSE 0 END) as refunded,
    SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) as rejected,
    COALESCE(SUM(CASE WHEN status='refunded' THEN refund_amount ELSE 0 END),0) as total_refunded
  FROM returns`).get();
  res.json({ ok: true, returns: rows, stats });
});

// PUT /admin/returns/:id?key=X — update return status
app.put('/admin/returns/:id', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const { status, refund_amount, refund_method, admin_note } = req.body || {};
  const allowed = ['requested', 'approved', 'rejected', 'refunded', 'processing'];
  if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: 'invalid status' });
  db.prepare(`UPDATE returns SET status=?, refund_amount=?, refund_method=?, admin_note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(status, refund_amount || 0, refund_method || '', admin_note || '', req.params.id);
  // If refunded — add to customer wallet
  if (status === 'refunded' && refund_amount > 0) {
    const ret = db.prepare('SELECT phone FROM returns WHERE id=?').get(req.params.id);
    if (ret) db.prepare('UPDATE customers SET wallet_balance = wallet_balance + ? WHERE phone = ?').run(refund_amount, ret.phone);
  }
  res.json({ ok: true });
});

// ===== Inventory Management =====

// GET /admin/inventory?key=X — full inventory with stock levels
app.get('/admin/inventory', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const { outOfStock } = loadStock();
  const catalog = getCatalog();
  const oosUpper = outOfStock.map(c => c.toUpperCase());
  const inventory = catalog.map(item => ({
    code: item.code,
    name: item.name,
    cat: item.cat,
    price: item.price,
    unit: item.unit,
    sku: item.sku || item.code,
    inStock: !oosUpper.includes(item.code.toUpperCase()),
    lowStock: item.lowStock || false,
    stockQty: item.stockQty || null,
  }));
  const totalItems = inventory.length;
  const inStockCount = inventory.filter(i => i.inStock).length;
  const outOfStockCount = inventory.filter(i => !i.inStock).length;
  res.json({ ok: true, inventory, stats: { totalItems, inStockCount, outOfStockCount } });
});

// POST /admin/inventory/:code?key=X — update stock qty + low stock flag
app.post('/admin/inventory/:code', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const { inStock, lowStock, stockQty, sku } = req.body || {};
  const code = req.params.code;
  // Update stock state
  if (typeof inStock === 'boolean') setStock(code, inStock);
  // Update catalog item with extra inventory fields
  const catalog = getCatalog();
  const idx = catalog.findIndex(i => i.code.toUpperCase() === code.toUpperCase());
  if (idx === -1) return res.status(404).json({ ok: false, error: 'item not found' });
  if (typeof lowStock === 'boolean') catalog[idx].lowStock = lowStock;
  if (stockQty !== undefined) catalog[idx].stockQty = parseInt(stockQty) || null;
  if (sku) catalog[idx].sku = sku.trim();
  // Write back
  const fs = require('fs');
  const path = require('path');
  const catalogFile = path.join(__dirname, '..', 'data', 'catalog.json');
  fs.writeFileSync(catalogFile, JSON.stringify(catalog, null, 2));
  res.json({ ok: true, code });
});

// GET /admin/inventory/alerts?key=X — low stock + out of stock alerts
app.get('/admin/inventory/alerts', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const { outOfStock } = loadStock();
  const catalog = getCatalog();
  const oosUpper = outOfStock.map(c => c.toUpperCase());
  const alerts = [];
  for (const item of catalog) {
    if (oosUpper.includes(item.code.toUpperCase())) {
      alerts.push({ type: 'out_of_stock', code: item.code, name: item.name, cat: item.cat });
    } else if (item.lowStock) {
      alerts.push({ type: 'low_stock', code: item.code, name: item.name, cat: item.cat, qty: item.stockQty });
    }
  }
  res.json({ ok: true, alerts, outOfStockCount: oosUpper.length, lowStockCount: alerts.filter(a => a.type === 'low_stock').length });
});

// ===== Reviews & Ratings =====

// POST /api/reviews — submit review (customer)
app.post('/api/reviews', (req, res) => {
  const { phone, order_id, item_code, rating, comment, delivery_rating } = req.body || {};
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
  const r = parseInt(rating, 10);
  if (!r || r < 1 || r > 5) return res.status(400).json({ ok: false, error: 'rating must be 1-5' });
  if (!item_code) return res.status(400).json({ ok: false, error: 'item_code required' });
  const delRating = delivery_rating ? Math.min(5, Math.max(1, parseInt(delivery_rating, 10))) : null;

  // Support both phone prefixes
  const webPhone = `web:+91${cleanPhone}`;
  const waPhone = `whatsapp:+91${cleanPhone}`;

  // Verify order belongs to customer (check both phone formats)
  if (order_id) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND (phone = ? OR phone = ?)').get(order_id, webPhone, waPhone);
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
    if (order.status === 'cancelled') return res.status(400).json({ ok: false, error: 'Cannot review a cancelled order' });
    const existing = db.prepare('SELECT id FROM reviews WHERE order_id = ? AND item_code = ? AND (phone = ? OR phone = ?)').get(order_id, item_code, webPhone, waPhone);
    if (existing) return res.status(400).json({ ok: false, error: 'Already reviewed' });
  }

  // Add delivery_rating column if not exists
  try { db.prepare('ALTER TABLE reviews ADD COLUMN delivery_rating INTEGER').run(); } catch(e) {}

  const info = db.prepare(`INSERT INTO reviews (order_id, phone, item_code, rating, comment, delivery_rating, status) VALUES (?, ?, ?, ?, ?, ?, 'approved')`)
    .run(order_id || null, webPhone, item_code, r, (comment || '').trim().slice(0, 500), delRating);
  res.json({ ok: true, id: info.lastInsertRowid });
});

// GET /api/reviews/user/:phone — get user's submitted reviews
app.get('/api/reviews/user/:phone', (req, res) => {
  const cleanPhone = String(req.params.phone).replace(/\D/g, '');
  if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
  const webPhone = `web:+91${cleanPhone}`;
  const waPhone = `whatsapp:+91${cleanPhone}`;
  
  const reviews = db.prepare(`
    SELECT r.id, r.order_id, r.item_code, r.rating, r.comment, r.delivery_rating, r.created_at, r.status
    FROM reviews r
    WHERE r.phone IN (?, ?)
    ORDER BY r.created_at DESC LIMIT 50
  `).all(webPhone, waPhone);
  
  res.json({ ok: true, reviews });
});

// GET /api/reviews/:item_code — public reviews for a product
app.get('/api/reviews/:item_code', (req, res) => {
  const rows = db.prepare(`
    SELECT r.id, r.rating, r.comment, r.created_at, c.name as customer_name
    FROM reviews r LEFT JOIN customers c ON c.phone = r.phone
    WHERE r.item_code = ? AND r.status = 'approved'
    ORDER BY r.created_at DESC LIMIT 20
  `).all(req.params.item_code);
  const stats = db.prepare(`SELECT COUNT(*) as count, ROUND(AVG(rating),1) as avg FROM reviews WHERE item_code = ? AND status = 'approved'`).get(req.params.item_code);
  res.json({ ok: true, reviews: rows, stats });
});

// GET /api/reviews/check/:phone/:order_id — check which items user already reviewed
app.get('/api/reviews/check/:phone/:order_id', (req, res) => {
  const cleanPhone = String(req.params.phone || '').replace(/\D/g, '');
  if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
  const webPhone = `web:+91${cleanPhone}`;
  const waPhone = `whatsapp:+91${cleanPhone}`;
  const orderId = parseInt(req.params.order_id, 10);
  
  const reviewedItems = db.prepare(`
    SELECT DISTINCT item_code FROM reviews 
    WHERE order_id = ? AND (phone = ? OR phone = ?)
  `).all(orderId, webPhone, waPhone).map(r => r.item_code);
  
  res.json({ ok: true, reviewed: reviewedItems });
});

// GET /admin/reviews?key=X — list all reviews (admin)
app.get('/admin/reviews', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const status = req.query.status || '';
  const rows = db.prepare(`
    SELECT r.*, c.name as customer_name
    FROM reviews r LEFT JOIN customers c ON c.phone = r.phone
    ${status ? 'WHERE r.status = ?' : ''}
    ORDER BY r.created_at DESC LIMIT 200
  `).all(...(status ? [status] : []));
  res.json({ ok: true, reviews: rows });
});

// PUT /admin/reviews/:id?key=X — approve/reject/delete
app.put('/admin/reviews/:id', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const { status } = req.body || {};
  const allowed = ['approved', 'rejected', 'pending'];
  if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: 'invalid status' });
  db.prepare('UPDATE reviews SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

app.delete('/admin/reviews/:id', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ===== Admin: customers list =====
app.get('/admin/customers', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const search = req.query.search || '';
  let sql, params;
  if (search) {
    sql = `SELECT c.*, COUNT(o.id) as order_count, COALESCE(SUM(o.total),0) as lifetime_value, MAX(o.created_at) as last_order
      FROM customers c LEFT JOIN orders o ON o.phone = c.phone
      WHERE c.phone LIKE ? OR c.name LIKE ?
      GROUP BY c.phone ORDER BY last_order DESC LIMIT ?`;
    params = [`%${search}%`, `%${search}%`, limit];
  } else {
    sql = `SELECT c.*, COUNT(o.id) as order_count, COALESCE(SUM(o.total),0) as lifetime_value, MAX(o.created_at) as last_order
      FROM customers c LEFT JOIN orders o ON o.phone = c.phone
      GROUP BY c.phone ORDER BY last_order DESC LIMIT ?`;
    params = [limit];
  }
  const customers = db.prepare(sql).all(...params);
  res.json({ ok: true, customers });
});

// ===== Admin: update customer wallet =====
app.put('/admin/customers/:phone/wallet', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const phone = decodeURIComponent(req.params.phone);
  const { amount, action } = req.body || {};
  const val = parseInt(amount, 10) || 0;
  if (action === 'add') {
    db.prepare('UPDATE customers SET wallet_balance = wallet_balance + ? WHERE phone = ?').run(val, phone);
  } else {
    db.prepare('UPDATE customers SET wallet_balance = ? WHERE phone = ?').run(Math.max(0, val), phone);
  }
  const c = db.prepare('SELECT wallet_balance FROM customers WHERE phone = ?').get(phone);
  res.json({ ok: true, wallet: c ? c.wallet_balance : 0 });
});

// ===== Admin: analytics =====
app.get('/admin/analytics', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const daily = db.prepare(`
    SELECT date(created_at, 'localtime') as day,
    COUNT(*) as orders, COALESCE(SUM(total),0) as revenue
    FROM orders WHERE status != 'cancelled' AND created_at >= datetime('now', '-30 days')
    GROUP BY day ORDER BY day ASC
  `).all();
  const allOrders = db.prepare(`SELECT items_json FROM orders WHERE status != 'cancelled'`).all();
  const itemSales = {};
  for (const o of allOrders) {
    try {
      for (const i of JSON.parse(o.items_json || '[]')) {
        if (!itemSales[i.name]) itemSales[i.name] = { qty: 0, revenue: 0 };
        itemSales[i.name].qty += i.qty;
        itemSales[i.name].revenue += i.price * i.qty;
      }
    } catch {}
  }
  const topItems = Object.entries(itemSales).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const byHour = db.prepare(`SELECT strftime('%H', created_at, 'localtime') as hour, COUNT(*) as count FROM orders GROUP BY hour ORDER BY hour`).all();
  const summary = db.prepare(`SELECT COUNT(*) as total_orders, COALESCE(SUM(CASE WHEN status!='cancelled' THEN total ELSE 0 END),0) as total_revenue, COUNT(DISTINCT phone) as unique_customers, COALESCE(AVG(CASE WHEN status!='cancelled' THEN total END),0) as avg_order_value FROM orders`).get();
  const thisWeek = db.prepare(`SELECT COUNT(*) as orders, COALESCE(SUM(total),0) as revenue FROM orders WHERE status!='cancelled' AND created_at >= datetime('now', '-7 days')`).get();
  const lastWeek = db.prepare(`SELECT COUNT(*) as orders, COALESCE(SUM(total),0) as revenue FROM orders WHERE status!='cancelled' AND created_at BETWEEN datetime('now', '-14 days') AND datetime('now', '-7 days')`).get();
  res.json({ ok: true, daily, topItems, byHour, summary, thisWeek, lastWeek });
});

// ===== SUBSCRIPTIONS (Recurring Orders) =====

// Create subscriptions table if not exists
try {
  db.exec(`CREATE TABLE IF NOT EXISTS subscriptions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    phone            TEXT NOT NULL,
    name             TEXT,
    address          TEXT,
    items_json       TEXT NOT NULL,
    frequency        TEXT NOT NULL,
    next_delivery    TEXT,
    status           TEXT DEFAULT 'active',
    total_price      INTEGER NOT NULL,
    cycles_remaining INTEGER,
    notes            TEXT,
    created_at       TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at       TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phone, id)
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS subscription_orders (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id  INTEGER NOT NULL,
    order_id         INTEGER,
    scheduled_date   TEXT,
    status           TEXT DEFAULT 'scheduled',
    created_at       TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(subscription_id) REFERENCES subscriptions(id),
    FOREIGN KEY(order_id) REFERENCES orders(id)
  )`);
} catch(e) { console.warn('subscriptions table:', e.message); }

// ===== NOTIFICATIONS SYSTEM =====

// Create notifications table if not exists
try {
  db.exec(`CREATE TABLE IF NOT EXISTS notifications (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    phone        TEXT NOT NULL,
    type         TEXT NOT NULL,
    channel      TEXT DEFAULT 'whatsapp',
    subject      TEXT,
    message      TEXT NOT NULL,
    status       TEXT DEFAULT 'pending',
    sent_at      TEXT,
    error        TEXT,
    created_at   TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS notification_templates (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT UNIQUE NOT NULL,
    subject  TEXT,
    body     TEXT NOT NULL,
    channels TEXT,
    active   BOOLEAN DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
} catch(e) { console.warn('notifications table:', e.message); }

// Initialize default notification templates
function initNotificationTemplates() {
  const templates = [
    {
      name: 'order_placed',
      subject: 'Order Confirmed',
      body: '✅ *Order Confirmed!* — {SHOP_NAME}\n\nOrder #{ORDER_ID}\nTotal: ₹{TOTAL}\nETA: ~30 minutes 🛵\n\n📍 Delivery to:\n{ADDRESS}\n\nThank you for ordering!',
      channels: 'whatsapp,email'
    },
    {
      name: 'order_preparing',
      subject: 'Order Preparing',
      body: '👨‍🍳 *Your order is being prepared* — {SHOP_NAME}\n\nOrder #{ORDER_ID}\nWe\'re cleaning + cutting your meat fresh right now.',
      channels: 'whatsapp,sms'
    },
    {
      name: 'order_out_for_delivery',
      subject: 'Out for Delivery',
      body: '🛵 *Out for delivery!* — {SHOP_NAME}\n\nOrder #{ORDER_ID}\nYour fresh meat is on the way. ETA: {ETA} minutes.\n\nTotal: ₹{TOTAL}',
      channels: 'whatsapp,sms'
    },
    {
      name: 'order_delivered',
      subject: 'Order Delivered',
      body: '✅ *Order Delivered* — {SHOP_NAME}\n\nOrder #{ORDER_ID}\nThank you for ordering! Enjoy your fresh meat 🥩\n\nIf any issue, reply within 2 hours with a photo.',
      channels: 'whatsapp,email,sms'
    },
    {
      name: 'order_cancelled',
      subject: 'Order Cancelled',
      body: '❌ *Order Cancelled* — {SHOP_NAME}\n\nOrder #{ORDER_ID}\nYour order has been cancelled. Refund will be processed shortly.',
      channels: 'whatsapp,email'
    }
  ];
  
  for (const tpl of templates) {
    try {
      db.prepare(`INSERT OR IGNORE INTO notification_templates (name, subject, body, channels, active) VALUES (?, ?, ?, ?, 1)`)
        .run(tpl.name, tpl.subject, tpl.body, tpl.channels);
    } catch (e) {
      // Template already exists
    }
  }
}

initNotificationTemplates();

// Helper: Send notification through multiple channels
async function sendNotificationViaChannels(phone, template, variables = {}, channels = ['whatsapp']) {
  const results = [];
  
  for (const channel of channels) {
    try {
      let sent = false;
      let message = template.body;
      
      // Replace variables
      for (const [key, val] of Object.entries(variables)) {
        message = message.replace(new RegExp(`{${key}}`, 'g'), val);
      }
      
      if (channel === 'whatsapp' && process.env.TWILIO_ACCOUNT_SID) {
        try {
          await sendMessage(`whatsapp:+91${phone.replace(/\D/g, '')}`, message);
          sent = true;
        } catch (e) {
          console.warn(`WhatsApp send failed: ${e.message}`);
        }
      }
      
      if (channel === 'sms' && process.env.TWILIO_ACCOUNT_SID) {
        try {
          // SMS via Twilio (optional — requires SMS credits)
          // await twilio.messages.create({ from: process.env.TWILIO_PHONE, to: `+91${phone}`, body: message });
          sent = false; // Disabled by default to save costs
        } catch (e) {
          console.warn(`SMS send failed: ${e.message}`);
        }
      }
      
      if (channel === 'email') {
        // Email notification (requires email service like SendGrid, Nodemailer)
        // For now, just log it
        console.log(`📧 Email to ${phone}: ${template.subject}`);
        sent = false;
      }
      
      results.push({ channel, sent });
    } catch (e) {
      console.warn(`Notification error on channel ${channel}:`, e.message);
      results.push({ channel, sent: false, error: e.message });
    }
  }
  
  return results;
}

// POST /api/notifications/subscribe — subscribe for notifications
app.post('/api/notifications/subscribe', (req, res) => {
  try {
    const { phone, email, channels } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
    
    const waPhone = `web:+91${cleanPhone}`;
    const validChannels = channels || ['whatsapp'];
    
    db.prepare(`
      INSERT INTO customers (phone, email) VALUES (?, ?)
      ON CONFLICT(phone) DO UPDATE SET email = COALESCE(excluded.email, email)
    `).run(waPhone, email || null);
    
    res.json({ ok: true, message: 'Subscribed to notifications', channels: validChannels });
  } catch (e) {
    console.error('notification subscribe error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// POST /api/notifications/test — test notification (with admin key)
app.post('/api/notifications/test', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  try {
    const { phone, message, channel = 'whatsapp' } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
    
    // Send test message
    if (channel === 'whatsapp' && process.env.TWILIO_ACCOUNT_SID) {
      sendMessage(`whatsapp:+91${cleanPhone}`, message || '🧪 Test notification from MeatPe').catch(e => {
        console.warn('Test message failed:', e.message);
      });
    }
    
    res.json({ ok: true, message: 'Test notification sent', channel });
  } catch (e) {
    console.error('notification test error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// GET /api/notifications/:phone — get notification history
app.get('/api/notifications/:phone', (req, res) => {
  try {
    const cleanPhone = String(req.params.phone).replace(/\D/g, '');
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const waPhone = `web:+91${cleanPhone}`;
    
    const notifications = db.prepare(`
      SELECT * FROM notifications WHERE phone = ?
      ORDER BY created_at DESC LIMIT ?
    `).all(waPhone, limit);
    
    res.json({ ok: true, notifications });
  } catch (e) {
    console.error('get notifications error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// GET /admin/notifications?key=X — list all notifications (admin)
app.get('/admin/notifications', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  try {
    const status = req.query.status || '';
    const type = req.query.type || '';
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    
    let where = [];
    let params = [];
    if (status) { where.push('status = ?'); params.push(status); }
    if (type) { where.push('type = ?'); params.push(type); }
    
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const notifications = db.prepare(`
      SELECT * FROM notifications ${whereSql}
      ORDER BY created_at DESC LIMIT ?
    `).all(...params, limit);
    
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed
      FROM notifications
    `).get();
    
    res.json({ ok: true, notifications, stats });
  } catch (e) {
    console.error('admin notifications error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// GET /admin/notification-templates?key=X — list templates
app.get('/admin/notification-templates', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  try {
    const templates = db.prepare('SELECT * FROM notification_templates ORDER BY name').all();
    res.json({ ok: true, templates });
  } catch (e) {
    console.error('get templates error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// PUT /admin/notification-templates/:id?key=X — update template
app.put('/admin/notification-templates/:id', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  try {
    const { subject, body, channels, active } = req.body || {};
    const id = parseInt(req.params.id, 10);
    
    const updates = [];
    const values = [];
    if (subject !== undefined) { updates.push('subject = ?'); values.push(subject); }
    if (body !== undefined) { updates.push('body = ?'); values.push(body); }
    if (channels !== undefined) { updates.push('channels = ?'); values.push(channels); }
    if (active !== undefined) { updates.push('active = ?'); values.push(active ? 1 : 0); }
    
    if (updates.length === 0) return res.status(400).json({ ok: false, error: 'no updates provided' });
    
    values.push(id);
    db.prepare(`UPDATE notification_templates SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    res.json({ ok: true });
  } catch (e) {
    console.error('update template error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// Webhook support: POST /api/webhooks/notify — custom webhook notifications
app.post('/api/webhooks/notify', (req, res) => {
  try {
    const { phone, event, data, signature } = req.body || {};
    
    // Verify webhook signature (optional security)
    if (process.env.WEBHOOK_SECRET && signature) {
      const crypto = require('crypto');
      const hash = crypto.createHmac('sha256', process.env.WEBHOOK_SECRET)
        .update(JSON.stringify({ phone, event, data }))
        .digest('hex');
      if (hash !== signature) return res.status(403).json({ ok: false, error: 'invalid signature' });
    }
    
    // Log webhook notification
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
    
    const waPhone = `web:+91${cleanPhone}`;
    const message = data?.message || `Event: ${event}`;
    
    db.prepare(`
      INSERT INTO notifications (phone, type, channel, message, status)
      VALUES (?, ?, 'webhook', ?, 'sent')
    `).run(waPhone, event || 'webhook', message);
    
    res.json({ ok: true, message: 'Webhook notification logged' });
  } catch (e) {
    console.error('webhook error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// ===== VENDOR/SELLER MANAGEMENT =====

// Create vendors table
try {
  db.exec(`CREATE TABLE IF NOT EXISTS vendors (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    phone            TEXT UNIQUE NOT NULL,
    name             TEXT NOT NULL,
    business_name    TEXT NOT NULL,
    email            TEXT,
    address          TEXT,
    city             TEXT,
    state            TEXT,
    gst_number       TEXT,
    bank_account     TEXT,
    bank_ifsc        TEXT,
    commission_rate  REAL DEFAULT 0.15,
    status           TEXT DEFAULT 'pending',
    document_urls    TEXT,
    verified_at      TEXT,
    created_at       TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at       TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS vendor_products (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id      INTEGER NOT NULL,
    code           TEXT NOT NULL,
    name           TEXT NOT NULL,
    description    TEXT,
    price          INTEGER NOT NULL,
    unit           TEXT DEFAULT 'kg',
    category       TEXT,
    image_urls     TEXT,
    status         TEXT DEFAULT 'active',
    created_at     TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(vendor_id) REFERENCES vendors(id)
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS vendor_payouts (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id        INTEGER NOT NULL,
    period_start     TEXT NOT NULL,
    period_end       TEXT NOT NULL,
    orders_count     INTEGER DEFAULT 0,
    gross_amount     INTEGER DEFAULT 0,
    commission_amount INTEGER DEFAULT 0,
    net_amount       INTEGER DEFAULT 0,
    status           TEXT DEFAULT 'pending',
    payout_date      TEXT,
    notes            TEXT,
    created_at       TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(vendor_id) REFERENCES vendors(id)
  )`);
} catch(e) { console.warn('vendors table:', e.message); }

// POST /api/vendors/register — register new vendor
app.post('/api/vendors/register', (req, res) => {
  try {
    const { phone, name, businessName, email, gst } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
    if (!name || !businessName) return res.status(400).json({ ok: false, error: 'name and businessName required' });
    
    const waPhone = `vendor:+91${cleanPhone}`;
    const info = db.prepare(`
      INSERT INTO vendors (phone, name, business_name, email, gst_number, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(waPhone, name.trim(), businessName.trim(), email || null, gst || null);
    
    res.json({ ok: true, vendor_id: info.lastInsertRowid, status: 'pending', message: 'Registration submitted. Admin review required.' });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.status(400).json({ ok: false, error: 'Phone already registered' });
    }
    console.error('vendor register error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// GET /api/vendors/:id — get vendor details
app.get('/api/vendors/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(id);
    if (!vendor) return res.status(404).json({ ok: false, error: 'vendor not found' });
    
    // Don't expose sensitive data publicly
    const safe = {
      id: vendor.id,
      name: vendor.name,
      business_name: vendor.business_name,
      city: vendor.city,
      status: vendor.status,
      created_at: vendor.created_at
    };
    res.json({ ok: true, vendor: safe });
  } catch (e) {
    console.error('get vendor error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// PUT /api/vendors/:id — vendor updates own profile
app.put('/api/vendors/:id', (req, res) => {
  try {
    const { phone, address, city, state, bankAccount, bankIfsc } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const id = parseInt(req.params.id, 10);
    
    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(id);
    if (!vendor) return res.status(404).json({ ok: false, error: 'vendor not found' });
    
    // Verify ownership by phone
    if (vendor.phone !== `vendor:+91${cleanPhone}`) {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }
    
    const updates = [];
    const values = [];
    if (address) { updates.push('address = ?'); values.push(address); }
    if (city) { updates.push('city = ?'); values.push(city); }
    if (state) { updates.push('state = ?'); values.push(state); }
    if (bankAccount) { updates.push('bank_account = ?'); values.push(bankAccount); }
    if (bankIfsc) { updates.push('bank_ifsc = ?'); values.push(bankIfsc); }
    
    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);
      db.prepare(`UPDATE vendors SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    
    res.json({ ok: true });
  } catch (e) {
    console.error('update vendor error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// GET /admin/vendors?key=X — list all vendors (admin)
app.get('/admin/vendors', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  try {
    const status = req.query.status || '';
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    
    let sql = 'SELECT v.*, COUNT(DISTINCT o.id) as order_count FROM vendors v LEFT JOIN vendor_products vp ON vp.vendor_id = v.id LEFT JOIN orders o ON o.id IN (SELECT id FROM orders WHERE items_json LIKE ?) GROUP BY v.id';
    let params = ['%' + v.id + '%'];
    
    if (status) {
      sql = 'SELECT v.* FROM vendors v WHERE v.status = ? ORDER BY v.created_at DESC LIMIT ?';
      params = [status, limit];
    } else {
      sql = 'SELECT v.* FROM vendors v ORDER BY v.created_at DESC LIMIT ?';
      params = [limit];
    }
    
    const vendors = db.prepare(sql).all(...params);
    
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) as rejected
      FROM vendors
    `).get();
    
    res.json({ ok: true, vendors, stats });
  } catch (e) {
    console.error('list vendors error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// POST /admin/vendors/:id/approve?key=X — approve vendor
app.post('/admin/vendors/:id/approve', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  try {
    const id = parseInt(req.params.id, 10);
    db.prepare('UPDATE vendors SET status = ?, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('approved', id);
    res.json({ ok: true });
  } catch (e) {
    console.error('approve vendor error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// POST /admin/vendors/:id/reject?key=X — reject vendor
app.post('/admin/vendors/:id/reject', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  try {
    const { reason } = req.body || {};
    const id = parseInt(req.params.id, 10);
    db.prepare('UPDATE vendors SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('rejected', reason || null, id);
    res.json({ ok: true });
  } catch (e) {
    console.error('reject vendor error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// GET /api/vendors/:id/orders — get vendor's orders
app.get('/api/vendors/:id/orders', (req, res) => {
  try {
    const vendorId = parseInt(req.params.id, 10);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    
    // Get vendor's products
    const products = db.prepare('SELECT code FROM vendor_products WHERE vendor_id = ?').all(vendorId);
    const productCodes = products.map(p => p.code);
    
    if (!productCodes.length) {
      return res.json({ ok: true, orders: [], total: 0 });
    }
    
    // Find orders containing vendor's products
    const allOrders = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT ?').all(limit);
    const vendorOrders = allOrders.filter(o => {
      const items = JSON.parse(o.items_json || '[]');
      return items.some(i => productCodes.includes(i.code));
    });
    
    res.json({ ok: true, orders: vendorOrders.map(o => ({ ...o, items: JSON.parse(o.items_json) })), total: vendorOrders.length });
  } catch (e) {
    console.error('vendor orders error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// GET /api/vendors/:id/analytics — vendor analytics
app.get('/api/vendors/:id/analytics', (req, res) => {
  try {
    const vendorId = parseInt(req.params.id, 10);
    
    // Get vendor's products
    const products = db.prepare('SELECT * FROM vendor_products WHERE vendor_id = ?').all(vendorId);
    const productCodes = products.map(p => p.code);
    
    // Calculate revenue from vendor products
    let totalRevenue = 0;
    let totalOrders = 0;
    const allOrders = db.prepare('SELECT * FROM orders WHERE status = ?').all('delivered');
    
    for (const order of allOrders) {
      const items = JSON.parse(order.items_json || '[]');
      for (const item of items) {
        if (productCodes.includes(item.code)) {
          totalRevenue += item.price * item.qty;
          totalOrders++;
        }
      }
    }
    
    const commission = totalRevenue * 0.15; // 15% commission
    
    res.json({ ok: true, analytics: {
      products: products.length,
      total_orders: totalOrders,
      total_revenue: totalRevenue,
      commission: Math.round(commission),
      net_revenue: Math.round(totalRevenue - commission)
    }});
  } catch (e) {
    console.error('vendor analytics error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// GET /admin/vendor-payouts?key=X — list all vendor payouts
app.get('/admin/vendor-payouts', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  try {
    const status = req.query.status || '';
    let sql = 'SELECT vp.*, v.name as vendor_name FROM vendor_payouts vp LEFT JOIN vendors v ON v.id = vp.vendor_id';
    let params = [];
    
    if (status) {
      sql += ' WHERE vp.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY vp.created_at DESC LIMIT 100';
    
    const payouts = db.prepare(sql).all(...params);
    
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status='processed' THEN 1 ELSE 0 END) as processed,
        COALESCE(SUM(CASE WHEN status='pending' THEN net_amount ELSE 0 END),0) as pending_amount
      FROM vendor_payouts
    `).get();
    
    res.json({ ok: true, payouts, stats });
  } catch (e) {
    console.error('vendor payouts error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// POST /admin/vendor-payouts/:id/process?key=X — mark payout as processed
app.post('/admin/vendor-payouts/:id/process', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  try {
    const id = parseInt(req.params.id, 10);
    db.prepare('UPDATE vendor_payouts SET status = ?, payout_date = CURRENT_TIMESTAMP WHERE id = ?')
      .run('processed', id);
    res.json({ ok: true });
  } catch (e) {
    console.error('process payout error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// ===== MOBILE APP APIs =====

// POST /api/mobile/login — quick mobile login
app.post('/api/mobile/login', (req, res) => {
  try {
    const { phone, name, deviceId } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
    
    const waPhone = `app:+91${cleanPhone}`;
    db.prepare(`INSERT INTO customers (phone, name) VALUES (?, ?) ON CONFLICT(phone) DO UPDATE SET name = COALESCE(excluded.name, name)`)
      .run(waPhone, name || null);
    
    const customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(waPhone);
    const rewards = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM rewards WHERE phone = ? AND used = 0 AND expires_at > datetime('now')`).get(waPhone);
    
    res.json({ ok: true, customer: { phone: cleanPhone, name: customer.name || '', wallet: customer.wallet_balance || 0, rewards: rewards.total || 0 }, deviceId });
  } catch (e) {
    console.error('mobile login error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// GET /api/mobile/home — home feed for mobile app
app.get('/api/mobile/home', (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    
    const catalog = catalogWithStock();
    
    // Categorize items
    const byCategory = {};
    for (const item of catalog) {
      if (!byCategory[item.cat]) byCategory[item.cat] = [];
      byCategory[item.cat].push(item);
    }
    
    // Get trending (most ordered in last 7 days)
    const allOrders = db.prepare(`
      SELECT items_json FROM orders 
      WHERE status = 'delivered' 
      AND created_at >= datetime('now', '-7 days')
    `).all();
    
    const itemFreq = {};
    for (const o of allOrders) {
      try {
        for (const i of JSON.parse(o.items_json || '[]')) {
          itemFreq[i.code] = (itemFreq[i.code] || 0) + 1;
        }
      } catch {}
    }
    
    const trending = catalog
      .filter(c => itemFreq[c.code])
      .sort((a, b) => (itemFreq[b.code] || 0) - (itemFreq[a.code] || 0))
      .slice(0, 8);
    
    // Active coupons
    const activeCoupons = coupons.listActive().map(c => ({
      code: c.code,
      value: c.value,
      type: c.type,
      minOrder: c.minOrder,
      description: c.description
    }));
    
    res.json({
      ok: true,
      home: {
        trending,
        categories: Object.keys(byCategory).slice(0, 6),
        categoryItems: Object.fromEntries(
          Object.entries(byCategory).map(([cat, items]) => [cat, items.slice(0, 5)])
        ),
        coupons: activeCoupons.slice(0, 3)
      }
    });
  } catch (e) {
    console.error('mobile home error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// GET /api/mobile/search — mobile search with filters
app.get('/api/mobile/search', (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase();
    const cat = (req.query.cat || '').toLowerCase();
    const maxPrice = parseInt(req.query.maxPrice, 10) || 10000;
    
    let catalog = catalogWithStock();
    
    // Filter by search
    if (q) {
      catalog = catalog.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.code.toLowerCase().includes(q)
      );
    }
    
    // Filter by category
    if (cat) {
      catalog = catalog.filter(i => i.cat.toLowerCase().includes(cat));
    }
    
    // Filter by price
    catalog = catalog.filter(i => i.price <= maxPrice);
    
    // Sort by relevance/price
    catalog.sort((a, b) => a.price - b.price);
    
    res.json({ ok: true, results: catalog.slice(0, 50) });
  } catch (e) {
    console.error('mobile search error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// POST /api/mobile/cart/validate — validate cart before checkout
app.post('/api/mobile/cart/validate', (req, res) => {
  try {
    const { items, couponCode } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ ok: false, error: 'items required' });
    }
    
    // Validate items
    const cleanItems = [];
    let subtotal = 0;
    
    for (const it of items) {
      const found = findByCode(it.code);
      if (!found) continue;
      const { outOfStock } = loadStock();
      if (outOfStock.map(c => c.toUpperCase()).includes(found.code.toUpperCase())) continue;
      
      const qty = Math.max(1, parseInt(it.qty, 10) || 1);
      cleanItems.push({ code: found.code, name: found.name, price: found.price, qty });
      subtotal += found.price * qty;
    }
    
    if (!cleanItems.length) return res.status(400).json({ ok: false, error: 'no valid items' });
    
    // Apply coupon
    let discount = 0;
    if (couponCode) {
      const result = coupons.applyCoupon(couponCode, subtotal);
      if (result.ok) discount = result.discount;
    }
    
    // Calculate delivery
    const free = Number(process.env.DELIVERY_FREE_ABOVE || 699);
    const lowBelow = Number(process.env.DELIVERY_LOW_BELOW || 399);
    const feeLow = Number(process.env.DELIVERY_FEE_LOW || 29);
    const feeMid = Number(process.env.DELIVERY_FEE_MID || 19);
    const delivery = subtotal >= free ? 0 : (subtotal < lowBelow ? feeLow : feeMid);
    const total = Math.max(0, subtotal - discount + delivery);
    
    res.json({
      ok: true,
      cart: {
        items: cleanItems,
        subtotal,
        couponDiscount: discount,
        delivery,
        total,
        saveable: discount + (free - subtotal > 0 ? free - subtotal : 0)
      }
    });
  } catch (e) {
    console.error('cart validate error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// POST /api/mobile/checkout — quick checkout for mobile
app.post('/api/mobile/checkout', (req, res) => {
  try {
    const { phone, name, address, items, couponCode, paymentMethod, lat, lon } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
    if (!address) return res.status(400).json({ ok: false, error: 'address required' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ ok: false, error: 'items required' });
    
    // Validate items server-side
    const cleanItems = [];
    for (const it of items) {
      const found = findByCode(it.code);
      if (!found) continue;
      const qty = Math.max(1, parseInt(it.qty, 10) || 1);
      cleanItems.push({ code: found.code, name: found.name, price: found.price, qty });
    }
    if (!cleanItems.length) return res.status(400).json({ ok: false, error: 'no valid items' });
    
    const subtotal = cleanItems.reduce((s, i) => s + i.price * i.qty, 0);
    
    // Apply coupon
    let couponDiscount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      const result = coupons.applyCoupon(couponCode, subtotal);
      if (result.ok) {
        couponDiscount = result.discount;
        appliedCoupon = result.coupon.code;
      }
    }
    
    const free = Number(process.env.DELIVERY_FREE_ABOVE || 699);
    const lowBelow = Number(process.env.DELIVERY_LOW_BELOW || 399);
    const feeLow = Number(process.env.DELIVERY_FEE_LOW || 29);
    const feeMid = Number(process.env.DELIVERY_FEE_MID || 19);
    const delivery = subtotal >= free ? 0 : (subtotal < lowBelow ? feeLow : feeMid);
    const total = Math.max(0, subtotal - couponDiscount + delivery);
    
    const waPhone = `app:+91${cleanPhone}`;
    db.prepare(`INSERT INTO customers (phone, name, address) VALUES (?, ?, ?) ON CONFLICT(phone) DO UPDATE SET name = excluded.name, address = excluded.address`)
      .run(waPhone, name || 'Mobile User', address);
    
    const orderInfo = db.prepare(`
      INSERT INTO orders (phone, items_json, subtotal, delivery_fee, total, address, source)
      VALUES (?, ?, ?, ?, ?, ?, 'mobile_app')
    `).run(waPhone, JSON.stringify(cleanItems), subtotal, delivery, total, address);
    
    const orderId = orderInfo.lastInsertRowid;
    
    res.json({
      ok: true,
      order: {
        id: orderId,
        subtotal,
        couponDiscount,
        delivery,
        total,
        paymentMethod,
        location: lat && lon ? { lat, lon } : null
      }
    });
    
    // Async notification
    setImmediate(() => {
      notifyCustomer({ id: orderId, phone: waPhone, address, total }, 'placed');
    });
  } catch (e) {
    console.error('mobile checkout error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// POST /api/subscriptions — create subscription
app.post('/api/subscriptions', (req, res) => {
  try {
    const { phone, name, address, items, frequency, cyclesRemaining, notes } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ ok: false, error: 'items required' });
    if (!['daily', 'weekly', 'biweekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({ ok: false, error: 'frequency must be daily, weekly, biweekly, or monthly' });
    }
    
    // Validate items and calculate total
    const cleanItems = [];
    let total = 0;
    for (const it of items) {
      const found = findByCode(it.code);
      if (!found) continue;
      const qty = Math.max(1, parseInt(it.qty, 10) || 1);
      cleanItems.push({ code: found.code, name: found.name, price: found.price, qty });
      total += found.price * qty;
    }
    if (!cleanItems.length) return res.status(400).json({ ok: false, error: 'no valid items' });
    
    const waPhone = `web:+91${cleanPhone}`;
    
    // Calculate next delivery date based on frequency
    const nextDate = new Date();
    switch(frequency) {
      case 'daily': nextDate.setDate(nextDate.getDate() + 1); break;
      case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
      case 'biweekly': nextDate.setDate(nextDate.getDate() + 14); break;
      case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
    }
    
    const info = db.prepare(`
      INSERT INTO subscriptions (phone, name, address, items_json, frequency, next_delivery, total_price, cycles_remaining, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      waPhone,
      name || 'Regular Customer',
      address || '',
      JSON.stringify(cleanItems),
      frequency,
      nextDate.toISOString().split('T')[0],
      total,
      cyclesRemaining || null,
      (notes || '').trim()
    );
    
    res.json({ ok: true, id: info.lastInsertRowid, nextDelivery: nextDate.toISOString().split('T')[0], total });
  } catch (e) {
    console.error('subscription create error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// GET /api/subscriptions/:phone — list customer's subscriptions
app.get('/api/subscriptions/:phone', (req, res) => {
  try {
    const cleanPhone = String(req.params.phone).replace(/\D/g, '');
    const waPhone = `web:+91${cleanPhone}`;
    const subs = db.prepare(`
      SELECT * FROM subscriptions WHERE phone = ? ORDER BY id DESC
    `).all(waPhone);
    res.json({ 
      ok: true, 
      subscriptions: subs.map(s => ({
        ...s, 
        items: JSON.parse(s.items_json || '[]')
      }))
    });
  } catch (e) {
    console.error('subscription list error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// PUT /api/subscriptions/:id — update subscription (pause, resume, modify items)
app.put('/api/subscriptions/:id', (req, res) => {
  try {
    const { phone, status, items, notes, frequency, cyclesRemaining } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const waPhone = `web:+91${cleanPhone}`;
    const id = parseInt(req.params.id, 10);
    
    // Verify ownership
    const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ? AND phone = ?').get(id, waPhone);
    if (!sub) return res.status(404).json({ ok: false, error: 'subscription not found' });
    
    const updates = [];
    const values = [];
    
    if (status && ['active', 'paused', 'cancelled'].includes(status)) {
      updates.push('status = ?');
      values.push(status);
    }
    if (items && Array.isArray(items) && items.length) {
      const cleanItems = [];
      let total = 0;
      for (const it of items) {
        const found = findByCode(it.code);
        if (!found) continue;
        const qty = Math.max(1, parseInt(it.qty, 10) || 1);
        cleanItems.push({ code: found.code, name: found.name, price: found.price, qty });
        total += found.price * qty;
      }
      if (cleanItems.length) {
        updates.push('items_json = ?, total_price = ?');
        values.push(JSON.stringify(cleanItems), total);
      }
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push((notes || '').trim());
    }
    if (frequency && ['daily', 'weekly', 'biweekly', 'monthly'].includes(frequency)) {
      updates.push('frequency = ?');
      values.push(frequency);
    }
    if (cyclesRemaining !== undefined) {
      updates.push('cycles_remaining = ?');
      values.push(cyclesRemaining || null);
    }
    
    if (updates.length === 0) return res.status(400).json({ ok: false, error: 'no updates provided' });
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    db.prepare(`UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    res.json({ ok: true });
  } catch (e) {
    console.error('subscription update error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// POST /api/subscriptions/:id/cancel — cancel subscription
app.post('/api/subscriptions/:id/cancel', (req, res) => {
  try {
    const { phone } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    const waPhone = `web:+91${cleanPhone}`;
    const id = parseInt(req.params.id, 10);
    
    const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ? AND phone = ?').get(id, waPhone);
    if (!sub) return res.status(404).json({ ok: false, error: 'subscription not found' });
    
    db.prepare('UPDATE subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('cancelled', id);
    res.json({ ok: true });
  } catch (e) {
    console.error('subscription cancel error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// GET /admin/subscriptions?key=X — list all subscriptions (admin)
app.get('/admin/subscriptions', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  try {
    const status = req.query.status || '';
    let sql = `SELECT s.*, c.name as customer_name FROM subscriptions s
      LEFT JOIN customers c ON c.phone = s.phone`;
    if (status) {
      sql += ` WHERE s.status = ?`;
    }
    sql += ` ORDER BY s.id DESC LIMIT 100`;
    const subs = db.prepare(sql).all(...(status ? [status] : []));
    
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status='paused' THEN 1 ELSE 0 END) as paused,
        SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) as cancelled,
        COALESCE(SUM(total_price),0) as total_mrr
      FROM subscriptions WHERE status = 'active'
    `).get();
    
    res.json({ 
      ok: true, 
      subscriptions: subs.map(s => ({ ...s, items: JSON.parse(s.items_json || '[]') })),
      stats 
    });
  } catch (e) {
    console.error('admin subscriptions error:', e);
    res.status(500).json({ ok: false, error: 'server error' });
  }
});

// Cron job: Auto-generate orders from active subscriptions
cron.schedule('0 6 * * *', async () => {
  console.log('🔄 [SUBSCRIPTION CRON] Processing recurring orders...');
  try {
    const today = new Date().toISOString().split('T')[0];
    const dueSubscriptions = db.prepare(`
      SELECT * FROM subscriptions 
      WHERE status = 'active' 
      AND next_delivery <= ?
      AND (cycles_remaining IS NULL OR cycles_remaining > 0)
    `).all(today);
    
    for (const sub of dueSubscriptions) {
      // Create order from subscription
      const items = JSON.parse(sub.items_json || '[]');
      const waPhone = sub.phone;
      const free = Number(process.env.DELIVERY_FREE_ABOVE || 699);
      const lowBelow = Number(process.env.DELIVERY_LOW_BELOW || 399);
      const feeLow = Number(process.env.DELIVERY_FEE_LOW || 29);
      const feeMid = Number(process.env.DELIVERY_FEE_MID || 19);
      const delivery = sub.total_price >= free ? 0 : (sub.total_price < lowBelow ? feeLow : feeMid);
      const total = Math.max(0, sub.total_price + delivery);
      
      const orderInfo = db.prepare(`
        INSERT INTO orders (phone, items_json, subtotal, delivery_fee, total, address, source)
        VALUES (?, ?, ?, ?, ?, ?, 'subscription')
      `).run(waPhone, sub.items_json, sub.total_price, delivery, total, sub.address);
      
      const orderId = orderInfo.lastInsertRowid;
      
      // Link to subscription
      db.prepare(`
        INSERT INTO subscription_orders (subscription_id, order_id, scheduled_date, status)
        VALUES (?, ?, ?, 'created')
      `).run(sub.id, orderId, today);
      
      // Update next delivery date
      const nextDate = new Date();
      switch(sub.frequency) {
        case 'daily': nextDate.setDate(nextDate.getDate() + 1); break;
        case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
        case 'biweekly': nextDate.setDate(nextDate.getDate() + 14); break;
        case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
      }
      
      let cyclesLeft = sub.cycles_remaining;
      if (cyclesLeft !== null) cyclesLeft--;
      
      const updateStatus = cyclesLeft === 0 ? 'completed' : 'active';
      db.prepare(`
        UPDATE subscriptions 
        SET next_delivery = ?, cycles_remaining = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(nextDate.toISOString().split('T')[0], cyclesLeft, updateStatus, sub.id);
      
      console.log(`  ✅ Order #${orderId} created from subscription #${sub.id} for ${waPhone}`);
      
      // Notify customer
      setImmediate(() => {
        const customer = db.prepare('SELECT name FROM customers WHERE phone = ?').get(waPhone);
        notifyCustomer(
          { id: orderId, phone: waPhone, address: sub.address, total },
          'placed'
        );
      });
    }
  } catch (e) {
    console.error('subscription cron error:', e);
  }
});

// ===== RAZORPAY WALLET TOP-UP =====

// POST /api/wallet/topup/order — create Razorpay order
app.post('/api/wallet/topup/order', async (req, res) => {
  try {
    const { phone, amount } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
    const amt = parseInt(amount, 10);
    if (!amt || amt < 10 || amt > 10000) return res.status(400).json({ ok: false, error: 'amount must be ₹10–₹10000' });

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return res.status(500).json({ ok: false, error: 'Payment not configured' });

    // Create order via Razorpay API
    const orderRes = await axios.post(
      'https://api.razorpay.com/v1/orders',
      { amount: amt * 100, currency: 'INR', receipt: `wallet_${cleanPhone}_${Date.now()}` },
      { auth: { username: keyId, password: keySecret }, timeout: 10000 }
    );

    res.json({ ok: true, order: orderRes.data, keyId });
  } catch (e) {
    console.error('Razorpay order error:', e.response?.data || e.message);
    res.status(500).json({ ok: false, error: 'Could not create payment order' });
  }
});

// POST /api/wallet/topup/verify — verify payment & credit wallet
app.post('/api/wallet/topup/verify', (req, res) => {
  try {
    const { phone, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) return res.status(500).json({ ok: false, error: 'Payment not configured' });

    // Verify signature
    const crypto = require('crypto');
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSig = crypto.createHmac('sha256', keySecret).update(body).digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({ ok: false, error: 'Payment verification failed' });
    }

    // Credit wallet
    const amt = parseInt(amount, 10);
    const waPhone = `web:+91${cleanPhone}`;
    db.prepare('UPDATE customers SET wallet_balance = wallet_balance + ? WHERE phone = ?').run(amt, waPhone);
    const updated = db.prepare('SELECT wallet_balance FROM customers WHERE phone = ?').get(waPhone);

    console.log(`💳 Wallet topped up: +₹${amt} for ${cleanPhone} (${razorpay_payment_id})`);
    res.json({ ok: true, wallet: updated ? updated.wallet_balance : amt });
  } catch (e) {
    console.error('Razorpay verify error:', e.message);
    res.status(500).json({ ok: false, error: 'Verification failed' });
  }
});

// ===== Referral System =====
// POST /api/referral/apply - apply referral code during signup
app.post('/api/referral/apply', (req, res) => {
  try {
    const { phone, referral_code } = req.body || {};
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });

    // Don't apply referral to the referrer
    const referrerPhone = `web:+91${referral_code.slice(-4)}`;
    if (referrerPhone === `web:+91${cleanPhone}`) {
      return res.json({ ok: true, message: 'Valid code' }); // Silent ignore self-referral
    }

    // Store referral info
    const waPhone = `web:+91${cleanPhone}`;
    db.prepare('UPDATE customers SET referred_by = ? WHERE phone = ?').run(referral_code, waPhone);
    
    console.log(`📤 Referral applied: ${referral_code} → ${cleanPhone}`);
    res.json({ ok: true, message: 'Referral applied' });
  } catch (e) {
    console.error('Referral apply error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to apply referral' });
  }
});

// GET /api/referral/earnings/:phone - get referral earnings
app.get('/api/referral/earnings/:phone', (req, res) => {
  try {
    const cleanPhone = String(req.params.phone).replace(/\D/g, '');
    const waPhone = `web:+91${cleanPhone}`;
    
    const customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(waPhone);
    if (!customer) return res.json({ ok: true, earnings: 0, referred_count: 0 });
    
    // Count successful referrals (those who have placed at least 1 order)
    const referredList = db.prepare(`
      SELECT COALESCE(COUNT(*), 0) as cnt FROM customers 
      WHERE referred_by = ? AND phone IN (SELECT DISTINCT phone FROM orders)
    `).get(customer.phone);
    
    const referralEarnings = (referredList?.cnt || 0) * 100; // ₹100 per successful referral
    
    res.json({ ok: true, earnings: referralEarnings, referred_count: referredList?.cnt || 0 });
  } catch (e) {
    console.error('Referral earnings error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to get earnings' });
  }
});

// ═══════════════════════════════════════════
//  Live Chat System
// ═══════════════════════════════════════════
try {
  db.exec(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    sender TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    name TEXT,
    category TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    admin_reply TEXT,
    replied_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
} catch(e) { console.warn('chat/ticket table:', e.message); }

// POST /api/ticket/submit — user submits ticket
app.post('/api/ticket/submit', (req, res) => {
  const { phone, name, category, message } = req.body || {};
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
  if (!category || !message || !message.trim()) return res.status(400).json({ ok: false, error: 'category and message required' });
  
  const webPhone = `web:+91${cleanPhone}`;
  const info = db.prepare('INSERT INTO support_tickets (phone, name, category, message) VALUES (?, ?, ?, ?)')
    .run(webPhone, name || '', category, message.trim().slice(0, 2000));
  res.json({ ok: true, ticketId: info.lastInsertRowid });
});

// GET /api/tickets/:phone — user's tickets
app.get('/api/tickets/:phone', (req, res) => {
  const cleanPhone = String(req.params.phone).replace(/\D/g, '');
  if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
  const webPhone = `web:+91${cleanPhone}`;
  const tickets = db.prepare('SELECT * FROM support_tickets WHERE phone = ? ORDER BY created_at DESC LIMIT 20').all(webPhone);
  res.json({ ok: true, tickets });
});

// GET /admin/tickets — all tickets (admin)
app.get('/admin/tickets', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const status = req.query.status || '';
  let tickets;
  if (status) {
    tickets = db.prepare('SELECT * FROM support_tickets WHERE status = ? ORDER BY created_at DESC LIMIT 100').all(status);
  } else {
    tickets = db.prepare('SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 100').all();
  }
  res.json({ ok: true, tickets });
});

// POST /admin/ticket/reply — admin replies to ticket
app.post('/admin/ticket/reply', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const { ticketId, reply, status } = req.body || {};
  if (!ticketId) return res.status(400).json({ ok: false, error: 'ticketId required' });
  
  const updates = [];
  const params = [];
  if (reply) { updates.push('admin_reply = ?'); params.push(reply.trim()); updates.push("replied_at = datetime('now')"); }
  if (status) { updates.push('status = ?'); params.push(status); }
  if (!updates.length) return res.status(400).json({ ok: false, error: 'nothing to update' });
  
  params.push(ticketId);
  db.prepare(`UPDATE support_tickets SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ ok: true });
});

// POST /api/ticket/reply — user adds more info to ticket
app.post('/api/ticket/reply', (req, res) => {
  const { phone, ticketId, message } = req.body || {};
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
  if (!ticketId || !message || !message.trim()) return res.status(400).json({ ok: false, error: 'ticketId and message required' });
  
  const webPhone = `web:+91${cleanPhone}`;
  
  // Verify ticket belongs to user
  const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ? AND phone = ?').get(ticketId, webPhone);
  if (!ticket) return res.status(404).json({ ok: false, error: 'ticket not found' });
  
  // Append user reply to the message
  const updatedMessage = ticket.message + '\n\n--- User Update (' + new Date().toLocaleDateString('en-IN') + ') ---\n' + message.trim();
  db.prepare('UPDATE support_tickets SET message = ? WHERE id = ?').run(updatedMessage, ticketId);
  res.json({ ok: true });
});

// POST /api/chat/send — user sends message
app.post('/api/chat/send', (req, res) => {
  const { phone, message } = req.body || {};
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
  if (!message || !message.trim()) return res.status(400).json({ ok: false, error: 'empty message' });
  
  const webPhone = `web:+91${cleanPhone}`;
  db.prepare('INSERT INTO chat_messages (phone, sender, message) VALUES (?, ?, ?)').run(webPhone, 'user', message.trim().slice(0, 1000));
  res.json({ ok: true });
});

// GET /api/chat/messages/:phone — get chat history for user
app.get('/api/chat/messages/:phone', (req, res) => {
  const cleanPhone = String(req.params.phone).replace(/\D/g, '');
  if (cleanPhone.length !== 10) return res.status(400).json({ ok: false, error: 'invalid phone' });
  const webPhone = `web:+91${cleanPhone}`;
  
  const messages = db.prepare('SELECT * FROM chat_messages WHERE phone = ? ORDER BY created_at ASC LIMIT 100').all(webPhone);
  res.json({ ok: true, messages });
});

// GET /admin/chats — get all active chats (admin)
app.get('/admin/chats', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  
  // Get unique phones with last message
  const chats = db.prepare(`
    SELECT phone, MAX(created_at) as last_message_at, 
    (SELECT message FROM chat_messages m2 WHERE m2.phone = m1.phone ORDER BY m2.created_at DESC LIMIT 1) as last_message,
    (SELECT sender FROM chat_messages m3 WHERE m3.phone = m1.phone ORDER BY m3.created_at DESC LIMIT 1) as last_sender,
    COUNT(*) as total_messages
    FROM chat_messages m1
    GROUP BY phone
    ORDER BY last_message_at DESC
    LIMIT 50
  `).all();
  
  // Get customer names
  const result = chats.map(chat => {
    const customer = db.prepare('SELECT name FROM customers WHERE phone = ?').get(chat.phone);
    return { ...chat, name: customer?.name || 'Unknown' };
  });
  
  res.json({ ok: true, chats: result });
});

// GET /admin/chat/:phone — get messages for a specific user (admin)
app.get('/admin/chat/:phone', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const cleanPhone = String(req.params.phone).replace(/\D/g, '');
  const webPhone = cleanPhone.startsWith('web:') ? req.params.phone : `web:+91${cleanPhone}`;
  
  const messages = db.prepare('SELECT * FROM chat_messages WHERE phone = ? ORDER BY created_at ASC LIMIT 100').all(webPhone);
  const customer = db.prepare('SELECT name FROM customers WHERE phone = ?').get(webPhone);
  res.json({ ok: true, messages, name: customer?.name || 'Unknown' });
});

// POST /admin/chat/reply — admin replies to user
app.post('/admin/chat/reply', (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) return res.status(403).json({ ok: false, error: 'forbidden' });
  const { phone, message } = req.body || {};
  if (!phone || !message || !message.trim()) return res.status(400).json({ ok: false, error: 'missing fields' });
  
  db.prepare('INSERT INTO chat_messages (phone, sender, message) VALUES (?, ?, ?)').run(phone, 'admin', message.trim().slice(0, 1000));
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`🥩 MeatPe server listening on :${PORT}`);

  // Self-ping every 14 minutes to prevent Render free tier sleep
  const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(async () => {
    try {
      await axios.get(`${SELF_URL}/health`, { timeout: 5000 });
      console.log('🏓 Self-ping OK — server awake');
    } catch (e) {
      // Silent fail — server is running anyway
    }
  }, 14 * 60 * 1000); // every 14 minutes
});
