// Cleanup duplicate customers and migrate order addresses to saved_addresses
const Database = require('better-sqlite3');
const { createBackup } = require('./backup');

const dbPath = process.env.DB_PATH || './data/meatpe.db';
const db = new Database(dbPath);

console.log('🔄 Starting data cleanup and migration...\n');

// STEP 1: Backup first
console.log('📦 Creating backup before cleanup...');
createBackup();

// STEP 2: Merge duplicate customers (web: + whatsapp: prefixes)
console.log('\n🔍 Finding duplicate customers...');

const allCustomers = db.prepare('SELECT phone, name, wallet_balance, created_at FROM customers ORDER BY created_at ASC').all();
const phoneMap = new Map(); // clean phone -> customer data

allCustomers.forEach(c => {
  const cleanPhone = c.phone.replace(/^(web:|whatsapp:)/, '');
  
  if (!phoneMap.has(cleanPhone)) {
    phoneMap.set(cleanPhone, {
      web: null,
      whatsapp: null,
      cleanPhone
    });
  }
  
  const entry = phoneMap.get(cleanPhone);
  if (c.phone.startsWith('web:')) {
    entry.web = c;
  } else if (c.phone.startsWith('whatsapp:')) {
    entry.whatsapp = c;
  }
});

// Find duplicates
const duplicates = [];
phoneMap.forEach((entry, cleanPhone) => {
  if (entry.web && entry.whatsapp) {
    duplicates.push(entry);
  }
});

console.log(`Found ${duplicates.length} duplicate customers\n`);

if (duplicates.length > 0) {
  console.log('🔧 Merging duplicates...');
  
  duplicates.forEach(dup => {
    const webPhone = dup.web.phone;
    const waPhone = dup.whatsapp.phone;
    
    console.log(`  Merging: ${waPhone} -> ${webPhone}`);
    console.log(`    Web name: ${dup.web.name || '(empty)'}`);
    console.log(`    WhatsApp name: ${dup.whatsapp.name || '(empty)'}`);
    
    // Use better name (non-empty, longer one)
    let betterName = dup.web.name || dup.whatsapp.name;
    if (dup.whatsapp.name && dup.whatsapp.name.length > (dup.web.name || '').length) {
      betterName = dup.whatsapp.name;
    }
    
    // Merge wallet balances
    const totalWallet = (dup.web.wallet_balance || 0) + (dup.whatsapp.wallet_balance || 0);
    
    // Update web: entry with merged data
    db.prepare(`
      UPDATE customers 
      SET name = ?, wallet_balance = ?
      WHERE phone = ?
    `).run(betterName, totalWallet, webPhone);
    
    // Update all orders from whatsapp: to web:
    db.prepare('UPDATE orders SET phone = ? WHERE phone = ?').run(webPhone, waPhone);
    
    // Update all saved_addresses from whatsapp: to web:
    db.prepare('UPDATE saved_addresses SET phone = ? WHERE phone = ?').run(webPhone, waPhone);
    
    // Update all reviews from whatsapp: to web:
    db.prepare('UPDATE reviews SET phone = ? WHERE phone = ?').run(webPhone, waPhone);
    
    // Update all rewards from whatsapp: to web:
    db.prepare('UPDATE rewards SET phone = ? WHERE phone = ?').run(webPhone, waPhone);
    
    // Delete whatsapp: customer entry
    db.prepare('DELETE FROM customers WHERE phone = ?').run(waPhone);
    
    console.log(`    ✅ Merged successfully (Name: ${betterName}, Wallet: ₹${totalWallet})\n`);
  });
}

// STEP 3: Migrate order addresses to saved_addresses
console.log('\n📍 Migrating order addresses to saved_addresses...');

const allOrders = db.prepare(`
  SELECT DISTINCT phone, address 
  FROM orders 
  WHERE address IS NOT NULL AND address != ''
  ORDER BY phone, created_at DESC
`).all();

const addressMap = new Map(); // phone -> Set of addresses

allOrders.forEach(o => {
  if (!addressMap.has(o.phone)) {
    addressMap.set(o.phone, new Set());
  }
  addressMap.get(o.phone).add(o.address);
});

let migratedCount = 0;

addressMap.forEach((addresses, phone) => {
  const existing = db.prepare('SELECT address FROM saved_addresses WHERE phone = ?').all(phone);
  const existingAddresses = new Set(existing.map(a => a.address.trim().toLowerCase()));
  
  let isFirst = existing.length === 0; // First address becomes default
  
  addresses.forEach(address => {
    const cleanAddr = address.trim();
    if (!cleanAddr || cleanAddr.length < 5) return; // Skip invalid addresses
    
    // Check if already exists (case-insensitive)
    if (existingAddresses.has(cleanAddr.toLowerCase())) {
      return; // Skip duplicate
    }
    
    try {
      db.prepare(`
        INSERT INTO saved_addresses (phone, tag, address, is_default)
        VALUES (?, ?, ?, ?)
      `).run(phone, 'Home', cleanAddr, isFirst ? 1 : 0);
      
      migratedCount++;
      isFirst = false;
      existingAddresses.add(cleanAddr.toLowerCase());
      
      console.log(`  ✅ Migrated address for ${phone}: ${cleanAddr.substring(0, 50)}...`);
    } catch (e) {
      console.warn(`  ⚠️  Failed to migrate address: ${e.message}`);
    }
  });
});

console.log(`\n✅ Migrated ${migratedCount} addresses to saved_addresses table\n`);

// STEP 4: Final stats
console.log('📊 Final Statistics:');
const stats = {
  customers: db.prepare('SELECT COUNT(*) as count FROM customers').get().count,
  orders: db.prepare('SELECT COUNT(*) as count FROM orders').get().count,
  saved_addresses: db.prepare('SELECT COUNT(*) as count FROM saved_addresses').get().count,
  reviews: db.prepare('SELECT COUNT(*) as count FROM reviews').get().count
};

console.log(`  Customers: ${stats.customers}`);
console.log(`  Orders: ${stats.orders}`);
console.log(`  Saved Addresses: ${stats.saved_addresses}`);
console.log(`  Reviews: ${stats.reviews}`);

db.close();

console.log('\n✅ Cleanup and migration completed successfully!');
console.log('📦 Backup was created before any changes');
console.log('🔄 Please restart the server: pm2 restart meetpe\n');
