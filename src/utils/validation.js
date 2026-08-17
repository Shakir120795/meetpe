// Input Validation Framework - Centralized validation utilities
// Prevents XSS, SQL injection (via sanitization), and malformed inputs

/**
 * Sanitize string input - remove HTML tags and dangerous characters
 * @param {string} str - Input string
 * @param {number} maxLen - Maximum length (default 500)
 * @returns {string} Sanitized string
 */
function sanitizeStr(str, maxLen = 500) {
  if (!str) return '';
  return String(str)
    .replace(/<[^>]*>/g, '') // strip HTML tags
    .replace(/[<>"']/g, '') // strip dangerous chars
    .trim()
    .slice(0, maxLen);
}

/**
 * Validate and sanitize phone number (Indian format)
 * @param {string} phone - Phone number
 * @returns {{ valid: boolean, clean: string, error?: string }}
 */
function validatePhone(phone) {
  if (!phone) return { valid: false, error: 'Phone number required' };
  
  const clean = String(phone).replace(/\D/g, '').slice(-10);
  
  if (clean.length !== 10) {
    return { valid: false, error: 'Phone must be 10 digits' };
  }
  
  // Indian mobile numbers start with 6-9
  if (!/^[6-9]/.test(clean)) {
    return { valid: false, error: 'Invalid Indian phone number' };
  }
  
  return { valid: true, clean };
}

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {{ valid: boolean, clean: string, error?: string }}
 */
function validateEmail(email) {
  if (!email) return { valid: false, error: 'Email required' };
  
  const clean = String(email).trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(clean)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  if (clean.length > 100) {
    return { valid: false, error: 'Email too long' };
  }
  
  return { valid: true, clean };
}

/**
 * Validate integer with min/max bounds
 * @param {any} value - Value to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {{ valid: boolean, value: number, error?: string }}
 */
function validateInt(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const num = parseInt(value, 10);
  
  if (!Number.isFinite(num)) {
    return { valid: false, error: 'Must be a valid number' };
  }
  
  if (num < min) {
    return { valid: false, error: `Must be at least ${min}` };
  }
  
  if (num > max) {
    return { valid: false, error: `Must be at most ${max}` };
  }
  
  return { valid: true, value: num };
}

/**
 * Validate float with min/max bounds
 * @param {any} value - Value to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {{ valid: boolean, value: number, error?: string }}
 */
function validateFloat(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const num = parseFloat(value);
  
  if (!Number.isFinite(num)) {
    return { valid: false, error: 'Must be a valid number' };
  }
  
  if (num < min) {
    return { valid: false, error: `Must be at least ${min}` };
  }
  
  if (num > max) {
    return { valid: false, error: `Must be at most ${max}` };
  }
  
  return { valid: true, value: num };
}

/**
 * Validate address (object or string)
 * @param {any} address - Address input
 * @returns {{ valid: boolean, address: string, lat?: number, lon?: number, error?: string }}
 */
function validateAddress(address) {
  if (!address) return { valid: false, error: 'Address required' };
  
  try {
    // Try parsing as JSON (location object)
    if (typeof address === 'object') {
      const addr = address.address || address.label || '';
      const lat = address.lat || address.latitude;
      const lon = address.lon || address.longitude;
      
      if (!addr || addr.trim().length < 10) {
        return { valid: false, error: 'Address too short (min 10 characters)' };
      }
      
      if (lat !== undefined && lon !== undefined) {
        const latValid = validateFloat(lat, -90, 90);
        const lonValid = validateFloat(lon, -180, 180);
        
        if (!latValid.valid || !lonValid.valid) {
          return { valid: false, error: 'Invalid coordinates' };
        }
        
        return { valid: true, address: sanitizeStr(addr, 500), lat: latValid.value, lon: lonValid.value };
      }
      
      return { valid: true, address: sanitizeStr(addr, 500) };
    }
    
    // Plain string address
    const addr = String(address).trim();
    if (addr.length < 10) {
      return { valid: false, error: 'Address too short (min 10 characters)' };
    }
    
    if (addr.length > 500) {
      return { valid: false, error: 'Address too long (max 500 characters)' };
    }
    
    return { valid: true, address: sanitizeStr(addr, 500) };
  } catch (e) {
    return { valid: false, error: 'Invalid address format' };
  }
}

/**
 * Validate order items array
 * @param {any} items - Items array
 * @returns {{ valid: boolean, items: Array, error?: string }}
 */
function validateOrderItems(items) {
  if (!Array.isArray(items)) {
    return { valid: false, error: 'Items must be an array' };
  }
  
  if (items.length === 0) {
    return { valid: false, error: 'At least one item required' };
  }
  
  if (items.length > 50) {
    return { valid: false, error: 'Maximum 50 items per order' };
  }
  
  const validItems = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Item ${i + 1} is invalid` };
    }
    
    if (!item.code || typeof item.code !== 'string') {
      return { valid: false, error: `Item ${i + 1} missing code` };
    }
    
    const qtyValid = validateInt(item.qty, 1, 100);
    if (!qtyValid.valid) {
      return { valid: false, error: `Item ${i + 1} quantity ${qtyValid.error}` };
    }
    
    validItems.push({
      code: sanitizeStr(item.code, 20),
      qty: qtyValid.value
    });
  }
  
  return { valid: true, items: validItems };
}

/**
 * Validate coupon code format
 * @param {string} code - Coupon code
 * @returns {{ valid: boolean, code: string, error?: string }}
 */
function validateCouponCode(code) {
  if (!code) return { valid: true, code: '' }; // Optional field
  
  const clean = String(code).trim().toUpperCase();
  
  if (!/^[A-Z0-9]{3,20}$/.test(clean)) {
    return { valid: false, error: 'Coupon code must be 3-20 alphanumeric characters' };
  }
  
  return { valid: true, code: clean };
}

/**
 * Validate payment method
 * @param {string} method - Payment method
 * @returns {{ valid: boolean, method: string, error?: string }}
 */
function validatePaymentMethod(method) {
  const allowed = ['cod', 'upi', 'pay_online'];
  const clean = String(method || 'cod').toLowerCase();
  
  if (!allowed.includes(clean)) {
    return { valid: false, error: 'Invalid payment method' };
  }
  
  return { valid: true, method: clean };
}

/**
 * Validate order status
 * @param {string} status - Order status
 * @returns {{ valid: boolean, status: string, error?: string }}
 */
function validateOrderStatus(status) {
  const allowed = ['placed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
  const clean = String(status || '').toLowerCase();
  
  if (!allowed.includes(clean)) {
    return { valid: false, error: 'Invalid order status' };
  }
  
  return { valid: true, status: clean };
}

/**
 * Validate rider status
 * @param {string} status - Rider status
 * @returns {{ valid: boolean, status: string, error?: string }}
 */
function validateRiderStatus(status) {
  const allowed = ['available', 'busy', 'offline'];
  const clean = String(status || '').toLowerCase();
  
  if (!allowed.includes(clean)) {
    return { valid: false, error: 'Invalid rider status' };
  }
  
  return { valid: true, status: clean };
}

/**
 * Validate coordinates (lat/lon)
 * @param {any} lat - Latitude
 * @param {any} lon - Longitude
 * @returns {{ valid: boolean, lat: number, lon: number, error?: string }}
 */
function validateCoordinates(lat, lon) {
  const latValid = validateFloat(lat, -90, 90);
  const lonValid = validateFloat(lon, -180, 180);
  
  if (!latValid.valid) {
    return { valid: false, error: 'Invalid latitude: ' + latValid.error };
  }
  
  if (!lonValid.valid) {
    return { valid: false, error: 'Invalid longitude: ' + lonValid.error };
  }
  
  return { valid: true, lat: latValid.value, lon: lonValid.value };
}

/**
 * Validate date string (ISO 8601)
 * @param {string} dateStr - Date string
 * @returns {{ valid: boolean, date: Date, error?: string }}
 */
function validateDate(dateStr) {
  if (!dateStr) return { valid: false, error: 'Date required' };
  
  const date = new Date(dateStr);
  
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }
  
  return { valid: true, date };
}

/**
 * Validate ID (positive integer)
 * @param {any} id - ID value
 * @returns {{ valid: boolean, id: number, error?: string }}
 */
function validateId(id) {
  const result = validateInt(id, 1, Number.MAX_SAFE_INTEGER);
  return { ...result, id: result.value };
}

/**
 * Escape LIKE wildcards for SQL LIKE queries
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeLikeWildcards(str) {
  if (!str) return '';
  return String(str).replace(/[_%]/g, '\\$&');
}

module.exports = {
  sanitizeStr,
  validatePhone,
  validateEmail,
  validateInt,
  validateFloat,
  validateAddress,
  validateOrderItems,
  validateCouponCode,
  validatePaymentMethod,
  validateOrderStatus,
  validateRiderStatus,
  validateCoordinates,
  validateDate,
  validateId,
  escapeLikeWildcards
};
