# 🔒 Phase 2: Security Fixes - Analysis & Implementation

**Date:** August 17, 2026  
**Status:** 🔄 IN PROGRESS

---

## 📋 Issues to Fix (7 Total)

| # | Issue | Priority | Status |
|---|-------|----------|--------|
| 1 | Input validation framework | HIGH | ⏳ Analyzing |
| 2 | Payment race condition fix | CRITICAL | ⏳ Analyzing |
| 3 | Admin endpoint audit | HIGH | ⏳ Analyzing |
| 4 | MSG91 server-side proxy | MEDIUM | ⏳ Analyzing |
| 5 | CSRF protection | HIGH | ⏳ Analyzing |
| 6 | Database permissions | MEDIUM | ⏳ Analyzing |
| 7 | Request size limits | MEDIUM | ⏳ Analyzing |

---

## 🔍 ISSUE #1: Input Validation Framework

### Current State:
- Basic sanitization exists: `sanitizeStr()` function (line ~204)
- Phone number validation: `.replace(/\D/g, '')`
- Limited validation on other inputs

### Required Fixes:
1. ✅ Create centralized validation library
2. ✅ Add schema validation for all endpoints
3. ✅ Implement XSS protection
4. ✅ Add SQL injection prevention (already done via parameterized queries)
5. ✅ Validate all numeric inputs
6. ✅ Email/phone format validation

### Implementation Plan:
- Create `src/utils/validation.js`
- Use validator.js or custom validators
- Apply to all POST/PUT endpoints

---

## 🔍 ISSUE #2: Payment Race Condition Fix

### Current State:
- Wallet deduction uses transaction (line ~568)
- Race condition check exists: `WHERE wallet_balance >= ?`
- Retry logic present in order creation

### Potential Vulnerabilities:
- Multiple concurrent membership purchases
- Wallet topup verification (payment_id duplicate check exists)
- Coupon usage (UNIQUE constraint exists)

### Required Fixes:
1. ✅ Add database-level locking for wallet operations
2. ✅ Implement optimistic locking with version field
3. ✅ Add transaction isolation level
4. ✅ Verify all payment endpoints have duplicate checks

### Implementation Plan:
- Add `wallet_version` column to customers table
- Use `BEGIN IMMEDIATE TRANSACTION` for wallet ops
- Add retry logic with exponential backoff

---

## 🔍 ISSUE #3: Admin Endpoint Audit

### Current State:
- Global middleware: `app.use('/admin', adminLimiter, requireAdmin)` (line ~265)
- All `/admin/*` routes protected
- Brute force protection on admin auth

### Potential Issues:
- Check for endpoints that should be admin but aren't prefixed with `/admin`
- Verify no query param fallback for admin key

### Required Audit:
1. ✅ List all sensitive endpoints
2. ✅ Verify admin middleware applied
3. ✅ Check for authorization bypass
4. ✅ Audit logging for admin actions

### Implementation Plan:
- Scan all routes for sensitive operations
- Ensure consistent admin protection
- Add audit logging middleware

---

## 🔍 ISSUE #4: MSG91 Server-Side Proxy

### Current State:
- MSG91 widget token injected server-side (line ~286, ~301)
- Token exposed in HTML: `%%MSG91_TOKEN%%`
- Client-side OTP verification

### Security Risk:
- Widget token visible in browser source
- Potential for token theft/abuse

### Required Fixes:
1. ✅ Create server-side proxy for MSG91 API
2. ✅ Hide widget token from client
3. ✅ Rate limit proxy endpoint
4. ✅ Validate all MSG91 requests server-side

### Implementation Plan:
- Create `/api/msg91-proxy` endpoint
- Move widget initialization to server
- Return only necessary data to client

---

## 🔍 ISSUE #5: CSRF Protection

### Current State:
- No CSRF tokens implemented
- CORS configured (line ~58-70)
- SameSite cookie policy missing

### Vulnerability:
- State-changing operations vulnerable to CSRF
- No token validation on POST/PUT/DELETE

### Required Fixes:
1. ✅ Implement CSRF token generation
2. ✅ Add token validation middleware
3. ✅ Set SameSite cookie policy
4. ✅ Exempt safe methods (GET, HEAD, OPTIONS)

### Implementation Plan:
- Use `csurf` package
- Generate tokens on session creation
- Validate on all state-changing requests
- Add to customer sessions table

---

## 🔍 ISSUE #6: Database Permissions

### Current State:
- SQLite database (file-based)
- File permissions need verification
- No user-level restrictions in SQLite

### Required Fixes:
1. ✅ Set proper file permissions on `data/meatpe.db`
2. ✅ Ensure only Node.js process can access
3. ✅ Add read-only mode for backups
4. ✅ Document permission requirements

### Implementation Plan:
- Check current permissions: `ls -la data/`
- Set restrictive permissions: `chmod 600 data/meatpe.db`
- Update deployment docs
- Add permission check on startup

---

## 🔍 ISSUE #7: Request Size Limits

### Current State:
- Body parser limits: `{ limit: '1mb' }` (line ~263)
- Multer file size: `5MB` (line ~227)

### Required Improvements:
1. ✅ Add per-endpoint size limits
2. ✅ Implement request timeout
3. ✅ Add connection limits
4. ✅ Prevent slowloris attacks

### Implementation Plan:
- Use `express-slow-down` for rate throttling
- Add `timeout` middleware
- Configure server timeouts
- Set max connections

---

## 📝 Implementation Priority

### Phase 2A (Critical - Today):
1. 🔴 Payment race condition fix
2. 🔴 CSRF protection
3. 🔴 Input validation framework

### Phase 2B (High - This Week):
4. 🟡 Admin endpoint audit
5. 🟡 MSG91 server-side proxy

### Phase 2C (Medium - Next Week):
6. 🟢 Database permissions
7. 🟢 Request size limits enhancement

---

**Next Step:** Start implementation with Issue #1 (Input Validation Framework)
