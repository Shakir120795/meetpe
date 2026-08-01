// Vendor Management API test script
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
  console.log('🧪 MeatPe Vendor Management API Tests\n');

  // Test 1: Register vendor
  await test('Register vendor').run(async () => {
    const res = await axios.post(`${BASE_URL}/api/vendors/register`, {
      phone: '9876543210',
      name: 'Amit Sharma',
      businessName: 'Fresh Meats Pvt Ltd',
      email: 'amit@freshmeats.com',
      gst: '05ABEPC1234H1Z0'
    });
    if (!res.data.ok || !res.data.vendor_id) throw new Error('Invalid response');
    global.vendorId = res.data.vendor_id;
    console.log(`    Vendor ID: ${res.data.vendor_id}, Status: ${res.data.status}`);
  });

  // Test 2: Get vendor details
  await test('Get vendor details').run(async () => {
    if (!global.vendorId) throw new Error('No vendor ID');
    const res = await axios.get(`${BASE_URL}/api/vendors/${global.vendorId}`);
    if (!res.data.ok || !res.data.vendor) throw new Error('Invalid response');
    console.log(`    Vendor: ${res.data.vendor.business_name}, Status: ${res.data.vendor.status}`);
  });

  // Test 3: Update vendor profile
  await test('Update vendor profile').run(async () => {
    if (!global.vendorId) throw new Error('No vendor ID');
    const res = await axios.put(`${BASE_URL}/api/vendors/${global.vendorId}`, {
      phone: '9876543210',
      address: '123 Market Street',
      city: 'Agra',
      state: 'Uttar Pradesh',
      bankAccount: '123456789012',
      bankIfsc: 'HDFC0001234'
    });
    if (!res.data.ok) throw new Error('Invalid response');
  });

  // Test 4: Admin list all vendors
  await test('Admin list all vendors').run(async () => {
    const res = await axios.get(`${BASE_URL}/admin/vendors?key=${ADMIN_KEY}`);
    if (!res.data.ok || !Array.isArray(res.data.vendors)) throw new Error('Invalid response');
    console.log(`    Total vendors: ${res.data.stats.total}, Pending: ${res.data.stats.pending}, Approved: ${res.data.stats.approved}`);
  });

  // Test 5: Admin approve vendor
  await test('Admin approve vendor').run(async () => {
    if (!global.vendorId) throw new Error('No vendor ID');
    const res = await axios.post(`${BASE_URL}/admin/vendors/${global.vendorId}/approve?key=${ADMIN_KEY}`, {});
    if (!res.data.ok) throw new Error('Invalid response');
  });

  // Test 6: Get vendor's orders
  await test('Get vendor orders').run(async () => {
    if (!global.vendorId) throw new Error('No vendor ID');
    const res = await axios.get(`${BASE_URL}/api/vendors/${global.vendorId}/orders?limit=10`);
    if (!res.data.ok || !Array.isArray(res.data.orders)) throw new Error('Invalid response');
    console.log(`    Total orders: ${res.data.total}`);
  });

  // Test 7: Get vendor analytics
  await test('Get vendor analytics').run(async () => {
    if (!global.vendorId) throw new Error('No vendor ID');
    const res = await axios.get(`${BASE_URL}/api/vendors/${global.vendorId}/analytics`);
    if (!res.data.ok || !res.data.analytics) throw new Error('Invalid response');
    console.log(`    Products: ${res.data.analytics.products}, Orders: ${res.data.analytics.total_orders}, Revenue: ₹${res.data.analytics.total_revenue}`);
  });

  // Test 8: Admin list vendor payouts
  await test('Admin list vendor payouts').run(async () => {
    const res = await axios.get(`${BASE_URL}/admin/vendor-payouts?key=${ADMIN_KEY}`);
    if (!res.data.ok || !Array.isArray(res.data.payouts)) throw new Error('Invalid response');
    console.log(`    Total payouts: ${res.data.stats.total}, Pending: ${res.data.stats.pending}, Amount: ₹${res.data.stats.pending_amount}`);
  });

  // Test 9: Admin reject vendor (new one)
  await test('Admin reject vendor').run(async () => {
    // Create another vendor to reject
    const reg = await axios.post(`${BASE_URL}/api/vendors/register`, {
      phone: '9123456789',
      name: 'Test Vendor',
      businessName: 'Test Meats'
    });
    const rejectRes = await axios.post(`${BASE_URL}/admin/vendors/${reg.data.vendor_id}/reject?key=${ADMIN_KEY}`, {
      reason: 'Missing documentation'
    });
    if (!rejectRes.data.ok) throw new Error('Invalid response');
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
