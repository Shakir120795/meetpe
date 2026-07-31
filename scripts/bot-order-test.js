// Simulate a bot order to test source = 'whatsapp'
const { handleMessage } = require('../src/whatsapp/bot');
const phone = 'whatsapp:+919998887777';
const steps = ['hi', 'A', 'add C2 1', 'order', 'Test address bot order', 'confirm'];
for (const s of steps) {
  console.log(`>>> ${s}`);
  console.log(handleMessage({ from: phone, body: s }).split('\n').slice(0,3).join('\n'));
  console.log('---');
}
