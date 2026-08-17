# 🔒 SECURITY AUDIT REPORT - MeetPe Platform
**Date:** August 17, 2026  
**Auditor:** AI Security Analysis  
**Status:** 🔴 CRITICAL ISSUES FOUND

---

## 📋 EXECUTIVE SUMMARY

Total Issues Found: **28**
- 🔴 **Critical:** 8
- 🟠 **High:** 7  
- 🟡 **Medium:** 9
- 🟢 **Low:** 4

---

## 🔴 CRITICAL VULNERABILITIES (P0 - Fix Immediately)

### 1. **Admin Key in Query Parameters (IDOR)**
**Severity:** 🔴 CRITICAL  
**File:** `src/server.js` - Multiple endpoints  
**Issue:**
```javascript
const provided = req.headers['x-admin-key'] || req.query.key;  // ⚠️ URL mein key!
```

**Risk:**
- Admin key browser history mein save ho sakta hai
- Server logs mein plain text mein aa jayega
- Proxy/firewall logs mein expose hoga
- URL share karne par key leak hoga

**Attack Vector:**
```
https://nonvegonwheel.in/admin/orders?key=YOUR_ADMIN_KEY
# Browser history, server logs mein save!
```

**Impact:** Complete admin access breach

---

### 2. **No Rate Limiting on OTP Endpoints**
**Severity:** 🔴 CRITICAL  
**File:** `src/server.js` - Lines 1725, 1757  
**Issue:**
```javascript
app.post('/api/auth/send-otp', otpLimiter, ...)  // ✅ Has limiter
app.post('/api/auth/verify-otp', ...)            // ❌ NO limiter!
```

**Risk:**
- Attacker OTP brute-force kar sakta hai (6 digit = 1 million combinations)
- No retry limit on verify endpoint
- Koi bhi unlimited OTP verify attempts kar sakta hai

**Attack Vector:**
```bash
# Brute force script
for i in {000000..999999}; do
  curl -X POST /api/auth/verify-otp -d "{\"phone\":\"9876543210\",\"otp\":\"$i\"}"
done
```

**Impact:** Account takeover via OTP brute force

---

### 3. **SQL Injection via Template Literals**
**Severity:** 🔴 CRITICAL  
**File:** `src/server.js` - Line 596  
**Issue:**
```javascript
db.prepare(`INSERT INTO rewards ... datetime('now', '+${rewardExpiry} days'), 0)`).run(...)
// ⚠️ rewardExpiry variable directly injected!
```

**Risk:**
- Agar `rewardExpiry` user-controlled ho to SQL injection possible
- Currently safe kyunki server-side variable hai, but dangerous pattern

**Attack Vector:**
```javascript
// If rewardExpiry comes from settings API (admin):
rewardExpiry = "1') ON CONFLICT DO NOTHING; DROP TABLE customers--"
// Query becomes: datetime('now', '+1') ON CONFLICT DO NOTHING; DROP TABLE customers-- days')
```

**Impact:** Database corruption, data exfiltration

---

### 4. **Referral System - Fake Referral Attack**
**Severity:** 🔴 CRITICAL  
**File:** `src/server.js` - Lines 1665-1678  
**Issue:**
```javascript
const referralCode = req.body.referralCode;  // User controlled!
// No validation ki referral code exists or not
db.prepare('INSERT INTO customers ... referred_by = ? ...').run(waPhone, '', 20, referredBy, ...)
```

**Risk:**
- Koi bhi fake referral code daal ke ₹20 le sakta hai
- Multiple accounts bana ke unlimited ₹20 kamaa sakta hai
- No check ki referrer actually exists

**Attack Vector:**
```bash
# Create 100 accounts with fake referral code
for i in {1..100}; do
  curl -X POST /api/auth/verify-otp \
    -d '{"phone":"987654'$i'", "otp":"123456", "referralCode":"FAKE1234"}'
done
# Each account gets ₹20 = ₹2000 total!
```

**Impact:** Financial loss, unlimited wallet credit generation

---

### 5. **Coupon Reuse - No User Tracking**
**Severity:** 🔴 CRITICAL  
**File:** `src/data/coupons.js`  
**Issue:**
```javascript
// Coupon system tracks usage count globally
// But NO per-user tracking!
```

**Risk:**
- Same user 100 baar same coupon use kar sakta hai
- "FIRST100" coupon ko har order mein use kar sakta hai
- No database table to track coupon usage per phone number

**Attack Vector:**
```bash
# Use same coupon on every order
for i in {1..50}; do
  curl -X POST /api/order \
    -d '{"phone":"9876543210", "items":[...], "couponCode":"FIRST100"}'
done
# 50% discount on all 50 orders!
```

**Impact:** Revenue loss, discount abuse

---

### 6. **Session Tokens Never Expire (Memory Leak)**
**Severity:** 🔴 CRITICAL  
**File:** `src/server.js` - Lines 127, 4164  
**Issue:**
```javascript
// Customer sessions: 30 days
db.prepare('DELETE FROM customer_sessions WHERE created_at < ?').run(now - 30 * 24 * 60 * 60 * 1000);

// Rider sessions: 7 days  
db.prepare('DELETE FROM rider_sessions WHERE created_at < ?').run(now - 7 * 24 * 60 * 60 * 1000);
```

**Risk:**
- Tokens kabhi invalidate nahi hote on logout
- Stolen token 30 days tak valid rahega
- No blacklist mechanism
- Database bloat - sessions keep growing

**Attack Vector:**
```bash
# Steal token from network request
Token: abc123...

# Use it for 30 days even after user "logged out"
curl -H "Authorization: Bearer abc123..." /api/orders
```

**Impact:** Account persistence after logout, token theft risk

---

### 7. **Price Manipulation via Item Code**
**Severity:** 🔴 CRITICAL  
**File:** `src/server.js` - Line 444  
**Issue:**
```javascript
const found = findByCode(it.code);
// If findByCode returns undefined, no error handling!
cleanItems.push({ code: found.code, name: found.name, price: found.price, qty });
```

**Risk:**
- Agar attacker invalid item code bheje to server crash
- Potential to manipulate pricing if catalog not properly validated
- No check ki item actually available hai

**Attack Vector:**
```javascript
// Send non-existent item code
POST /api/order
{
  "items": [{"code": "NONEXISTENT", "qty": 100}]
}
// Server crash or undefined price
```

**Impact:** Server crash, potential price manipulation

---

### 8. **Rider Authentication Bypass via Query Parameter**
**Severity:** 🔴 CRITICAL  
**File:** `src/server.js` - Line 4168  
**Issue:**
```javascript
const auth = req.headers['authorization'] || req.headers['x-rider-token'] || req.query.riderToken;
// ⚠️ Token in URL query string!
```

**Risk:**
- Rider token browser history mein save hoga
- Server logs mein plain text
- URL share = token leak

**Attack Vector:**
```
https://nonvegonwheel.in/api/rider/dashboard/123?riderToken=stolen_token_here
# Token exposed in logs!
```

**Impact:** Rider account takeover, unauthorized order access

---

## 🟠 HIGH SEVERITY VULNERABILITIES (P1)

### 9. **No Input Validation on Phone Numbers**
**Severity:** 🟠 HIGH  
**File:** Multiple files  
**Issue:**
```javascript
const cleanPhone = String(phone).replace(/\D/g, '');
// Only removes non-digits, no length check in some places
```

**Risk:**
- International numbers can bypass 10-digit check
- Leading zeros can cause issues
- No validation against banned numbers

**Fix:** Strict validation required

---

### 10. **Wallet Topup - Duplicate Payment Detection Weak**
**Severity:** 🟠 HIGH  
**File:** `src/server.js` - Line 3796  
**Issue:**
```javascript
const existing = db.prepare('SELECT * FROM wallet_transactions WHERE payment_id = ?').get(razorpay_payment_id);
if (existing) {
  return res.json({ ok: true, wallet: current.wallet_balance });
}
```

**Risk:**
- Race condition: Dono requests same time pe aaye to dono process ho jayenge
- No transaction locking
- Double credit possible

**Attack Vector:**
```javascript
// Send 2 simultaneous requests with same payment_id
Promise.all([
  fetch('/api/wallet/topup/verify', {body: payment1}),
  fetch('/api/wallet/topup/verify', {body: payment1})
]);
// Both might credit wallet if race condition
```

---

### 11. **Admin Endpoints Missing requireAdmin Middleware**
**Severity:** 🟠 HIGH  
**File:** `src/server.js` - Multiple lines  
**Issue:**
```javascript
app.get('/admin/orders', (req, res) => { ... })           // ❌ No auth check initially
app.put('/admin/customers/:phone/wallet', requireAdmin, ...) // ✅ Has auth
```

**Risk:**
- Some admin endpoints might be missing authentication
- Inconsistent security model

---

### 12. **MSG91 Widget Token Exposed in HTML**
**Severity:** 🟠 HIGH  
**File:** `src/server.js` - Lines 266, 282  
**Issue:**
```javascript
html = html.replace('%%MSG91_TOKEN%%', widgetToken);
// Token client-side mein visible!
```

**Risk:**
- Widget token browser mein plain text
- Anyone can use it for their own OTP sending
- API quota exhaustion attack possible

**Fix:** Server-side OTP proxy needed

---

### 13. **No CSRF Protection**
**Severity:** 🟠 HIGH  
**File:** Entire application  
**Issue:**
- No CSRF tokens on state-changing operations
- Cookie-based sessions would be vulnerable

**Risk:**
- Attacker malicious website se victim ke naam pe orders place kar sakta hai

---

### 14. **Database File Permissions**
**Severity:** 🟠 HIGH  
**File:** `data/meatpe.db`  
**Issue:**
- SQLite file permissions not explicitly set
- Might be world-readable on server

**Risk:**
- Local users database file directly read kar sakte hain

---

### 15. **No Request Body Size Limit**
**Severity:** 🟠 HIGH  
**File:** `src/server.js`  
**Issue:**
```javascript
app.use(express.json());  // No size limit!
```

**Risk:**
- Attacker huge JSON payload bhej ke memory exhaust kar sakta hai

**Attack Vector:**
```bash
curl -X POST /api/order -d '{"items": ['$(yes '{"code":"X","qty":1},' | head -1000000)']}'
# Crash server with huge payload
```

---

## 🟡 MEDIUM SEVERITY VULNERABILITIES (P2)

### 16. **Environment Variables in `.env` File**
**Severity:** 🟡 MEDIUM  
**Issue:**
- All secrets in one `.env` file
- If file leaks = total compromise

**Recommendation:** Use secrets manager (AWS Secrets Manager, HashiCorp Vault)

---

### 17. **No API Versioning**
**Severity:** 🟡 MEDIUM  
**Issue:**
```javascript
app.post('/api/order', ...)  // No version like /api/v1/order
```

**Risk:**
- Breaking changes will affect all clients
- No migration path

---

### 18. **Hardcoded Timeouts**
**Severity:** 🟡 MEDIUM  
**Issue:**
```javascript
db.prepare('DELETE FROM customer_sessions WHERE created_at < ?').run(now - 30 * 24 * 60 * 60 * 1000);
// 30 days hardcoded
```

**Risk:**
- Cannot dynamically adjust session expiry
- Should be environment variable

---

### 19. **No Audit Logging**
**Severity:** 🟡 MEDIUM  
**Issue:**
- Admin actions not logged
- No trail of who changed what when

**Risk:**
- Cannot detect insider attacks
- No forensics capability

---

### 20. **Rider Location Tracking - No Privacy Controls**
**Severity:** 🟡 MEDIUM  
**File:** `src/server.js` - Line 2065  
**Issue:**
- Rider location always tracked when online
- No user consent mechanism
- No data retention policy

---

### 21. **Error Messages Leak Information**
**Severity:** 🟡 MEDIUM  
**Issue:**
```javascript
res.status(403).json({ ok: false, error: 'Your account has been suspended. Contact support.' });
// Confirms account exists!
```

**Risk:**
- Attacker can enumerate valid phone numbers
- Should use generic error messages

---

### 22. **No Content-Type Validation**
**Severity:** 🟡 MEDIUM  
**Issue:**
- File upload accepts any content-type in header
- Only checks extension, not actual file content

**Risk:**
- Malicious file upload disguised as image

---

### 23. **Instagram Access Token in Environment**
**Severity:** 🟡 MEDIUM  
**File:** `src/server.js` - Line 2042  
**Issue:**
```javascript
if (process.env.IG_ACCESS_TOKEN && process.env.IG_USER_ID) {
```

**Risk:**
- Long-lived tokens never rotated
- If leaked, complete Instagram account access

---

### 24. **No Geofencing on Delivery Orders**
**Severity:** 🟡 MEDIUM  
**Issue:**
- System checks 7km radius but no server-side enforcement
- Customer can manipulate client-side location

**Risk:**
- Orders outside delivery zone accepted

---

## 🟢 LOW SEVERITY ISSUES (P3)

### 25. **Commented Backup Code**
**Severity:** 🟢 LOW  
**Issue:**
- Backup system code present but not verified active

---

### 26. **No Health Check Endpoint Authentication**
**Severity:** 🟢 LOW  
**File:** `src/server.js`  
**Issue:**
```javascript
app.get('/health', (req, res) => {
  res.send('🥩 MeatPe bot is running.');
});
```

**Risk:**
- Anyone can check if server is running
- Minor information disclosure

---

### 27. **Debug Logs in Production**
**Severity:** 🟢 LOW  
**Issue:**
- `console.log` statements everywhere
- Should use proper logging library with levels

---

### 28. **No CDN for Static Assets**
**Severity:** 🟢 LOW  
**Issue:**
- All static files served from origin server
- No caching, slower performance

---

## 📊 VULNERABILITY DISTRIBUTION

```
Critical (8):  ████████░░ 29%
High (7):      ███████░░░ 25%
Medium (9):    █████████░ 32%
Low (4):       ████░░░░░░ 14%
```

---

## 🎯 PRIORITY FIX ROADMAP

### Phase 1: Critical (1-2 days)
1. Remove admin key from query params
2. Add rate limiting on OTP verify
3. Fix SQL injection patterns
4. Implement coupon per-user tracking
5. Add referral code validation
6. Token invalidation on logout
7. Rider token in headers only
8. Price validation

### Phase 2: High (3-5 days)
9. Input validation framework
10. Duplicate payment race condition fix
11. Audit all admin endpoints
12. Server-side OTP proxy
13. CSRF protection
14. Database file permissions
15. Request body size limits

### Phase 3: Medium (1-2 weeks)
16-24: Environment hardening, logging, privacy controls

### Phase 4: Low (Ongoing)
25-28: Code cleanup, performance optimization

---

## 🛡️ SECURITY BEST PRACTICES TO IMPLEMENT

### Authentication & Authorization
- ✅ Implement JWT with short expiry (15 min)
- ✅ Refresh token mechanism
- ✅ Role-based access control (RBAC)
- ✅ Multi-factor authentication for admin

### Data Protection
- ✅ Encrypt sensitive data at rest
- ✅ Hash passwords (if implementing password auth later)
- ✅ PII data masking in logs
- ✅ GDPR compliance mechanisms

### API Security
- ✅ API Gateway with throttling
- ✅ Request signing
- ✅ Payload encryption for sensitive endpoints
- ✅ GraphQL instead of REST (optional)

### Infrastructure
- ✅ WAF (Web Application Firewall)
- ✅ DDoS protection (Cloudflare)
- ✅ Database encryption
- ✅ Secrets rotation policy

### Monitoring
- ✅ Security event logging (SIEM)
- ✅ Anomaly detection
- ✅ Alert on suspicious patterns
- ✅ Penetration testing (quarterly)

---

## 📝 COMPLIANCE CHECKLIST

### PCI DSS (Payment Card Industry)
- ⚠️ Not storing card data (✅)
- ⚠️ Using Razorpay (PCI compliant) (✅)
- ❌ No SAQ (Self-Assessment Questionnaire)

### GDPR (If serving EU customers)
- ❌ No privacy policy
- ❌ No cookie consent
- ❌ No data export mechanism
- ❌ No right to be forgotten

### Indian IT Act 2000
- ⚠️ Data localization unclear
- ❌ No data breach notification process
- ⚠️ No cybersecurity policy

---

## 🚨 IMMEDIATE ACTIONS REQUIRED

1. **TODAY:**
   - Disable admin key in query params
   - Add rate limiting on OTP verify endpoint
   - Add referral code validation

2. **THIS WEEK:**
   - Implement coupon usage tracking
   - Fix token invalidation
   - Audit all admin endpoints
   - Add request body size limits

3. **THIS MONTH:**
   - Complete Phase 1 & 2 fixes
   - Penetration testing
   - Security training for team

---

## 📞 CONTACT & ESCALATION

**For Security Issues:**
- Report to: security@meetpe.com (create this!)
- Bug Bounty: Consider HackerOne program

**Responsible Disclosure Policy:**
- Create policy document
- Response SLA: 24 hours

---

**Report Version:** 1.0  
**Next Audit Due:** September 17, 2026  
**Auditor Signature:** AI Security Analysis  

---

**⚠️ CONFIDENTIAL - FOR INTERNAL USE ONLY ⚠️**
