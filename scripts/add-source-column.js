const db = require('../src/db/init');
try {
  db.prepare("ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'web'").run();
  console.log('source column added');
} catch (e) {
  if (/duplicate column/i.test(e.message)) console.log('source column already exists');
  else throw e;
}
db.prepare("UPDATE orders SET source = 'web' WHERE source IS NULL OR source = ''").run();
console.log('done');
