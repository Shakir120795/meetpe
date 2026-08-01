// Mobile App API test script
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

const tests = [];
let testNum = 0;

function test(name) {
  testNum++;
  console.log(`\n[TEST ${testNum}] ${name}`);
  return {
    run: async (fn) => {
      try {
        await fn();
        console.log('  ✅ PASS');
        tests.push({ name, status: 'PASS' });
      } catch (e) {
        console.log('  ❌ FAIL:', e.message);
        tests.push({ name, status: 'FAIL', error: e.message });
      }
    }
  };
}

async function runTests() {
  console.log('🧪 MeatPe Mobile App API Tests\n');

  // Test 1: Mobile login
  await test('Mobile login').run(async () => {
    const res = await axios.post(`${BASE_URL}/api/mobile/login`, {
      phone: '9876543210',
      name: 'Mobile User',
      deviceId: 'device_12345'
    });
    if (!res.data.ok || !res.data.customer) throw new Error('Invalid response');
    console.log(`    User: ${res.data.customer.name}, Wallet: ₹${res.data.customer.wallet}, Rewards: ₹${res.data.customer.rewards}`);
  });

  // Test 2: Get home feed
  await test('Get home feed').run(async () => {
    const res = await axios.get(`${BASE_URL}/api/mobile/home?lat=27.1767&lon=78.0081`);
    if (!res.data.ok || !res.data.home) throw new Error('Invalid response');
    console.log(`    Trending: ${res.data.home.trending.length}, Categories: ${res.data.home.categories.length}, Coupons: ${res.data.home.coupons.length}`);
  });

  // Test 3: Search products
  await test('Search products').run(async () => {
    const res = await axios.get(`${BASE_URL}/api/mobile/search?q=chicken&cat=chicken&maxPrice=500`);
    if (!res.data.ok || !Array.isArray(res.data.results)) throw new Error('Invalid response');
    console.log(`    Found ${res.data.results.length} products`);
  });

  // Test 4: Search by category
  await test('Search by category').run(async () => {
    const res = await axios.get(`${BASE_URL}/api/mobile/search?cat=chicken`);
    if (!res.data.ok || !Array.isArray(res.data.results)) throw new Error('Invalid response');
    console.log(`    Category results: ${res.data.results.length}`);
  });

  // Test 5: Validate cart
  await test('Validate cart').run(async () => {
    const res = await axios.post(`${BASE_URL}/api/mobile/cart/validate`, {
      items: [
        { code: 'C1', qty: 2 },
        { code: 'L1', qty: 1 }
      ],
      couponCode: null
    });
    if (!res.data.ok || !res.data.cart) throw new Error('Invalid response');
    console.log(`    Subtotal: ₹${res.data.cart.subtotal}, Delivery: ₹${res.data.cart.delivery}, Total: ₹${res.data.cart.total}`);
  });

  // Test 6: Validate cart with coupon
  await test('Validate cart with coupon').run(async () => {
    const coupons = await axios.get(`${BASE_URL}/api/coupons`);
    const couponCode = coupons.data[0]?.code || 'TEST10';
    
    const res = await axios.post(`${BASE_URL}/api/mobile/cart/validate`, {
      items: [
        { code: 'C1', qty: 3 }
      ],
      couponCode
    });
    if (!res.data.ok || !res.data.cart) throw new Error('Invalid response');
    console.log(`    With coupon: Discount ₹${res.data.cart.couponDiscount}, Total: ₹${res.data.cart.total}`);
  });

  // Test 7: Mobile checkout
  await test('Mobile checkout').run(async () => {
    const res = await axios.post(`${BASE_URL}/api/mobile/checkout`, {
      phone: '9876543210',
      name: 'Mobile User',
      address: 'Agra, UP 282001',
      items: [
        { code: 'C1', qty: 1 },
        { code: 'F1', qty: 2 }
      ],
      couponCode: null,
      paymentMethod: 'cod',
      lat: 27.1767,
      lon: 78.0081
    });
    if (!res.data.ok || !res.data.order) throw new Error('Invalid response');
    console.log(`    Order ID: ${res.data.order.id}, Total: ₹${res.data.order.total}`);
  });

  // Test 8: Search with price filter
  await test('Search with price filter').run(async () => {
    const res = await axios.get(`${BASE_URL}/api/mobile/search?maxPrice=200`);
    if (!res.data.ok || !Array.isArray(res.data.results)) throw new Error('Invalid response');
    const allUnder200 = res.data.results.every(p => p.price <= 200);
    console.log(`    Products under ₹200: ${res.data.results.length}, All valid: ${allUnder200}`);
  });

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary');
  console.log('='.repeat(50));
  const passed = tests.filter(t => t.status === 'PASS').length;
  const failed = tests.filter(t => t.status === 'FAIL').length;
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Total: ${tests.length}`);
  
  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  - ${t.name}: ${t.error}`);
    });
  }
}

runTests().catch(e => {
  console.error('Test runner error:', e.message);
  process.exit(1);
});
