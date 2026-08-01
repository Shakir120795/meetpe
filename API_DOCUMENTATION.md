# MeatPe API Documentation

Complete API reference for MeatPe — Fresh Meat Delivery in 30 Minutes.

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Customer APIs](#customer-apis)
3. [Orders](#orders)
4. [Subscriptions (Recurring Orders)](#subscriptions-recurring-orders)
5. [Notifications](#notifications)
6. [Vendor/Seller Management](#vendorseller-management)
7. [Mobile App APIs](#mobile-app-apis)
8. [Admin APIs](#admin-apis)
9. [Reviews & Ratings](#reviews--ratings)
10. [Inventory Management](#inventory-management)
11. [Returns & Refunds](#returns--refunds)
12. [Coupons & Promotions](#coupons--promotions)

---

## Authentication

### Public Access
No authentication required for public endpoints (menu, search, etc.)

### Admin Access
All admin endpoints require `?key=ADMIN_KEY` query parameter.
Set `ADMIN_KEY` in `.env` file.

### Customer Access
Phone number is the identifier. Format: `+91{10-digit-number}`

---

## Customer APIs

### 1. Customer Login
```
POST /api/auth/login
Content-Type: application/json

{
  "phone": "9876543210",
  "name": "John Doe"
}

Response:
{
  "ok": true,
  "customer": {
    "phone": "9876543210",
    "name": "John Doe",
    "wallet": 500,
    "orders": 5
  }
}
```

### 2. Get Customer Profile
```
GET /api/customer/{phone}

Response:
{
  "ok": true,
  "customer": {
    "phone": "9876543210",
    "name": "John Doe",
    "wallet": 500,
    "rewards": 100,
    "orders": 5
  }
}
```

### 3. Get Customer Orders
```
GET /api/orders/{phone}

Response:
{
  "ok": true,
  "orders": [
    {
      "id": 1,
      "items": [...],
      "total": 500,
      "status": "delivered",
      "created_at": "2024-01-01T10:00:00"
    }
  ]
}
```

### 4. Use Wallet Balance
```
POST /api/wallet/use
Content-Type: application/json

{
  "phone": "9876543210",
  "amount": 100
}

Response:
{
  "ok": true,
  "deducted": 100,
  "remaining": 400
}
```

### 5. Subscribe to Notifications
```
POST /api/notifications/subscribe
Content-Type: application/json

{
  "phone": "9876543210",
  "email": "user@example.com",
  "channels": ["whatsapp", "sms"]
}

Response:
{
  "ok": true,
  "message": "Subscribed to notifications",
  "channels": ["whatsapp", "sms"]
}
```

---

## Orders

### 1. Place Order (Web)
```
POST /api/order
Content-Type: application/json

{
  "name": "John Doe",
  "phone": "9876543210",
  "address": "123 Market St, Agra",
  "payment": "cod",
  "notes": "Call before delivery",
  "items": [
    { "code": "C1", "qty": 2 },
    { "code": "L1", "qty": 1 }
  ],
  "couponCode": "TEST10"
}

Response:
{
  "ok": true,
  "orderId": 42,
  "subtotal": 500,
  "couponDiscount": 50,
  "delivery": 29,
  "total": 479,
  "reward": 30
}
```

### 2. Validate Coupon
```
POST /api/coupon/validate
Content-Type: application/json

{
  "code": "TEST10",
  "subtotal": 500
}

Response:
{
  "ok": true,
  "discount": 50,
  "coupon": {
    "code": "TEST10",
    "type": "fixed",
    "value": 50,
    "minOrder": 300
  }
}
```

### 3. Get Active Coupons
```
GET /api/coupons

Response:
[
  {
    "code": "TEST10",
    "type": "fixed",
    "value": 50,
    "minOrder": 300,
    "maxDiscount": 100,
    "description": "₹50 off on orders above ₹300"
  }
]
```

### 4. Admin: List Orders
```
GET /admin/orders?key={ADMIN_KEY}&status=placed&source=web&limit=50

Response:
{
  "ok": true,
  "orders": [...],
  "stats": {
    "total": 150,
    "revenue": 45000,
    "placed": 10,
    "preparing": 8,
    "out_for_delivery": 5,
    "delivered": 120,
    "cancelled": 7,
    "source_web": 100,
    "source_whatsapp": 50
  },
  "today": {
    "count": 25,
    "revenue": 12000
  }
}
```

### 5. Admin: Update Order Status
```
POST /admin/orders/{id}/status?key={ADMIN_KEY}&status=out_for_delivery
Content-Type: application/json

Response:
{
  "ok": true,
  "id": 42,
  "status": "out_for_delivery"
}
```

---

## Subscriptions (Recurring Orders)

### 1. Create Subscription
```
POST /api/subscriptions
Content-Type: application/json

{
  "phone": "9876543210",
  "name": "John Doe",
  "address": "123 Market St, Agra",
  "items": [
    { "code": "C1", "qty": 2 },
    { "code": "L1", "qty": 1 }
  ],
  "frequency": "weekly",
  "cyclesRemaining": 8,
  "notes": "Fresh meat weekly"
}

Response:
{
  "ok": true,
  "id": 5,
  "nextDelivery": "2024-01-08",
  "total": 500
}
```

### 2. Get Customer Subscriptions
```
GET /api/subscriptions/{phone}

Response:
{
  "ok": true,
  "subscriptions": [
    {
      "id": 5,
      "frequency": "weekly",
      "next_delivery": "2024-01-08",
      "status": "active",
      "total_price": 500,
      "items": [...]
    }
  ]
}
```

### 3. Update Subscription
```
PUT /api/subscriptions/{id}
Content-Type: application/json

{
  "phone": "9876543210",
  "status": "paused",
  "frequency": "biweekly",
  "items": [...],
  "notes": "Paused temporarily"
}

Response:
{
  "ok": true
}
```

### 4. Cancel Subscription
```
POST /api/subscriptions/{id}/cancel
Content-Type: application/json

{
  "phone": "9876543210"
}

Response:
{
  "ok": true
}
```

### 5. Admin: List All Subscriptions
```
GET /admin/subscriptions?key={ADMIN_KEY}&status=active&limit=50

Response:
{
  "ok": true,
  "subscriptions": [...],
  "stats": {
    "total": 25,
    "active": 20,
    "paused": 3,
    "cancelled": 2,
    "total_mrr": 25000
  }
}
```

---

## Notifications

### 1. Get Notification History
```
GET /api/notifications/{phone}?limit=50

Response:
{
  "ok": true,
  "notifications": [
    {
      "id": 1,
      "type": "order_placed",
      "channel": "whatsapp",
      "message": "✅ Order Confirmed!",
      "status": "sent",
      "created_at": "2024-01-01T10:00:00"
    }
  ]
}
```

### 2. Send Test Notification
```
POST /api/notifications/test?key={ADMIN_KEY}
Content-Type: application/json

{
  "phone": "9876543210",
  "message": "🧪 Test notification",
  "channel": "whatsapp"
}

Response:
{
  "ok": true,
  "message": "Test notification sent",
  "channel": "whatsapp"
}
```

### 3. Webhook Notification
```
POST /api/webhooks/notify
Content-Type: application/json

{
  "phone": "9876543210",
  "event": "delivery_completed",
  "data": {
    "message": "Your order has been delivered"
  }
}

Response:
{
  "ok": true,
  "message": "Webhook notification logged"
}
```

### 4. Admin: List All Notifications
```
GET /admin/notifications?key={ADMIN_KEY}&status=sent&type=order_placed&limit=100

Response:
{
  "ok": true,
  "notifications": [...],
  "stats": {
    "total": 500,
    "sent": 480,
    "pending": 15,
    "failed": 5
  }
}
```

### 5. Get Notification Templates
```
GET /admin/notification-templates?key={ADMIN_KEY}

Response:
{
  "ok": true,
  "templates": [
    {
      "id": 1,
      "name": "order_placed",
      "subject": "Order Confirmed",
      "body": "✅ Order Confirmed!...",
      "channels": "whatsapp,email,sms",
      "active": true
    }
  ]
}
```

---

## Vendor/Seller Management

### 1. Register Vendor
```
POST /api/vendors/register
Content-Type: application/json

{
  "phone": "9876543210",
  "name": "Amit Sharma",
  "businessName": "Fresh Meats Pvt Ltd",
  "email": "amit@freshmeats.com",
  "gst": "05ABEPC1234H1Z0"
}

Response:
{
  "ok": true,
  "vendor_id": 1,
  "status": "pending",
  "message": "Registration submitted. Admin review required."
}
```

### 2. Get Vendor Details
```
GET /api/vendors/{id}

Response:
{
  "ok": true,
  "vendor": {
    "id": 1,
    "name": "Amit Sharma",
    "business_name": "Fresh Meats Pvt Ltd",
    "city": "Agra",
    "status": "approved",
    "created_at": "2024-01-01T10:00:00"
  }
}
```

### 3. Update Vendor Profile
```
PUT /api/vendors/{id}
Content-Type: application/json

{
  "phone": "9876543210",
  "address": "123 Market St",
  "city": "Agra",
  "state": "UP",
  "bankAccount": "123456789012",
  "bankIfsc": "HDFC0001234"
}

Response:
{
  "ok": true
}
```

### 4. Get Vendor Orders
```
GET /api/vendors/{id}/orders?limit=50

Response:
{
  "ok": true,
  "orders": [...],
  "total": 45
}
```

### 5. Get Vendor Analytics
```
GET /api/vendors/{id}/analytics

Response:
{
  "ok": true,
  "analytics": {
    "products": 15,
    "total_orders": 120,
    "total_revenue": 45000,
    "commission": 6750,
    "net_revenue": 38250
  }
}
```

### 6. Admin: List All Vendors
```
GET /admin/vendors?key={ADMIN_KEY}&status=approved&limit=50

Response:
{
  "ok": true,
  "vendors": [...],
  "stats": {
    "total": 25,
    "approved": 20,
    "pending": 4,
    "rejected": 1
  }
}
```

### 7. Admin: Approve Vendor
```
POST /admin/vendors/{id}/approve?key={ADMIN_KEY}

Response:
{
  "ok": true
}
```

### 8. Admin: List Vendor Payouts
```
GET /admin/vendor-payouts?key={ADMIN_KEY}&status=pending&limit=50

Response:
{
  "ok": true,
  "payouts": [...],
  "stats": {
    "total": 30,
    "pending": 10,
    "processed": 20,
    "pending_amount": 50000
  }
}
```

---

## Mobile App APIs

### 1. Mobile Login
```
POST /api/mobile/login
Content-Type: application/json

{
  "phone": "9876543210",
  "name": "John Doe",
  "deviceId": "device_12345"
}

Response:
{
  "ok": true,
  "customer": {
    "phone": "9876543210",
    "name": "John Doe",
    "wallet": 500,
    "rewards": 100
  },
  "deviceId": "device_12345"
}
```

### 2. Get Home Feed
```
GET /api/mobile/home?lat=27.1767&lon=78.0081

Response:
{
  "ok": true,
  "home": {
    "trending": [...],
    "categories": ["chicken", "lamb", "fish"],
    "categoryItems": {
      "chicken": [...],
      "lamb": [...]
    },
    "coupons": [...]
  }
}
```

### 3. Search Products
```
GET /api/mobile/search?q=chicken&cat=chicken&maxPrice=500

Response:
{
  "ok": true,
  "results": [
    {
      "code": "C1",
      "name": "Chicken Breast",
      "price": 350,
      "unit": "kg",
      "inStock": true
    }
  ]
}
```

### 4. Validate Cart
```
POST /api/mobile/cart/validate
Content-Type: application/json

{
  "items": [
    { "code": "C1", "qty": 2 },
    { "code": "L1", "qty": 1 }
  ],
  "couponCode": "TEST10"
}

Response:
{
  "ok": true,
  "cart": {
    "items": [...],
    "subtotal": 500,
    "couponDiscount": 50,
    "delivery": 29,
    "total": 479,
    "saveable": 100
  }
}
```

### 5. Mobile Checkout
```
POST /api/mobile/checkout
Content-Type: application/json

{
  "phone": "9876543210",
  "name": "John Doe",
  "address": "Agra, UP 282001",
  "items": [
    { "code": "C1", "qty": 1 },
    { "code": "F1", "qty": 2 }
  ],
  "couponCode": null,
  "paymentMethod": "cod",
  "lat": 27.1767,
  "lon": 78.0081
}

Response:
{
  "ok": true,
  "order": {
    "id": 42,
    "subtotal": 500,
    "couponDiscount": 0,
    "delivery": 29,
    "total": 529,
    "paymentMethod": "cod",
    "location": { "lat": 27.1767, "lon": 78.0081 }
  }
}
```

---

## Admin APIs

### 1. Dashboard/Analytics
```
GET /admin/analytics?key={ADMIN_KEY}

Response:
{
  "ok": true,
  "daily": [...],
  "topItems": [...],
  "byHour": [...],
  "summary": {
    "total_orders": 500,
    "total_revenue": 150000,
    "unique_customers": 250,
    "avg_order_value": 300
  },
  "thisWeek": { "orders": 75, "revenue": 22500 },
  "lastWeek": { "orders": 60, "revenue": 18000 }
}
```

### 2. Customer Management
```
GET /admin/customers?key={ADMIN_KEY}&search=john&limit=50

Response:
{
  "ok": true,
  "customers": [
    {
      "phone": "whatsapp:+919876543210",
      "name": "John Doe",
      "order_count": 5,
      "lifetime_value": 2500,
      "last_order": "2024-01-15T10:00:00"
    }
  ]
}
```

### 3. Update Customer Wallet
```
PUT /admin/customers/{phone}/wallet?key={ADMIN_KEY}
Content-Type: application/json

{
  "amount": 100,
  "action": "add"
}

Response:
{
  "ok": true,
  "wallet": 600
}
```

---

## Reviews & Ratings

### 1. Submit Review
```
POST /api/reviews
Content-Type: application/json

{
  "phone": "9876543210",
  "order_id": 42,
  "item_code": "C1",
  "rating": 5,
  "comment": "Excellent quality, fresh meat!"
}

Response:
{
  "ok": true,
  "id": 123
}
```

### 2. Get Product Reviews
```
GET /api/reviews/{item_code}

Response:
{
  "ok": true,
  "reviews": [
    {
      "id": 1,
      "rating": 5,
      "comment": "Excellent quality!",
      "customer_name": "John",
      "created_at": "2024-01-01T10:00:00"
    }
  ],
  "stats": {
    "count": 45,
    "avg": 4.8
  }
}
```

### 3. Admin: List All Reviews
```
GET /admin/reviews?key={ADMIN_KEY}&status=pending&limit=50

Response:
{
  "ok": true,
  "reviews": [...]
}
```

### 4. Admin: Approve Review
```
PUT /admin/reviews/{id}?key={ADMIN_KEY}
Content-Type: application/json

{
  "status": "approved"
}

Response:
{
  "ok": true
}
```

---

## Inventory Management

### 1. Get Inventory
```
GET /admin/inventory?key={ADMIN_KEY}

Response:
{
  "ok": true,
  "inventory": [
    {
      "code": "C1",
      "name": "Chicken Breast",
      "price": 350,
      "inStock": true,
      "lowStock": false,
      "stockQty": 50
    }
  ],
  "stats": {
    "totalItems": 20,
    "inStockCount": 18,
    "outOfStockCount": 2
  }
}
```

### 2. Update Inventory
```
POST /admin/inventory/{code}?key={ADMIN_KEY}
Content-Type: application/json

{
  "inStock": true,
  "lowStock": false,
  "stockQty": 100,
  "sku": "C1-BREAST-KG"
}

Response:
{
  "ok": true,
  "code": "C1"
}
```

### 3. Get Inventory Alerts
```
GET /admin/inventory/alerts?key={ADMIN_KEY}

Response:
{
  "ok": true,
  "alerts": [
    {
      "type": "low_stock",
      "code": "C1",
      "name": "Chicken Breast",
      "qty": 5
    }
  ],
  "outOfStockCount": 2,
  "lowStockCount": 3
}
```

---

## Returns & Refunds

### 1. Submit Return Request
```
POST /api/returns
Content-Type: application/json

{
  "phone": "9876543210",
  "order_id": 42,
  "reason": "quality_issue",
  "description": "Product was not fresh",
  "items": [{ "code": "C1", "qty": 1 }]
}

Response:
{
  "ok": true,
  "id": 15
}
```

### 2. Get Customer Returns
```
GET /api/returns/{phone}

Response:
{
  "ok": true,
  "returns": [
    {
      "id": 15,
      "order_id": 42,
      "reason": "quality_issue",
      "status": "approved",
      "refund_amount": 350,
      "created_at": "2024-01-01T10:00:00"
    }
  ]
}
```

### 3. Admin: List Returns
```
GET /admin/returns?key={ADMIN_KEY}&status=requested&limit=50

Response:
{
  "ok": true,
  "returns": [...],
  "stats": {
    "total": 20,
    "requested": 5,
    "approved": 10,
    "refunded": 8,
    "rejected": 2,
    "total_refunded": 2800
  }
}
```

### 4. Admin: Process Return
```
PUT /admin/returns/{id}?key={ADMIN_KEY}
Content-Type: application/json

{
  "status": "refunded",
  "refund_amount": 350,
  "refund_method": "wallet",
  "admin_note": "Processed successfully"
}

Response:
{
  "ok": true
}
```

---

## Coupons & Promotions

### 1. Admin: List Coupons
```
GET /admin/coupons?key={ADMIN_KEY}

Response:
{
  "ok": true,
  "coupons": [
    {
      "code": "TEST10",
      "type": "fixed",
      "value": 50,
      "minOrder": 300,
      "maxDiscount": 100,
      "active": true,
      "created_at": "2024-01-01T10:00:00"
    }
  ]
}
```

### 2. Admin: Create Coupon
```
POST /admin/coupons?key={ADMIN_KEY}
Content-Type: application/json

{
  "code": "NEWYEAR20",
  "type": "percentage",
  "value": 20,
  "minOrder": 500,
  "maxDiscount": 200,
  "description": "20% off on orders above ₹500"
}

Response:
{
  "ok": true
}
```

### 3. Admin: Update Coupon
```
PUT /admin/coupons/{code}?key={ADMIN_KEY}
Content-Type: application/json

{
  "value": 30,
  "active": false
}

Response:
{
  "ok": true
}
```

### 4. Admin: Delete Coupon
```
DELETE /admin/coupons/{code}?key={ADMIN_KEY}

Response:
{
  "ok": true
}
```

---

## Status Codes

- `200` - Success
- `400` - Bad Request
- `403` - Forbidden (invalid admin key)
- `404` - Not Found
- `500` - Server Error

---

## Environment Variables

```
ADMIN_KEY=your_secret_key
DELIVERY_FEE_LOW=29
DELIVERY_FEE_MID=19
DELIVERY_FREE_ABOVE=699
DELIVERY_LOW_BELOW=399
REWARD_THRESHOLD=500
REWARD_AMOUNT=30
SHOP_NAME=MeatPe
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE=...
GOOGLE_MAPS_KEY=...
LOCATIONIQ_KEY=...
```

---

## Testing

Run test scripts:

```bash
npm run init-db          # Initialize database
node scripts/order-api-test.js
node scripts/subscription-test.js
node scripts/notifications-test.js
node scripts/vendor-test.js
node scripts/mobile-app-test.js
```

---

**Last Updated:** January 2024
**Version:** 1.0.0
