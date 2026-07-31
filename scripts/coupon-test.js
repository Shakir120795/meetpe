// Coupon end-to-end test
const http = require('http');
function call(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: 'localhost', port: 3000, path, method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    }, (res) => {
      let buf = ''; res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(buf) }));
    });
    req.on('error', reject);
    if (data) req.write(data); req.end();
  });
}
(async () => {
  console.log('1. Validate WELCOME50 with subtotal 200 (should fail — below min ₹299)');
  let r = await call('POST', '/api/coupon/validate', { code: 'WELCOME50', subtotal: 200 });
  console.log('  ->', r.json);

  console.log('\n2. Validate WELCOME50 with subtotal 400 (should give ₹50 discount)');
  r = await call('POST', '/api/coupon/validate', { code: 'WELCOME50', subtotal: 400 });
  console.log('  ->', r.json);

  console.log('\n3. Validate MEATPE10 with subtotal 600 (10% = ₹60)');
  r = await call('POST', '/api/coupon/validate', { code: 'MEATPE10', subtotal: 600 });
  console.log('  ->', r.json);

  console.log('\n4. Validate MEATPE10 with subtotal 5000 (10% = ₹500 capped at ₹100)');
  r = await call('POST', '/api/coupon/validate', { code: 'MEATPE10', subtotal: 5000 });
  console.log('  ->', r.json);

  console.log('\n5. Validate INVALID code');
  r = await call('POST', '/api/coupon/validate', { code: 'NOTREAL', subtotal: 600 });
  console.log('  ->', r.json);

  console.log('\n6. Place order with WELCOME50 and 1× C2 (₹135 — too low) and 2× C1 (₹520) -> sub ₹520+135=655');
  r = await call('POST', '/api/order', {
    name: 'Coupon Test', phone: '9999988888',
    address: 'Test address', payment: 'pay_online',
    couponCode: 'WELCOME50',
    items: [ { code: 'C1', qty: 2 }, { code: 'C2', qty: 1 } ],
  });
  console.log('  ->', r.json);
})().catch(e => console.error(e));
