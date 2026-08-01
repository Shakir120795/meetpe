// Notifications API test script
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
  console.log('🧪 MeatPe Notifications API Tests\n');

  // Test 1: Subscribe to notifications
  await test('Subscribe to notifications').run(async () => {
    const res = await axios.post(`${BASE_URL}/api/notifications/subscribe`, {
      phone: '9876543210',
      email: 'customer@example.com',
      channels: ['whatsapp', 'sms']
    });
    if (!res.data.ok) throw new Error('Invalid response');
    console.log(`    Subscribed to channels: ${res.data.channels.join(', ')}`);
  });

  // Test 2: Get notification templates
  await test('Get notification templates').run(async () => {
    const res = await axios.get(`${BASE_URL}/admin/notification-templates?key=${ADMIN_KEY}`);
    if (!res.data.ok || !Array.isArray(res.data.templates)) throw new Error('Invalid response');
    console.log(`    Found ${res.data.templates.length} templates`);
    global.templateId = res.data.templates[0]?.id;
  });

  // Test 3: View notification history
  await test('View notification history').run(async () => {
    const res = await axios.get(`${BASE_URL}/api/notifications/9876543210?limit=10`);
    if (!res.data.ok || !Array.isArray(res.data.notifications)) throw new Error('Invalid response');
    console.log(`    Found ${res.data.notifications.length} notification(s)`);
  });

  // Test 4: Admin view all notifications
  await test('Admin view all notifications').run(async () => {
    const res = await axios.get(`${BASE_URL}/admin/notifications?key=${ADMIN_KEY}`);
    if (!res.data.ok || !Array.isArray(res.data.notifications)) throw new Error('Invalid response');
    console.log(`    Total: ${res.data.stats.total}, Sent: ${res.data.stats.sent}, Pending: ${res.data.stats.pending}`);
  });

  // Test 5: Admin view by status
  await test('Admin filter by status').run(async () => {
    const res = await axios.get(`${BASE_URL}/admin/notifications?key=${ADMIN_KEY}&status=sent`);
    if (!res.data.ok) throw new Error('Invalid response');
    console.log(`    Sent notifications: ${res.data.notifications.length}`);
  });

  // Test 6: Test notification send
  await test('Send test notification').run(async () => {
    const res = await axios.post(`${BASE_URL}/api/notifications/test?key=${ADMIN_KEY}`, {
      phone: '9876543210',
      message: '🧪 Test notification from MeatPe API',
      channel: 'whatsapp'
    });
    if (!res.data.ok) throw new Error('Invalid response');
  });

  // Test 7: Webhook notification
  await test('Webhook notification').run(async () => {
    const res = await axios.post(`${BASE_URL}/api/webhooks/notify`, {
      phone: '9876543210',
      event: 'delivery_completed',
      data: { message: 'Your order has been delivered' }
    });
    if (!res.data.ok) throw new Error('Invalid response');
  });

  // Test 8: Update notification template
  await test('Update notification template').run(async () => {
    if (!global.templateId) {
      console.log('    Skipped (no template ID)');
      return;
    }
    const res = await axios.put(`${BASE_URL}/admin/notification-templates/${global.templateId}?key=${ADMIN_KEY}`, {
      subject: 'Updated Order Status',
      channels: 'whatsapp,sms,email'
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
