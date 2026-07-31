const db = require('../src/db/init');
const phones = ['whatsapp:+919876543210', 'whatsapp:+919999988888', 'whatsapp:+919999999999', 'whatsapp:+919998887777'];
for (const p of phones) {
  db.prepare('DELETE FROM orders WHERE phone = ?').run(p);
  db.prepare('DELETE FROM customers WHERE phone = ?').run(p);
  db.prepare('DELETE FROM rewards WHERE phone = ?').run(p);
}
db.prepare('DELETE FROM sessions').run();
console.log('Test data cleaned');
