// Security Middleware - CSRF protection, request validation, audit logging
const crypto = require('crypto');

// ===== CSRF Protection (Token-based for state-changing operations) =====

/**
 * Generate CSRF token for session
 * @param {string} sessionId - Session identifier
 * @returns {string} CSRF token
 */
function generateCSRFToken(sessionId) {
  const secret = process.env.CSRF_SECRET || 'meetpe-csrf-secret-change-in-production';
  const timestamp = Date.now();
  const data = `${sessionId}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return `${timestamp}.${hmac}`;
}

/**
 * Verify CSRF token
 * @param {string} token - CSRF token from request
 * @param {string} sessionId - Session identifier
 * @param {number} maxAge - Maximum token age in milliseconds (default 24 hours)
 * @returns {boolean} Token validity
 */
function verifyCSRFToken(token, sessionId, maxAge = 24 * 60 * 60 * 1000) {
  if (!token || !sessionId) return false;
  
  try {
    const [timestamp, hmac] = token.split('.');
    if (!timestamp || !hmac) return false;
    
    // Check token age
    const tokenTime = parseInt(timestamp, 10);
    if (Date.now() - tokenTime > maxAge) return false;
    
    // Verify HMAC
    const secret = process.env.CSRF_SECRET || 'meetpe-csrf-secret-change-in-production';
    const data = `${sessionId}:${timestamp}`;
    const expectedHmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
    
    // Timing-safe comparison
    if (hmac.length !== expectedHmac.length) return false;
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));
  } catch (e) {
    return false;
  }
}

/**
 * CSRF protection middleware for state-changing requests
 * Checks X-CSRF-Token header against session
 */
function csrfProtection(req, res, next) {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Skip CSRF for localhost development
  if (req.hostname === 'localhost' || req.hostname === '127.0.0.1') {
    return next();
  }
  
  // Get session phone (from auth middleware)
  const sessionPhone = req.sessionPhone;
  if (!sessionPhone) {
    // No session - skip CSRF (will be caught by requireAuth if needed)
    return next();
  }
  
  // Get CSRF token from header
  const csrfToken = req.headers['x-csrf-token'];
  if (!csrfToken) {
    return res.status(403).json({ ok: false, error: 'CSRF token missing' });
  }
  
  // Verify token
  if (!verifyCSRFToken(csrfToken, sessionPhone)) {
    return res.status(403).json({ ok: false, error: 'Invalid CSRF token' });
  }
  
  next();
}

// ===== Request Size & Timeout Protection =====

/**
 * Request timeout middleware
 * @param {number} timeout - Timeout in milliseconds (default 30s)
 */
function requestTimeout(timeout = 30000) {
  return (req, res, next) => {
    // Set timeout for request
    req.setTimeout(timeout, () => {
      res.status(408).json({ ok: false, error: 'Request timeout' });
    });
    
    // Set timeout for response
    res.setTimeout(timeout, () => {
      if (!res.headersSent) {
        res.status(504).json({ ok: false, error: 'Response timeout' });
      }
    });
    
    next();
  };
}

// ===== Admin Action Audit Logging =====

/**
 * Audit log for admin actions
 * Logs all admin state-changing operations
 */
function adminAuditLog(req, res, next) {
  // Only log state-changing methods
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return next();
  }
  
  // Log admin action
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const method = req.method;
  const path = req.path;
  const body = req.body ? JSON.stringify(req.body).slice(0, 200) : 'N/A';
  
  console.log(`🔐 [ADMIN AUDIT] ${timestamp} | ${ip} | ${method} ${path} | Body: ${body}`);
  
  // Store response status for logging
  const originalSend = res.send;
  res.send = function(data) {
    const status = res.statusCode;
    console.log(`🔐 [ADMIN AUDIT RESPONSE] ${timestamp} | ${method} ${path} | Status: ${status}`);
    originalSend.call(this, data);
  };
  
  next();
}

// ===== Input Validation Middleware Factory =====

/**
 * Create validation middleware from schema
 * @param {Object} schema - Validation schema { field: validatorFn }
 * @returns {Function} Express middleware
 */
function validateRequest(schema) {
  return (req, res, next) => {
    const errors = [];
    const source = req.method === 'GET' ? req.query : req.body;
    
    for (const [field, validator] of Object.entries(schema)) {
      const value = source[field];
      const result = validator(value);
      
      if (!result.valid) {
        errors.push(`${field}: ${result.error}`);
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, error: errors.join('; ') });
    }
    
    next();
  };
}

// ===== Suspicious Activity Detection =====

// Track suspicious activity per IP
const suspiciousActivity = new Map(); // ip -> { count, resetAt, blocked }

/**
 * Detect and block suspicious patterns
 * - Rapid failed requests
 * - Invalid input patterns
 * - Potential attack vectors
 */
function suspiciousActivityDetector(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  
  // Get or create activity tracker
  let activity = suspiciousActivity.get(ip);
  if (!activity || now > activity.resetAt) {
    activity = { count: 0, resetAt: now + 15 * 60 * 1000, blocked: false };
    suspiciousActivity.set(ip, activity);
  }
  
  // Check if IP is blocked
  if (activity.blocked) {
    return res.status(403).json({ ok: false, error: 'Suspicious activity detected. Access temporarily blocked.' });
  }
  
  // Track response status
  const originalStatus = res.status;
  res.status = function(code) {
    // Increment counter on client errors (400-499)
    if (code >= 400 && code < 500) {
      activity.count++;
      
      // Block if too many failed requests (20 in 15 minutes)
      if (activity.count >= 20) {
        activity.blocked = true;
        console.warn(`⚠️ [SUSPICIOUS] IP ${ip} blocked due to ${activity.count} failed requests`);
      }
    }
    
    return originalStatus.call(this, code);
  };
  
  next();
}

// ===== Double-Submit Cookie Pattern (Alternative to CSRF tokens) =====

/**
 * Generate double-submit cookie value
 * @returns {string} Random token
 */
function generateDoubleSubmitToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Double-submit cookie middleware
 * Sets a random cookie and expects it back in header
 */
function doubleSubmitCookie(req, res, next) {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Skip for localhost
  if (req.hostname === 'localhost' || req.hostname === '127.0.0.1') {
    return next();
  }
  
  // Check cookie exists
  const cookieToken = req.cookies?._csrf;
  const headerToken = req.headers['x-csrf-token'];
  
  if (!cookieToken || !headerToken) {
    return res.status(403).json({ ok: false, error: 'CSRF protection: token missing' });
  }
  
  // Verify tokens match
  if (cookieToken !== headerToken) {
    return res.status(403).json({ ok: false, error: 'CSRF protection: token mismatch' });
  }
  
  next();
}

/**
 * Set CSRF cookie for double-submit pattern
 */
function setCSRFCookie(req, res, next) {
  // Set cookie if not exists
  if (!req.cookies?._csrf) {
    const token = generateDoubleSubmitToken();
    res.cookie('_csrf', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
  }
  next();
}

module.exports = {
  generateCSRFToken,
  verifyCSRFToken,
  csrfProtection,
  requestTimeout,
  adminAuditLog,
  validateRequest,
  suspiciousActivityDetector,
  doubleSubmitCookie,
  setCSRFCookie,
  generateDoubleSubmitToken
};
