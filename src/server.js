// MeatPe — main server
require('dotenv').config();
require('./db/init'); // ensure DB ready

const path = require('path');
const express = require('express');
const cron = require('node-cron');
const multer = require('multer');

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
  res.json(catalogWithStock());
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
    const { name, phone, address, payment, notes, items, couponCode } = req.body || {};
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
      // Silently ignore invalid coupons (UI validates first)
    }

    const free = Number(process.env.DELIVERY_FREE_ABOVE || 699);
    const lowBelow = Number(process.env.DELIVERY_LOW_BELOW || 399);
    const feeLow = Number(process.env.DELIVERY_FEE_LOW || 29);
    const feeMid = Number(process.env.DELIVERY_FEE_MID || 19);
    const delivery = subtotal >= free ? 0 : (subtotal < lowBelow ? feeLow : feeMid);
    const total = Math.max(0, subtotal - couponDiscount + delivery);

    const waPhone = `whatsapp:+91${cleanPhone}`;
    const reward = Number(process.env.REWARD_THRESHOLD || 500);
    const rewardAmt = Number(process.env.REWARD_AMOUNT || 30);

    const customerStmt = db.prepare(`
      INSERT INTO customers (phone, name, address) VALUES (?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET name = excluded.name, address = excluded.address
    `);
    customerStmt.run(waPhone, name, address);

    const orderStmt = db.prepare(`
      INSERT INTO orders (phone, items_json, subtotal, delivery_fee, total, address, source)
      VALUES (?, ?, ?, ?, ?, ?, 'web')
    `);
    const info = orderStmt.run(waPhone, JSON.stringify(cleanItems), subtotal, delivery, total, address);
    const orderId = info.lastInsertRowid;

    let earnedReward = 0;
    if (subtotal >= reward) {
      db.prepare(`INSERT INTO rewards (phone, amount, expires_at) VALUES (?, ?, datetime('now', '+15 days'))`)
        .run(waPhone, rewardAmt);
      earnedReward = rewardAmt;
    }

    // Friendly payment label
    const paymentLabel = payment === 'pay_online'
      ? 'Pay Online (UPI link sent)'
      : 'Pay on Delivery (Cash / UPI)';

    // Notify admin on WhatsApp
    if (process.env.ADMIN_WHATSAPP) {
      const couponLine = appliedCouponCode ? `\n🏷️  Coupon: ${appliedCouponCode} (−₹${couponDiscount})` : '';
      const adminMsg =
`🆕 *New Web Order #${orderId}*

👤 ${name}
📞 +91${cleanPhone}
📍 ${address}
💳 ${paymentLabel}
${notes ? '📝 ' + notes + '\n' : ''}
${cleanItems.map(i => `• ${i.name} × ${i.qty} = ₹${i.price * i.qty}`).join('\n')}

Subtotal: ₹${subtotal}${couponLine}
Delivery: ₹${delivery}
*Total: ₹${total}*${earnedReward ? `\n🎁 +₹${earnedReward} reward issued` : ''}`;
      sendMessage(process.env.ADMIN_WHATSAPP, adminMsg).catch(err =>
        console.warn('admin notification failed:', err.message));
    }

    res.json({
      ok: true, orderId, subtotal,
      couponDiscount, couponCode: appliedCouponCode,
      delivery, total, reward: earnedReward,
    });

    // Notify customer
    setImmediate(() => {
      notifyCustomer(
        { id: orderId, phone: waPhone, address, total },
        'placed'
      );
    });
  } catch (e) {
    console.error('order err:', e);
    res.status(500).json({ ok: false, error: 'server error' });
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

// ===== Customer auth (bypass OTP — just phone) =====
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
  if (!customer) return res.json({ ok: true, customer: { phone: cleanPhone, name: '', wallet: 0, orders: 0 } });
  const rewards = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM rewards WHERE phone = ? AND used = 0 AND expires_at > datetime('now')`).get(waPhone);
  const orderCount = db.prepare('SELECT COUNT(*) as cnt FROM orders WHERE phone = ?').get(waPhone);
  res.json({ ok: true, customer: { phone: cleanPhone, name: customer.name || '', wallet: customer.wallet_balance || 0, rewards: rewards.total, orders: orderCount.cnt } });
});

// ===== Get customer orders (last 20) =====
app.get('/api/orders/:phone', (req, res) => {
  const cleanPhone = String(req.params.phone).replace(/\D/g, '');
  const waPhone = `web:+91${cleanPhone}`;
  const orders = db.prepare(`SELECT * FROM orders WHERE phone = ? ORDER BY id DESC LIMIT 20`).all(waPhone);
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

// ===== Location proxy — bypasses CORS/WebView restrictions =====
// GET /api/location/search?q=kamla+nagar+agra
app.get('/api/location/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json([]);
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6&countrycodes=in`;
    const r = await axios.get(url, {
      headers: {
        'User-Agent': 'NowDeliveryApp/1.0 (contact@nowapp.in)',
        'Accept-Language': 'en'
      },
      timeout: 8000
    });
    const results = (r.data || []).map(d => {
      const addr = d.address || {};
      const name = addr.road || addr.suburb || addr.neighbourhood ||
                   addr.village || addr.town || addr.city ||
                   (d.display_name || '').split(',')[0];
      const city = addr.city || addr.town || addr.county || '';
      const state = addr.state || '';
      return {
        lat: parseFloat(d.lat),
        lon: parseFloat(d.lon),
        name: name || 'Location',
        city,
        state,
        display: d.display_name || ''
      };
    });
    res.json(results);
  } catch (e) {
    console.warn('location search error:', e.message);
    res.json([]);
  }
});

// GET /api/location/reverse?lat=27.17&lon=78.00
app.get('/api/location/reverse', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (isNaN(lat) || isNaN(lon)) return res.json({ ok: false });
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
    const r = await axios.get(url, {
      headers: {
        'User-Agent': 'NowDeliveryApp/1.0 (contact@nowapp.in)',
        'Accept-Language': 'en'
      },
      timeout: 8000
    });
    const addr = r.data.address || {};
    const area = addr.suburb || addr.neighbourhood || addr.quarter || addr.village || addr.road || '';
    const city = addr.city || addr.town || addr.county || addr.state_district || '';
    const state = addr.state || '';
    const stateAbbr = state.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);
    const shortLabel = area && city && area !== city ? `${area}, ${city}` : (city || 'My Location');
    const label = stateAbbr ? `${shortLabel}, ${stateAbbr}` : shortLabel;
    res.json({ ok: true, label, full: r.data.display_name || '', area, city, state });
  } catch (e) {
    console.warn('reverse geocode error:', e.message);
    res.json({ ok: false, label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`, full: '' });
  }
});

app.listen(PORT, () => {
  console.log(`🥩 MeatPe server listening on :${PORT}`);
});
