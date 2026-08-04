const Database = require('better-sqlite3');
const db = new Database('./data/meatpe.db');

console.log('=== CHECKING PHONE NUMBER FORMATS ===\n');

// Get all unique phone numbers
const phones = db.prepare('SELECT DISTINCT phone FROM orders ORDER BY phone').all();

console.log('Total unique phone numbers:', phones.length);
console.log('\nAll phone formats:');
phones.forEach((row, i) => {
  console.log(`${i + 1}. "${row.phone}"`);
});

// Check patterns
console.log('\n=== PATTERN ANALYSIS ===');
const patterns = {};
phones.forEach(row => {
  const phone = row.phone;
  let pattern = 'other';
  if (phone.startsWith('web:')) pattern = 'web:';
  else if (phone.startsWith('whatsapp:')) pattern = 'whatsapp:';
  else if (phone.startsWith('+')) pattern = 'plain +91';
  else if (phone.match(/^\d/)) pattern = 'plain digits';
  
  patterns[pattern] = (patterns[pattern] || 0) + 1;
});

console.log('Pattern breakdown:');
Object.entries(patterns).forEach(([pattern, count]) => {
  console.log(`  ${pattern}: ${count} entries`);
});

// Check if +918126812317 exists in different formats
console.log('\n=== CHECKING SPECIFIC USER: 8126812317 ===');
const targetPhone = '8126812317';
const variants = db.prepare(`
  SELECT phone, COUNT(*) as order_count 
  FROM orders 
  WHERE phone LIKE '%${targetPhone}%'
  GROUP BY phone
`).all();

if (variants.length === 0) {
  console.log('No orders found for this phone number');
} else {
  console.log('Found in these formats:');
  variants.forEach(v => {
    console.log(`  "${v.phone}" - ${v.order_count} orders`);
  });
}

db.close();
