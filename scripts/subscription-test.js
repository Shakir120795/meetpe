// Subscription API test script
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const ADMIN_KEY = process.env.ADMIN_KEY || 'meatpe_admin_123';

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
  console.log('🧪 MeatPe Subscription API Tests\n');

  // Test 1: Create subscription
  await test('Create subscription').run(async () => {
    const res = await axios.post(`${BASE_URL}/api/subscriptions`, {
      phone: '9876543210',
      name: 'Test Customer',
      address: 'Agra, UP',
      items: [
        { code: 'C1', qty: 2 },
        { code: 'L1', qty: 1 }
      ],
      frequency: 'weekly',
      cyclesRemaining: 8,
      notes: 'Fresh meat weekly'
    });
    if (!res.data.ok || !res.data.id) throw new Error('Invalid response');
    global.subId = res.data.id;
    console.log(`    Subscription ID: ${res.data.id}, Next: ${res.data.nextDelivery}, Total: ₹${res.data.total}`);
  });

  // Test 2: Get customer subscriptions
  await test('Get customer subscriptions').run(async () => {
    const res = await axios.get(`${BASE_URL}/api/subscriptions/9876543210`);
    if (!res.data.ok || !Array.isArray(res.data.subscriptions)) throw new Error('Invalid response');
    console.log(`    Found ${res.data.subscriptions.length} subscription(s)`);
  });

  // Test 3: Update subscription (pause)
  await test('Update subscription (pause)').run(async () => {
    const res = await axios.put(`${BASE_URL}/api/subscriptions/${global.subId}`, {
      phone: '9876543210',
      status: 'paused',
      notes: 'Paused temporarily'
    });
    if (!res.data.ok) throw new Error('Invalid response');
  });

  // Test 4: Update subscription (resume)
  await test('Update subscription (resume)').run(async () => {
    const res = await axios.put(`${BASE_URL}/api/subscriptions/${global.subId}`, {
      phone: '9876543210',
      status: 'active'
    });
    if (!res.data.ok) throw new Error('Invalid response');
  });

  // Test 5: Modify subscription items
  await test('Modify subscription items').run(async () => {
    const res = await axios.put(`${BASE_URL}/api/subscriptions/${global.subId}`, {
      phone: '9876543210',
      items: [
        { code: 'C1', qty: 3 },
        { code: 'F1', qty: 2 }
      ]
    });
    if (!res.data.ok) throw new Error('Invalid response');
  });

  // Test 6: Admin view all subscriptions
  await test('Admin view all subscriptions').run(async () => {
    const res = await axios.get(`${BASE_URL}/admin/subscriptions?key=${ADMIN_KEY}`);
    if (!res.data.ok || !Array.isArray(res.data.subscriptions)) throw new Error('Invalid response');
    console.log(`    Total subscriptions: ${res.data.subscriptions.length}`);
    console.log(`    Active MRR: ₹${res.data.stats.total_mrr}`);
  });

  // Test 7: Admin view active subscriptions
  await test('Admin view active subscriptions').run(async () => {
    const res = await axios.get(`${BASE_URL}/admin/subscriptions?key=${ADMIN_KEY}&status=active`);
    if (!res.data.ok) throw new Error('Invalid response');
    console.log(`    Active subscriptions: ${res.data.stats.active}`);
  });

  // Test 8: Cancel subscription
  await test('Cancel subscription').run(async () => {
    const res = await axios.post(`${BASE_URL}/api/subscriptions/${global.subId}/cancel`, {
      phone: '9876543210'
    });
    if (!res.data.ok) throw new Error('Invalid response');
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
