// Safe database migrations - NEVER deletes data
const Database = require('better-sqlite3');
const { createBackup } = require('./backup');

/**
 * Apply all pending migrations safely
 * RULE: Migrations can only ADD, never DELETE or DROP
 * @param {Database} db - Database instance
 */
function applyMigrations(db) {
  console.log('🔄 Checking for pending migrations...');
  
  // Create backup before any schema changes
  createBackup();
  
  // Track applied migrations
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {
    console.warn('⚠️  Migrations table already exists');
  }
  
  const migrations = [
    {
      name: '001_add_payment_method',
      up: () => {
        try {
          db.exec(`ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cod'`);
          console.log('  ✅ Added payment_method column');
        } catch (e) {
          if (!e.message.includes('duplicate column')) throw e;
        }
      }
    },
    {
      name: '002_add_delivery_slot',
      up: () => {
        try {
          db.exec(`ALTER TABLE orders ADD COLUMN delivery_slot TEXT DEFAULT 'asap'`);
          console.log('  ✅ Added delivery_slot column');
        } catch (e) {
          if (!e.message.includes('duplicate column')) throw e;
        }
      }
    },
    {
      name: '003_add_order_notes',
      up: () => {
        try {
          db.exec(`ALTER TABLE orders ADD COLUMN notes TEXT DEFAULT ''`);
          console.log('  ✅ Added notes column');
        } catch (e) {
          if (!e.message.includes('duplicate column')) throw e;
        }
      }
    },
    {
      name: '004_add_customer_blocked',
      up: () => {
        try {
          db.exec(`ALTER TABLE customers ADD COLUMN is_blocked INTEGER DEFAULT 0`);
          console.log('  ✅ Added is_blocked column');
        } catch (e) {
          if (!e.message.includes('duplicate column')) throw e;
        }
      }
    },
    {
      name: '005_add_referral_system',
      up: () => {
        try {
          db.exec(`ALTER TABLE customers ADD COLUMN referred_by TEXT`);
          console.log('  ✅ Added referred_by column');
        } catch (e) {
          if (!e.message.includes('duplicate column')) throw e;
        }
        try {
          db.exec(`ALTER TABLE customers ADD COLUMN referral_code TEXT`);
          console.log('  ✅ Added referral_code column');
        } catch (e) {
          if (!e.message.includes('duplicate column')) throw e;
        }
      }
    },
    {
      name: '006_add_delivery_zones',
      up: () => {
        try {
          db.exec(`ALTER TABLE customers ADD COLUMN delivery_zone TEXT DEFAULT 'zone_a'`);
          console.log('  ✅ Added delivery_zone column');
        } catch (e) {
          if (!e.message.includes('duplicate column')) throw e;
        }
        try {
          db.exec(`ALTER TABLE customers ADD COLUMN delivery_zone_distance REAL DEFAULT 0`);
          console.log('  ✅ Added delivery_zone_distance column');
        } catch (e) {
          if (!e.message.includes('duplicate column')) throw e;
        }
      }
    },
    {
      name: '007_add_membership',
      up: () => {
        try {
          db.exec(`ALTER TABLE customers ADD COLUMN membership_zone TEXT`);
          console.log('  ✅ Added membership_zone column');
        } catch (e) {
          if (!e.message.includes('duplicate column')) throw e;
        }
        try {
          db.exec(`ALTER TABLE customers ADD COLUMN membership_price INTEGER DEFAULT 0`);
          console.log('  ✅ Added membership_price column');
        } catch (e) {
          if (!e.message.includes('duplicate column')) throw e;
        }
        try {
          db.exec(`ALTER TABLE customers ADD COLUMN delivery_credits INTEGER DEFAULT 0`);
          console.log('  ✅ Added delivery_credits column');
        } catch (e) {
          if (!e.message.includes('duplicate column')) throw e;
        }
        try {
          db.exec(`ALTER TABLE customers ADD COLUMN membership_start TEXT`);
          console.log('  ✅ Added membership_start column');
        } catch (e) {
          if (!e.message.includes('duplicate column')) throw e;
        }
      }
    },
    {
      name: '008_add_order_tip',
      up: () => {
        try {
          db.exec(`ALTER TABLE orders ADD COLUMN tip INTEGER DEFAULT 0`);
          console.log('  ✅ Added tip column');
        } catch (e) {
          if (!e.message.includes('duplicate column')) throw e;
        }
      }
    },
    {
      name: '009_add_wallet_transactions_table',
      up: () => {
        try {
          db.exec(`
            CREATE TABLE IF NOT EXISTS wallet_transactions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              phone TEXT NOT NULL,
              payment_id TEXT,
              amount INTEGER NOT NULL,
              type TEXT NOT NULL,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `);
          console.log('  ✅ Created wallet_transactions table');
        } catch (e) {
          if (!e.message.includes('already exists')) throw e;
        }
      }
    }
  ];
  
  // Apply each migration if not already applied
  const appliedMigrations = db.prepare('SELECT name FROM migrations').all().map(m => m.name);
  
  let appliedCount = 0;
  for (const migration of migrations) {
    if (!appliedMigrations.includes(migration.name)) {
      try {
        console.log(`⏳ Applying: ${migration.name}`);
        migration.up();
        db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
        appliedCount++;
      } catch (error) {
        console.error(`❌ Migration ${migration.name} failed:`, error.message);
        throw error; // Stop on first failure
      }
    }
  }
  
  if (appliedCount > 0) {
    console.log(`✅ Applied ${appliedCount} migrations successfully`);
  } else {
    console.log('✅ All migrations up to date');
  }
}

/**
 * Verify database integrity - check for missing columns
 * @param {Database} db - Database instance
 * @returns {Object} Integrity report
 */
function verifyIntegrity(db) {
  console.log('🔍 Verifying database integrity...');
  
  const report = {
    ok: true,
    tables: {},
    warnings: [],
    errors: []
  };
  
  const tables = ['customers', 'orders', 'saved_addresses', 'reviews', 'rewards', 'rider_locations'];
  
  for (const table of tables) {
    try {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all();
      report.tables[table] = {
        exists: true,
        columns: columns.map(c => c.name),
        rowCount: db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count
      };
    } catch (error) {
      report.ok = false;
      report.errors.push(`Table ${table} missing or corrupted: ${error.message}`);
    }
  }
  
  // Check for expected columns in critical tables
  const expectedColumns = {
    customers: ['phone', 'name', 'address', 'wallet_balance', 'referred_by', 'referral_code'],
    orders: ['id', 'phone', 'items_json', 'total', 'status', 'payment_method', 'notes'],
    saved_addresses: ['id', 'phone', 'tag', 'address', 'is_default']
  };
  
  for (const [table, columns] of Object.entries(expectedColumns)) {
    if (report.tables[table]) {
      const actualColumns = report.tables[table].columns;
      for (const col of columns) {
        if (!actualColumns.includes(col)) {
          report.warnings.push(`Missing column: ${table}.${col}`);
        }
      }
    }
  }
  
  if (report.ok && report.warnings.length === 0) {
    console.log('✅ Database integrity verified');
  } else if (report.warnings.length > 0) {
    console.warn('⚠️  Database has warnings:', report.warnings);
  }
  
  if (report.errors.length > 0) {
    console.error('❌ Database has errors:', report.errors);
  }
  
  return report;
}

module.exports = {
  applyMigrations,
  verifyIntegrity
};
