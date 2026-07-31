// Test that bot rejects out-of-stock items and suggests alternatives
process.env.DB_PATH = './data/meatpe-stock-test.db';
const fs = require('fs');
try { fs.unlinkSync(process.env.DB_PATH); } catch (_) {}

const { handleMessage } = require('../src/whatsapp/bot');
const phone = 'whatsapp:+919999999999';

console.log('--- Trying to add C1 (currently OUT OF STOCK) ---');
console.log(handleMessage({ from: phone, body: 'add c1 1' }));

console.log('\n--- Trying to add C2 (in stock) ---');
console.log(handleMessage({ from: phone, body: 'add c2 1' }));

console.log('\n--- Listing chicken category (should show C1 with OOS marker) ---');
console.log(handleMessage({ from: phone, body: 'A' }));
