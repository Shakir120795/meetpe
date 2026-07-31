// Smoke test — simulates a WhatsApp conversation without Twilio
process.env.DB_PATH = './data/meatpe-test.db';
const fs = require('fs');
try { fs.unlinkSync(process.env.DB_PATH); } catch (_) {}

const { handleMessage } = require('../src/whatsapp/bot');

const phone = 'whatsapp:+919999988888';
const steps = [
  'hi',
  '1',          // menu
  'A',          // chicken
  'add C1 2',   // 2 x premium chicken (520)
  'D',          // ready to cook
  'add R3 1',   // seekh kebab (240) -> total 760 -> free delivery + reward
  'cart',
  'order',
  '12 MG Road, Sikandra, Agra, near St. Conrads, 282007',
  'confirm',
  'rewards',
];

for (const s of steps) {
  console.log(`\n>>> ${s}`);
  const reply = handleMessage({ from: phone, body: s });
  console.log(reply);
  console.log('---');
}
