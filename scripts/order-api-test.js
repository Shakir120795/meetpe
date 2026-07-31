// Test the website /api/order endpoint
const http = require('http');

const payload = JSON.stringify({
  name: 'Test User',
  phone: '9876543210',
  address: '123 Test Street, Sikandra, Agra, 282007',
  payment: 'cod',
  notes: 'Curry cut please',
  items: [
    { code: 'C1', qty: 2 },
    { code: 'R3', qty: 1 },
  ],
});

const req = http.request({
  host: 'localhost', port: 3000, path: '/api/order', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
}, (res) => {
  let body = '';
  res.on('data', (c) => body += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
  });
});
req.on('error', (e) => console.error('err:', e.message));
req.write(payload);
req.end();
