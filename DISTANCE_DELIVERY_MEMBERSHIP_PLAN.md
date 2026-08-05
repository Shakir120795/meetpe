# 🚚 Distance-Based Delivery & Zone Membership System

## 📋 Implementation Plan

This is a **MAJOR FEATURE** that will be implemented in **phases** to avoid breaking existing functionality.

---

## 🎯 Feature Overview

### 1. **Distance-Based Delivery Zones**
- 4 zones based on distance from vendor
- Different delivery fees per zone
- Different free delivery thresholds
- Different delivery time estimates

### 2. **Zone-Based Membership Plans**
- Membership specific to delivery zone
- 10 delivery credits per month
- Zone-specific pricing
- Premium benefits per zone

---

## 📊 Delivery Zones Structure

| Zone | Distance | Delivery Time | Fee | Free Above |
|------|----------|---------------|-----|------------|
| Zone A | 0-3 km | 20-30 min | ₹29 | ₹699 |
| Zone B | 3-7 km | 30-45 min | ₹39 | ₹899 |
| Zone C | 7-12 km | 45-60 min | ₹59 | ₹1199 |
| Zone D | 12-20 km | 60-90 min | ₹79 | ₹1499 |

---

## 💳 Membership Plans Structure

| Zone | Price/Month | Credits | Saving | Benefits |
|------|-------------|---------|--------|----------|
| Zone A | ₹249 | 10 | ₹41 | Priority + Offers |
| Zone B | ₹349 | 10 | ₹41 | Priority + Offers |
| Zone C | ₹529 | 10 | ₹61 | Premium Support + Offers |
| Zone D | ₹699 | 10 | ₹91 | Priority + Premium Support |

---

## 🗄️ Database Schema

### Customers Table (New Columns):

```sql
ALTER TABLE customers ADD COLUMN delivery_zone TEXT DEFAULT 'zone_a';
ALTER TABLE customers ADD COLUMN delivery_zone_distance REAL DEFAULT 0;
ALTER TABLE customers ADD COLUMN membership_zone TEXT;
ALTER TABLE customers ADD COLUMN membership_price INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN delivery_credits INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN membership_start TEXT;
```

**Fields Explained:**
- `delivery_zone` - User's assigned delivery zone (zone_a, zone_b, zone_c, zone_d)
- `delivery_zone_distance` - Distance in km from nearest vendor
- `membership_zone` - Active membership zone
- `membership_price` - Monthly membership price paid
- `delivery_credits` - Remaining delivery credits (max 10)
- `membership_start` - Membership start date

---

## 🔧 Backend Implementation

### settings.js Schema:

```javascript
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
  // ... zones B, C, D
],

membershipPlans: [
  {
    zoneId: 'zone_a',
    zoneName: 'Zone A (0-3 km)',
    price: 249,
    deliveryCredits: 10,
    saving: 41,
    benefits: ['10 delivery credits', 'Priority processing', 'Exclusive offers']
  },
  // ... plans for B, C, D
]
```

---

## 🎨 Frontend Features

### 1. **Zone Detection**
- Detect user's location via GPS
- Calculate distance from vendor
- Assign appropriate zone
- Show zone info in UI

### 2. **Dynamic Delivery Fee**
- Calculate fee based on user's zone
- Show zone-specific free delivery threshold
- Update cart price breakdown

### 3. **Membership Display**
- Show membership plans for user's zone
- Display benefits and savings
- Purchase membership UI
- Track delivery credits

### 4. **Cart Integration**
- Zone-based delivery fee
- Free delivery message per zone
- Membership credit usage
- Credit deduction on order

---

## 🎯 Admin Panel Features

### Location: `/settings.html`

#### Section 1: 🚚 Delivery Zones Management

**For each zone:**
- Zone Name
- Distance Range (min-max km)
- Delivery Time
- Delivery Fee
- Free Delivery Above

#### Section 2: 💳 Membership Plans Management

**For each plan:**
- Zone Selection
- Monthly Price
- Delivery Credits
- Customer Saving
- Benefits List

---

## 📱 User Experience Flow

### New User Flow:
```
1. User opens app
2. Requests location permission
3. GPS detects location
4. Calculate distance from vendor
5. Assign zone (e.g., Zone B - 5.2 km)
6. Show zone info:
   "You're in Zone B (3-7 km)"
   "Delivery: 30-45 min"
   "Fee: ₹39 (Free above ₹899)"
7. User browses and adds items
8. Cart shows zone-specific fee
9. If interested, can buy membership
```

### Membership Purchase Flow:
```
1. User in Zone B clicks "Get Membership"
2. Shows Zone B plan:
   - ₹349/month
   - 10 delivery credits
   - Save ₹41/month
   - Priority processing
3. User pays ₹349
4. Membership activated
5. Delivery credits: 10
6. Next order uses 1 credit
7. Credits left: 9
8. After 10 orders, needs to renew
```

### Order with Membership:
```
Cart Breakdown:
Items Subtotal          ₹650
Packaging                ₹10
GST (5%)                 ₹33
Delivery (Zone B)     FREE ✅ (Credit used)
────────────────────────────
Total                   ₹693

Credits Remaining: 9/10
```

---

## 🔒 Business Rules

### Delivery Zone Rules:
1. Zone calculated on every address change
2. Vendor location stored in settings
3. Distance calculated using Haversine formula
4. Zones are mutually exclusive
5. Outside Zone D = "Out of delivery area"

### Membership Rules:
1. Valid for 30 days from purchase
2. Auto-expires after 30 days
3. 10 credits per billing cycle
4. 1 credit = 1 order's delivery fee waived
5. Unused credits expire
6. Non-transferable
7. Non-refundable
8. Benefits only in purchased zone
9. Order outside zone = additional charges

### Credit Deduction Rules:
1. Credit used only if order qualifies
2. Minimum order: ₹299
3. Credit auto-applied if available
4. Manual toggle option in cart
5. Credits deducted on order placement
6. Failed orders refund credit

---

## 🚀 Implementation Phases

### ✅ Phase 1: Backend Setup (DONE)
- [x] Add delivery zones to settings.js
- [x] Add membership plans to settings.js
- [x] Database migration script
- [x] Update customers table schema

### ✅ Phase 2: Zone Detection & Delivery Fee (COMPLETE)
- [x] GPS location detection
- [x] Distance calculation from vendor (Haversine formula)
- [x] Zone assignment logic
- [x] Dynamic delivery fee in cart
- [x] Zone info display in UI
- [x] Zone detection API endpoint
- [x] Customer zone saved to database
- [x] Topbar zone display
- [x] Cart delivery bar with zone info
- [x] Zone-based free delivery threshold

### ✅ Phase 3: Membership System (COMPLETE)
- [x] Membership purchase UI
- [x] Backend APIs (purchase, status, plans)
- [x] Credit tracking system
- [x] Credit deduction on order
- [x] Membership expiry handling
- [x] Zone-based plans display
- [x] Order success shows credit usage
- [x] Admin notifications

### 📅 Phase 4: Admin Panel (TODO)
- [ ] Delivery zones CRUD
- [ ] Membership plans CRUD
- [ ] Vendor location settings
- [ ] Zone analytics dashboard

---

## 📁 Files to Modify

### Backend:
- ✅ `src/data/settings.js` - Zones & plans schema
- ✅ `src/db/init.js` - Customer table update
- ✅ `scripts/add-delivery-zone-columns.js` - Migration script
- ⏳ `src/server.js` - Zone detection API, membership API

### Frontend:
- ⏳ `public/index.html` - Zone display, membership UI
- ⏳ Cart logic - Zone-based delivery fee
- ⏳ Membership purchase flow

### Admin:
- ⏳ `public/settings.html` - Zones & membership admin

---

## 🧪 Testing Checklist

### Zone Detection:
- [ ] GPS permission request works
- [ ] Distance calculated correctly
- [ ] Zone assigned correctly
- [ ] Zone info displayed
- [ ] Delivery fee matches zone
- [ ] Free delivery threshold per zone

### Membership:
- [ ] Plans shown for user's zone
- [ ] Purchase flow works
- [ ] Payment integration works
- [ ] Credits updated in database
- [ ] Credits displayed in UI
- [ ] Credit deducted on order
- [ ] Expiry handled correctly

### Admin Panel:
- [ ] Can add/edit zones
- [ ] Can add/edit membership plans
- [ ] Vendor location editable
- [ ] Changes reflect immediately

---

## ⚠️ Important Notes

### Backward Compatibility:
- Existing users default to Zone A
- Old delivery fee logic still works
- Gradual migration approach
- No breaking changes

### Fallback Logic:
- If GPS fails → Manual zone selection
- If distance API fails → Default Zone A
- If membership expired → Regular pricing

### Performance:
- Cache zone calculation
- Minimize distance API calls
- Efficient database queries
- Fast UI updates

---

## 🎯 Current Status

**Phase 1 Complete:** ✅
- Backend schema ready
- Database updated
- Migration script created

**Next Steps:**
1. Implement zone detection API
2. Add distance calculation
3. Update cart delivery fee logic
4. Add zone display in UI
5. Build admin panel

---

## 📞 Migration Command

```bash
# Run on VPS after git pull:
node scripts/add-delivery-zone-columns.js
```

**This adds new columns to existing customers table without data loss.**

---

**Status:** ✅ **PHASES 1, 2 & 3 COMPLETE - READY FOR PHASE 4**

**Last Updated:** Today
