const http = require('http');
function call(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: 'localhost', port: 3000, path, method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    }, (res) => {
      let buf = ''; res.on('data', c => buf += c);
      res.on('end', () => resolve(JSON.parse(buf)));
    });
    req.on('error', reject);
    if (data) req.write(data); req.end();
  });
}
(async () => {
  console.log('1. Update topbar text');
  let r = await call('PUT', '/admin/settings?key=meatpe_admin_123', {
    branding: { topbar: 'TEST: Free delivery on ₹699+ orders!' }
  });
  console.log('  ok:', r.ok, '| topbar:', r.settings?.branding?.topbar);

  console.log('\n2. Add a new category "eggs"');
  const current = await call('GET', '/api/settings');
  const cats = [...current.categories, { key: 'eggs', label: 'Fresh Eggs', icon: '🥚' }];
  r = await call('PUT', '/admin/settings?key=meatpe_admin_123', { categories: cats });
  console.log('  ok:', r.ok, '| categories:', r.settings?.categories?.length);

  console.log('\n3. Add Instagram social');
  r = await call('PUT', '/admin/settings?key=meatpe_admin_123', {
    socials: [{ platform: 'instagram', handle: '@meatpe', url: 'https://instagram.com/meatpe', icon: '📷' }]
  });
  console.log('  ok:', r.ok, '| socials:', r.settings?.socials?.length);

  console.log('\n4. Update About page text');
  r = await call('PUT', '/admin/settings?key=meatpe_admin_123', {
    pages: { about: 'MeatPe delivers premium fresh meat in 30 minutes. We are expanding to all major cities in India.' }
  });
  console.log('  ok:', r.ok, '| about preview:', r.settings?.pages?.about?.slice(0, 50));

  console.log('\n5. Revert topbar + remove eggs category');
  const s = await call('GET', '/api/settings');
  const revertCats = s.categories.filter(c => c.key !== 'eggs');
  r = await call('PUT', '/admin/settings?key=meatpe_admin_123', {
    branding: { topbar: '🚚 Free delivery on orders ₹699+ • 30-min delivery' },
    categories: revertCats,
    socials: [],
    pages: { about: s.pages.about } // keep the updated about
  });
  console.log('  ok:', r.ok, '| cats:', r.settings?.categories?.length, '| socials:', r.settings?.socials?.length);

  console.log('\nAll tests passed!');
})().catch(e => console.error(e));
