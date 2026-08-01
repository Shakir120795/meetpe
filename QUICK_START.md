# ⚡ MeatPe Quick Start Guide

## 🚀 Get Running in 2 Minutes

### 1. Start Server
```bash
cd C:\Users\shaki\Desktop\meetpe
npm run dev
```
Server runs on `http://localhost:3000`

### 2. Test an Endpoint
```bash
curl http://localhost:3000/api/menu
```

### 3. Run Full Test Suite
```bash
node scripts/subscription-test.js
node scripts/notifications-test.js
node scripts/vendor-test.js
node scripts/mobile-app-test.js
```

---

## 📚 Key Docs (Read in Order)

1. **API_DOCUMENTATION.md** — All 65+ endpoints
2. **FEATURES_COMPLETED.md** — What's done
3. **NEXT_STEPS.md** — What to do next
4. **SESSION_SUMMARY.md** — This session's work

---

## 🎯 Try These First (Quick Tests)

### Get Menu
```bash
curl http://localhost:3000/api/menu
```

### Place Order
```bash
curl -X POST http://localhost:3000/api/order \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John",
    "phone": "9876543210",
    "address": "Agra",
    "items": [{"code": "C1", "qty": 1}]
  }'
```

### Mobile Login
```bash
curl -X POST http://localhost:3000/api/mobile/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "name": "John"
  }'
```

### Create Subscription
```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "name": "John",
    "address": "Agra",
    "items": [{"code": "C1", "qty": 1}],
    "frequency": "weekly"
  }'
```

### List Orders (Admin)
```bash
curl "http://localhost:3000/admin/orders?key=meatpe_admin_123"
```

---

## 📱 What's Available

| Feature | Status | Test |
|---------|--------|------|
| Orders | ✅ | `curl /api/order` |
| Subscriptions | ✅ | `node scripts/subscription-test.js` |
| Notifications | ✅ | `node scripts/notifications-test.js` |
| Vendors | ✅ | `node scripts/vendor-test.js` |
| Mobile APIs | ✅ | `node scripts/mobile-app-test.js` |
| Admin Panel | ✅ | `http://localhost:3000/admin.html` |
| GPS Location | ✅ | `http://localhost:3000/index.html` |
| Reviews | ✅ | `curl /api/reviews/{code}` |
| Inventory | ✅ | `curl /admin/inventory?key=ADMIN_KEY` |
| Returns | ✅ | `curl /api/returns/{phone}` |

---

## 🔑 Admin Key

```
Default: meatpe_admin_123
```

Use in all admin endpoints:
```
?key=meatpe_admin_123
```

---

## 📊 Database

**File:** `data/meatpe.db` (SQLite)

**Tables:** 14
- orders
- customers  
- subscriptions
- notifications
- vendors
- reviews
- returns
- (+ 7 more)

**Initialize:**
```bash
npm run init-db
```

---

## 🌐 Live Demo

```
https://meetpe.onrender.com
```

Test same endpoints on live server.

---

## 📁 Important Files

```
src/
  ├── server.js           (all 65+ endpoints)
  ├── db/
  │   └── init.js         (database schema)
  ├── data/
  │   ├── catalog.js      (products)
  │   ├── coupons.js      (promotions)
  │   └── settings.js     (app settings)
  ├── whatsapp/
  │   ├── bot.js          (WhatsApp orders)
  │   └── twilio.js       (Twilio API)
  ├── instagram/
  │   └── post.js         (auto-posting)
  └── services/
      ├── pricing.js      (calculations)
      └── session.js      (customer session)

public/
  ├── index.html          (customer app)
  ├── admin.html          (admin panel)
  ├── dashboard.html      (analytics)
  ├── app.js              (frontend logic)
  └── style.css           (styling)

scripts/
  ├── subscription-test.js
  ├── notifications-test.js
  ├── vendor-test.js
  └── mobile-app-test.js
```

---

## 🧪 Run Tests Individually

```bash
# Test subscriptions
node scripts/subscription-test.js

# Test notifications
node scripts/notifications-test.js

# Test vendors
node scripts/vendor-test.js

# Test mobile APIs
node scripts/mobile-app-test.js

# Old tests (still work)
node scripts/order-api-test.js
node scripts/smoke-test.js
```

---

## ⚙️ Configure .env

```env
ADMIN_KEY=your_key_here
DELIVERY_FEE_LOW=29
DELIVERY_FEE_MID=19
DELIVERY_FREE_ABOVE=699
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
GOOGLE_MAPS_KEY=...
LOCATIONIQ_KEY=...
```

---

## 🚨 Troubleshooting

**Server won't start:**
```bash
npm install
npm run init-db
npm run dev
```

**Database error:**
```bash
rm data/meatpe.db
npm run init-db
```

**Port in use:**
```bash
PORT=3001 npm run dev
```

**CORS issues:**
- Already configured in server
- No CORS needed for same-origin requests

---

## 📞 API Response Format

**Success:**
```json
{
  "ok": true,
  "data": {...}
}
```

**Error:**
```json
{
  "ok": false,
  "error": "error message"
}
```

---

## 🎯 Next Actions

### Option 1: Test Everything
```bash
npm run dev
node scripts/subscription-test.js
node scripts/notifications-test.js
node scripts/vendor-test.js
node scripts/mobile-app-test.js
```

### Option 2: Deploy Live
```bash
git push  # Auto-deploys to Render
# Check https://meetpe.onrender.com
```

### Option 3: Build Frontend
```bash
# Use /api/mobile/* endpoints
# Build React Native or Flutter app
```

### Option 4: Add Payments
```bash
# Integrate Razorpay/Stripe
# See NEXT_STEPS.md
```

---

## 📈 What's Working

✅ 65+ API endpoints
✅ Multi-channel notifications
✅ Recurring orders (subscriptions)
✅ Multi-vendor support
✅ Mobile app APIs
✅ Admin dashboard
✅ GPS location
✅ WhatsApp bot
✅ Order tracking
✅ Wallet system
✅ Coupon system
✅ Review system
✅ Return management

---

## 🔗 Useful Links

- **Live Server:** https://meetpe.onrender.com
- **GitHub:** https://github.com/shakir120795/meetpe
- **Docs:** See API_DOCUMENTATION.md
- **Features:** See FEATURES_COMPLETED.md
- **Next:** See NEXT_STEPS.md

---

## ✨ That's It!

You have a production-ready backend with 65+ endpoints.

**Choose:**
1. ✅ Test locally
2. ✅ Deploy live
3. ✅ Build mobile app
4. ✅ Integrate payments

**Questions?** See full docs in project root.

---

**Happy coding!** 🚀
