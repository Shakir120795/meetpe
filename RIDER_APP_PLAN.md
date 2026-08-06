# 🛵 NOW Rider App - Complete Implementation Plan

**Date:** August 6, 2026  
**Status:** Documentation Ready → Implementation Pending  
**Important:** Customer app + Admin panel already complete. DO NOT break existing features.

---

## 📋 FEATURE LIST (Complete)

### 1. 🚴 Rider Dashboard
- Online / Offline Toggle
- Today's Earnings
- Today's Deliveries
- Pending Orders
- Performance Rating

### 2. 📦 Orders
- New Order Requests (accept/reject)
- Active Orders
- Completed Orders
- Cancelled Orders
- Order History

### 3. 📍 Delivery
- Pickup Location (HUB/Store)
- Delivery Location (Customer)
- Google Maps Navigation
- Distance
- ETA

### 4. 📞 Contact
- Call Customer
- Call HUB
- Chat Customer
- Chat Support

### 5. ✅ Order Actions
- Accept Order
- Reject Order
- Reached HUB
- Picked Up
- Out For Delivery
- Delivered
- Customer Not Available
- Cancel Request

### 6. 🔐 Delivery Verification
- OTP Verification
- Delivery Photo (Optional)
- Customer Signature (Optional)

### 7. 💰 Earnings
- Daily Earnings
- Weekly Earnings
- Monthly Earnings
- Incentives
- Wallet Balance
- Withdrawal History

### 8. 💵 COD
- COD Amount to Collect
- COD Collected
- Pending Deposit

### 9. 🔔 Notifications
- New Order Alert
- Incentive Alert
- Support Messages

### 10. 🛠 Support
- Live Chat
- Call Support
- Raise Ticket

### 11. 👤 Rider Profile
- Name
- Mobile Number
- Vehicle Details
- Bank Details
- UPI ID
- KYC Status
- Documents

### 12. ⚙️ Settings
- Language
- Dark Mode
- Notification Settings
- Logout

---


## 🏗️ IMPLEMENTATION PHASES

### Phase R1: Foundation (Login + Dashboard)
**Files:** New `public/rider.html` (single-page app like customer app)
**Backend:** Rider auth APIs

Tasks:
1. Rider login screen (OTP based - same auth system)
2. Rider dashboard with stats cards
3. Online/Offline toggle (updates status in settings)
4. Today's earnings + deliveries count
5. Performance rating display

### Phase R2: Order Management
**Backend:** New rider-specific order APIs

Tasks:
1. New order requests (list of orders assigned to rider)
2. Accept/Reject order
3. Active orders view
4. Order status flow: Accept → Reached HUB → Picked Up → Out for Delivery → Delivered
5. Completed/Cancelled history
6. "Customer Not Available" action

### Phase R3: Delivery & Navigation
**Frontend:** Map integration for rider

Tasks:
1. Show pickup location (HUB) on map
2. Show delivery location (customer) on map
3. "Navigate" button → Opens Google Maps
4. Distance and ETA display
5. Route visualization

### Phase R4: Contact & Verification
Tasks:
1. Call Customer button (tel: link)
2. Call HUB button
3. Chat with customer (uses existing chat system)
4. OTP verification before marking delivered
5. Delivery photo upload (optional)

### Phase R5: Earnings & COD
**Backend:** Earnings tracking APIs

Tasks:
1. Daily/Weekly/Monthly earnings view
2. Per-delivery earnings breakdown
3. Incentives display
4. COD amount collection tracking
5. COD deposit status
6. Wallet balance
7. Withdrawal history

### Phase R6: Profile, Support & Settings
Tasks:
1. Rider profile (name, phone, vehicle, bank, UPI, KYC)
2. Document upload (Aadhaar, PAN, DL)
3. Support chat + raise ticket
4. Notification settings
5. Dark mode
6. Logout

---

## 🔧 BACKEND APIs NEEDED

### Auth
```
POST /api/rider/login          - OTP login for rider
POST /api/rider/verify-otp     - Verify OTP
```

### Dashboard
```
GET  /api/rider/dashboard      - Stats (earnings, deliveries, rating)
POST /api/rider/status         - Toggle online/offline
```

### Orders
```
GET  /api/rider/orders/new     - Pending order requests
GET  /api/rider/orders/active  - Currently active orders
GET  /api/rider/orders/history - Completed + cancelled
POST /api/rider/order/accept   - Accept an order
POST /api/rider/order/reject   - Reject an order
POST /api/rider/order/status   - Update status (picked_up, out_for_delivery, delivered)
POST /api/rider/order/verify   - OTP verification for delivery
```

### Earnings
```
GET  /api/rider/earnings       - Daily/weekly/monthly breakdown
GET  /api/rider/cod            - COD collection status
POST /api/rider/cod/deposit    - Mark COD as deposited
```

### Profile
```
GET  /api/rider/profile        - Get rider profile
POST /api/rider/profile/update - Update profile details
POST /api/rider/documents      - Upload KYC documents
```

---

## 📊 DATABASE CHANGES NEEDED

### New Table: `rider_earnings`
```sql
CREATE TABLE rider_earnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rider_id TEXT NOT NULL,
  order_id INTEGER,
  amount REAL DEFAULT 0,
  type TEXT DEFAULT 'delivery', -- delivery, incentive, bonus
  status TEXT DEFAULT 'pending', -- pending, paid
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### New Table: `rider_cod`
```sql
CREATE TABLE rider_cod (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rider_id TEXT NOT NULL,
  order_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'collected', -- collected, deposited
  deposited_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Modify: `orders` table
```sql
ALTER TABLE orders ADD COLUMN rider_id TEXT;
ALTER TABLE orders ADD COLUMN delivery_otp TEXT;
ALTER TABLE orders ADD COLUMN delivered_photo TEXT;
ALTER TABLE orders ADD COLUMN rider_accepted_at TEXT;
ALTER TABLE orders ADD COLUMN rider_picked_at TEXT;
ALTER TABLE orders ADD COLUMN rider_delivered_at TEXT;
```

---


## 🎯 EXISTING SYSTEMS TO REUSE (Don't rebuild)

| Feature | Existing System | How Rider App Uses It |
|---------|----------------|----------------------|
| Auth/OTP | MSG91/Firebase provider | Same login system |
| Orders | orders table + APIs | Rider sees assigned orders |
| Delivery Boys | orderTracking.deliveryBoys | Rider profile from here |
| Chat | chat_messages table | Rider-customer chat |
| Tickets | support_tickets table | Rider raise ticket |
| Notifications | admin_notifications | Rider gets alerts |
| Settings | settings.json | Delivery fee per order |
| Maps | Leaflet (already loaded) | Show route |

---

## 📱 RIDER APP STRUCTURE

```
/rider.html (Single Page App)
├── Login Screen (OTP)
├── Dashboard (main screen after login)
│   ├── Online/Offline toggle
│   ├── Stats cards (earnings, deliveries, rating)
│   └── Pending orders count
├── Orders Screen
│   ├── New Requests tab
│   ├── Active tab
│   └── History tab
├── Active Delivery Screen
│   ├── Map (pickup → delivery)
│   ├── Customer details
│   ├── Status update buttons
│   └── Verification (OTP/photo)
├── Earnings Screen
│   ├── Today/Week/Month tabs
│   ├── Breakdown list
│   └── COD section
├── Profile Screen
│   ├── Personal info
│   ├── Vehicle details
│   ├── Bank/UPI
│   └── Documents
└── Settings Screen
    ├── Dark mode
    ├── Notifications
    └── Logout
```

---

## 🔄 ORDER FLOW (Rider Perspective)

```
Admin assigns order to rider
        ↓
Rider gets notification: "New Order!"
        ↓
Rider sees in "New Requests"
        ↓
[Accept] or [Reject]
        ↓ (Accept)
Status: "accepted" → Timer starts
        ↓
Rider reaches store → Taps "Reached HUB"
        ↓
Rider picks up order → Taps "Picked Up"
        ↓
Status: "out_for_delivery"
(Customer sees live tracking)
        ↓
Rider reaches customer → Taps "Delivered"
        ↓
OTP Verification popup
Customer gives 4-digit OTP
        ↓
[Verified] → Order marked delivered
Earnings credited
COD amount logged (if applicable)
```

---

## 💡 IMPORTANT RULES

1. **Don't break customer app** - Rider app is separate page (/rider.html)
2. **Same backend** - Express server handles both apps
3. **Same database** - SQLite, same orders table
4. **Reuse auth** - Same OTP system
5. **Reuse chat** - Same chat_messages table
6. **Rider identified by** - phone number (from deliveryBoys settings)
7. **Dark mode** - Same CSS variables
8. **Mobile-first** - Rider uses phone while delivering

---

## 📝 ADMIN INTEGRATION

When rider app is built, admin panel gets:
- See which rider is online/offline
- See rider's active delivery on map
- Track COD collection per rider
- View rider earnings
- Manage rider payouts

These can be added to existing `/delivery-boys.html` page.

---

## 🚀 ESTIMATED EFFORT

| Phase | Feature | Time |
|-------|---------|------|
| R1 | Login + Dashboard | ~1 session |
| R2 | Order Management | ~1-2 sessions |
| R3 | Delivery & Navigation | ~1 session |
| R4 | Contact & Verification | ~1 session |
| R5 | Earnings & COD | ~1 session |
| R6 | Profile & Settings | ~1 session |

**Total: ~6-8 sessions**

---

## 🎓 SUMMARY

The Rider App will be:
- A **separate HTML page** (`/rider.html`) 
- Using the **same backend** (Express + SQLite)
- **Same auth system** (OTP login)
- Integrated with **existing order system**
- Rider login = phone number from `deliveryBoys` array

When admin assigns a delivery boy to an order → Rider sees it in their app.
When rider updates status → Customer sees live tracking.

**This document is the complete reference. Start with "Phase R1 start" when ready!**

---

**Bolo "Phase R1 start" jab Rider App banana shuru karna ho! 🛵💪**
