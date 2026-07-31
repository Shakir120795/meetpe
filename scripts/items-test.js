// Test items CRUD endpoints
const http = require('http');

const KEY = 'meatpe_admin_123';

function call(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: 'localhost', port: 3000, path, method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(buf) }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  console.log('1. Add new item C99');
  let r = await call('POST', `/admin/items?key=${KEY}`, {
    cat: 'chicken', code: 'C99', name: 'TEST Chicken Tangri (500g)', unit: '500g', price: 199, img: '',
  });
  console.log('  ->', r.status, r.json);

  console.log('\n2. Update price of C99 to 249');
  r = await call('PUT', `/admin/items/C99?key=${KEY}`, { price: 249 });
  console.log('  ->', r.status, r.json);

  console.log('\n3. Try to add duplicate C99 (should fail)');
  r = await call('POST', `/admin/items?key=${KEY}`, {
    cat: 'chicken', code: 'C99', name: 'Duplicate', unit: '500g', price: 100, img: '',
  });
  console.log('  ->', r.status, r.json);

  console.log('\n4. Verify in catalog list');
  r = await call('GET', `/admin/items?key=${KEY}`);
  const c99 = r.json.items.find(i => i.code === 'C99');
  console.log('  -> C99 in catalog:', c99);

  console.log('\n5. Verify on public /api/menu (no auth)');
  r = await call('GET', `/api/menu`);
  const c99pub = r.json.find(i => i.code === 'C99');
  console.log('  -> C99 on public menu:', c99pub ? 'YES, price=' + c99pub.price : 'MISSING');

  console.log('\n6. Delete C99');
  r = await call('DELETE', `/admin/items/C99?key=${KEY}`);
  console.log('  ->', r.status, r.json);

  console.log('\n7. Verify gone from catalog');
  r = await call('GET', `/admin/items?key=${KEY}`);
  const stillThere = r.json.items.find(i => i.code === 'C99');
  console.log('  -> C99 still there?', stillThere ? 'YES (BAD)' : 'NO (good)');

  console.log('\nAll tests done.');
})().catch(e => console.error(e));
